import { createHash } from 'node:crypto';
import type { EvaluationStatus, Finding, InspectionRequest, OverallInspectionResult } from '../../domain/types.js';
import { evaluateInspection as evaluateBase } from './evaluator.js';
import { SOURCES } from '../legal/sources.js';
import { secondScheduleAppliesOn } from '../legal/second-schedule.js';
import { tableIIFinding } from './table-ii-evaluator.js';

const SOURCE = SOURCES.PRINCIPAL_2011;
function path(input: unknown, key: string): unknown { return key.split('.').reduce<unknown>((v, p) => v != null && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined, input); }
function evidenceValue(r: InspectionRequest, field: string): unknown { const direct = path(r, field); if (direct !== undefined) return direct; const e = r.evidence.find(x => x.field === field || x.field === field.replace(/^declarations\./, '')); return e?.normalizedValue ?? e?.rawValue; }
function currencyNumber(v: unknown): number | undefined { if (typeof v === 'number' && Number.isFinite(v)) return v; if (typeof v !== 'string') return undefined; const n = Number(v.replace(/₹|rs\.?/gi, '').trim()); return Number.isFinite(n) ? n : undefined; }
function finding(id: string, code: string, number: string, status: EvaluationStatus, field: string, message: string, reason?: string, missing?: string[]): Finding { return { findingId: id, ruleId: code, ruleCode: code, ruleNumber: number, ruleVersion: 1, status, field, message, violationReason: reason, missingEvidence: missing, legalReferences: [SOURCE], severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH', requiresLegalReview: false }; }
const THIRD_SCHEDULE = ['soap', 'lotion', 'cream', 'camphor'];
function rule11(r: InspectionRequest): Finding[] {
  const out: Finding[] = []; const p = r.packaging; if (!p) return out;
  if (p.netQuantityExcludesPackaging === false) out.push(finding('PCR-R11-NET', 'PCR-R11-1', '11(1)', 'VIOLATION', 'packaging.netQuantityExcludesPackaging', 'The measured net quantity is not confirmed to exclude wrappers or other packaging material.', 'Rule 11(1) requires net quantity to exclude wrappers/materials other than the commodity.'));
  else if (p.netQuantityExcludesPackaging === undefined && r.measurements) out.push(finding('PCR-R11-NET-UNVERIFIED', 'PCR-R11-1', '11(1)', 'UNABLE_TO_VERIFY', 'packaging.netQuantityExcludesPackaging', 'Packaging exclusion was not established by the supplied evidence.', undefined, ['packaging.netQuantityExcludesPackaging']));
  const variation = p.environmentalVariation; const qualification = (p.quantityQualification ?? '').trim().toLowerCase(); const whenPacked = qualification === 'when packed';
  if (variation === 'NONE' || variation === 'NEGLIGIBLE') {
    if (whenPacked) out.push(finding('PCR-R11-QUALIFICATION', 'PCR-R11-2', '11(2)-(3)', 'VIOLATION', 'packaging.quantityQualification', 'The declaration uses “when packed” although the supplied variation classification does not permit that qualification.', 'Rule 11(2)-(3) does not permit the “when packed” qualification for commodities with no or negligible environmental variation.'));
    else if (variation === 'NEGLIGIBLE' && !r.measurements) out.push(finding('PCR-R11-VARIATION-MEASURE', 'PCR-R11-3', '11(3)', 'UNABLE_TO_VERIFY', 'measurements', 'Negligible environmental variation was identified, but no quantity measurement was supplied to establish that the consumer receives not less than the declared quantity.', undefined, ['measurements']));
  } else if (variation === 'SIGNIFICANT' && whenPacked) {
    const commodity = r.productMetadata.commodityCategory.toLowerCase();
    if (!THIRD_SCHEDULE.some(x => commodity.includes(x))) out.push(finding('PCR-R11-THIRD-SCHEDULE', 'PCR-R11-4', '11(4)', 'VIOLATION', 'packaging.quantityQualification', '“When packed” is used for a commodity not identified in the configured Third Schedule set.', 'Rule 11(4) permits the qualification only for commodities specified in the Third Schedule.'));
    else out.push(finding('PCR-R11-THIRD-SCHEDULE-PASS', 'PCR-R11-4', '11(4)', 'PASS', 'packaging.quantityQualification', 'The “when packed” qualification is supported by the supplied significant-variation and Third Schedule evidence.'));
  } else if (variation === 'UNKNOWN' || variation === undefined) {
    if (whenPacked || r.measurements) out.push(finding('PCR-R11-VARIATION', 'PCR-R11-VARIATION', '11', 'UNABLE_TO_VERIFY', 'packaging.environmentalVariation', 'Environmental variation classification is required to determine the legally applicable Rule 11 quantity declaration treatment.', undefined, ['packaging.environmentalVariation']));
  }
  return out;
}
function rule18(r: InspectionRequest): Finding[] {
  const out: Finding[] = []; if (r.transaction === undefined && evidenceValue(r, 'transaction.salePrice') === undefined) return out;
  const sale = currencyNumber(evidenceValue(r, 'transaction.salePrice')); const mrp = currencyNumber(evidenceValue(r, 'declarations.retailSalePrice') ?? evidenceValue(r, 'transaction.mrp'));
  if (sale === undefined) out.push(finding('PCR-R18-2-UNVERIFIED', 'PCR-R18-2', '18(2)', 'UNABLE_TO_VERIFY', 'transaction.salePrice', 'The actual sale price was not supplied, so compliance with the MRP ceiling cannot be verified.', undefined, ['transaction.salePrice']));
  else if (mrp === undefined) out.push(finding('PCR-R18-2-MRP-UNVERIFIED', 'PCR-R18-2', '18(2)', 'UNABLE_TO_VERIFY', 'declarations.retailSalePrice', 'The applicable retail sale price declaration was not supplied, so the sale-price ceiling cannot be verified.', undefined, ['declarations.retailSalePrice']));
  else if (sale > mrp) out.push(finding('PCR-R18-2-VIOLATION', 'PCR-R18-2', '18(2)', 'VIOLATION', 'transaction.salePrice', `The sale price (${sale}) exceeds the declared retail sale price (${mrp}).`, 'Rule 18(2) prohibits sale of a packaged commodity above its retail sale price.'));
  else out.push(finding('PCR-R18-2-PASS', 'PCR-R18-2', '18(2)', 'PASS', 'transaction.salePrice', `The sale price (${sale}) does not exceed the declared retail sale price (${mrp}).`));
  const conflict = r.transaction?.identicalPackagePriceConflict;
  if (conflict === true) out.push(finding('PCR-R18-2A-VIOLATION', 'PCR-R18-2A', '18(2A)', 'VIOLATION', 'transaction.identicalPackagePriceConflict', 'Identical pre-packaged commodities were supplied with different MRPs through the inspected pricing evidence.', 'Rule 18(2A) prohibits declaring different MRPs on identical pre-packaged commodities through restrictive or unfair trade practices, subject to the rule and applicable law.'));
  else if (conflict === false) out.push(finding('PCR-R18-2A-PASS', 'PCR-R18-2A', '18(2A)', 'PASS', 'transaction.identicalPackagePriceConflict', 'No conflicting MRP evidence was identified for the identical packages in the supplied inspection evidence.'));
  else out.push(finding('PCR-R18-2A-UNVERIFIED', 'PCR-R18-2A', '18(2A)', 'UNABLE_TO_VERIFY', 'transaction.identicalPackagePriceConflict', 'No evidence was supplied to determine whether identical pre-packaged commodities carry different MRPs.', undefined, ['transaction.identicalPackagePriceConflict']));
  return out;
}
function canonical(v: unknown): string { if (v === null || typeof v !== 'object') return JSON.stringify(v); if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`; const o = v as Record<string, unknown>; return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`; }
export function evaluateInspectionComplete(r: InspectionRequest): OverallInspectionResult {
  const base = evaluateBase(r);
  const historicalFindings = secondScheduleAppliesOn(r.inspectionDate) ? base.findings : base.findings.filter(f => f.ruleCode !== 'PCR-R5-SCHEDULE-II');
  const tableII = tableIIFinding(r);
  const added = [...rule11(r), ...rule18(r), ...(tableII ? [tableII] : [])];
  const findings = [...historicalFindings, ...added];
  const summary = { totalRulesEvaluated: findings.length, passed: findings.filter(f => f.status === 'PASS').length, violations: findings.filter(f => f.status === 'VIOLATION').length, unableToVerify: findings.filter(f => f.status === 'UNABLE_TO_VERIFY').length, notApplicable: findings.filter(f => f.status === 'NOT_APPLICABLE').length };
  const overallStatus: EvaluationStatus = summary.violations > 0 ? 'VIOLATION' : summary.unableToVerify > 0 ? 'UNABLE_TO_VERIFY' : summary.passed > 0 ? 'PASS' : 'NOT_APPLICABLE';
  const result = { ...base, overallStatus, summary, findings };
  return { ...result, auditHash: createHash('sha256').update(canonical(result)).digest('hex') };
}
