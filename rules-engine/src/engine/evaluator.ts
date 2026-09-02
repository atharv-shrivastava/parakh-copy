import { createHash } from 'node:crypto';
import type {
  EvidenceConflict, EvidenceItem, EvaluationStatus, Finding, InspectionRequest,
  OverallInspectionResult, RuleCondition, RuleDefinition, RuleVersion
} from '../../domain/types.js';
import { RULES, RULESET_VERSION } from '../legal/rules.js';

export const ENGINE_VERSION = '0.1.0';

const UNIT_ALIASES: Record<string, string> = {
  g: 'g', gram: 'g', grams: 'g', kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  mg: 'mg', milligram: 'mg', milligrams: 'mg',
  ml: 'mL', millilitre: 'mL', millilitres: 'mL', milliliter: 'mL', milliliters: 'mL',
  l: 'L', litre: 'L', litres: 'L', liter: 'L', liters: 'L',
  cm: 'cm', mm: 'mm', m: 'm', number: 'number', nos: 'number', no: 'number'
};

function getPath(input: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, part) => {
    if (value === null || value === undefined || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[part];
  }, input);
}

function evidenceFor(request: InspectionRequest, field: string): EvidenceItem[] {
  return request.evidence.filter(e => e.field === field || e.field === field.replace(/^declarations\./, ''));
}

function conflictFor(request: InspectionRequest, field: string): EvidenceConflict[] {
  return (request.evidenceConflicts ?? []).filter(c => c.status === 'UNRESOLVED' && c.field === field);
}

function sourceValue(request: InspectionRequest, field: string): unknown {
  const direct = getPath(request, field);
  if (direct !== undefined) return direct;
  const items = evidenceFor(request, field);
  if (items.length === 0) return undefined;
  return items[0]?.normalizedValue ?? items[0]?.rawValue;
}

function confidenceOk(items: EvidenceItem[], minimum?: number): boolean {
  if (minimum === undefined || items.length === 0) return true;
  return Math.max(...items.map(e => e.confidence)) >= minimum;
}

function normalizeUnit(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return UNIT_ALIASES[value.trim().toLowerCase()];
}

function validCurrency(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
  if (typeof value !== 'string') return false;
  return /^(?:₹|rs\.?\s*)?\d+(?:\.\d{1,2})?$|^\d+(?:\.\d{1,2})?\s*(?:₹|rs\.?)$/i.test(value.trim());
}

function validDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  return /^(?:0?[1-9]|1[0-2])[\/-](?:19|20)\d{2}$/.test(v) ||
    /^(?:19|20)\d{2}[\/-](?:0?[1-9]|1[0-2])$/.test(v) ||
    /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function applicable(request: InspectionRequest, version: RuleVersion, rule: RuleDefinition): boolean {
  const a = version.applicabilityCriteria;
  if (a.contexts && !a.contexts.includes(request.context)) return false;
  const commodity = request.productMetadata.commodityCategory.trim().toLowerCase();
  if (a.includedCommodities && !a.includedCommodities.some(x => commodity.includes(x.toLowerCase()))) return false;
  if (a.excludedCommodities && a.excludedCommodities.some(x => commodity.includes(x.toLowerCase()))) return false;
  if (a.packageTypes && request.productMetadata.packageType && !a.packageTypes.includes(request.productMetadata.packageType)) return false;
  if (a.excludedConsumerTypes && request.productMetadata.consumerType && a.excludedConsumerTypes.includes(request.productMetadata.consumerType)) return false;
  if (rule.ruleId === 'PCR-R26-A-PAN-MASALA') return commodity.includes('pan masala');
  return true;
}

function chooseVersion(rule: RuleDefinition, inspectionDate: string): RuleVersion | undefined {
  return [...rule.versions]
    .filter(v => v.effectiveFrom <= inspectionDate && (v.effectiveUntil === null || inspectionDate <= v.effectiveUntil))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

function conditionResult(request: InspectionRequest, condition: RuleCondition): { status: EvaluationStatus; missing: string[]; message: string; reason?: string; evidence: EvidenceItem[]; conflicts: EvidenceConflict[] } {
  const items = evidenceFor(request, condition.targetField);
  const conflicts = conflictFor(request, condition.targetField);
  if (conflicts.length) return { status: 'UNABLE_TO_VERIFY', missing: [], message: condition.errorMessage, evidence: items, conflicts };
  if (!confidenceOk(items, condition.minimumConfidence)) return { status: 'UNABLE_TO_VERIFY', missing: [condition.targetField], message: condition.errorMessage, evidence: items, conflicts };

  const value = sourceValue(request, condition.targetField);
  const missing = value === undefined || value === null || value === '';
  const fail = (reason = condition.violationReason) => ({ status: 'VIOLATION' as const, missing: [], message: condition.errorMessage, reason, evidence: items, conflicts });
  const pass = () => ({ status: 'PASS' as const, missing: [], message: 'Requirement satisfied.', evidence: items, conflicts });
  const unable = () => ({ status: 'UNABLE_TO_VERIFY' as const, missing: [condition.targetField], message: condition.errorMessage, evidence: items, conflicts });

  switch (condition.operator) {
    case 'EXISTS': return missing ? unable() : pass();
    case 'NOT_EXISTS': return missing ? pass() : fail();
    case 'EQUALS': return missing ? unable() : value === condition.expectedValue ? pass() : fail();
    case 'NOT_EQUALS': return missing ? unable() : value !== condition.expectedValue ? pass() : fail();
    case 'REGEX_MATCH': return missing || typeof condition.expectedValue !== 'string' || typeof value !== 'string' ? unable() : new RegExp(condition.expectedValue).test(value) ? pass() : fail();
    case 'GREATER_THAN': return typeof value === 'number' && typeof condition.expectedValue === 'number' ? value > condition.expectedValue ? pass() : fail() : unable();
    case 'LESS_THAN': return typeof value === 'number' && typeof condition.expectedValue === 'number' ? value < condition.expectedValue ? pass() : fail() : unable();
    case 'GREATER_THAN_OR_EQUAL': return typeof value === 'number' && typeof condition.expectedValue === 'number' ? value >= condition.expectedValue ? pass() : fail() : unable();
    case 'LESS_THAN_OR_EQUAL': return typeof value === 'number' && typeof condition.expectedValue === 'number' ? value <= condition.expectedValue ? pass() : fail() : unable();
    case 'VALID_UNIT': return missing ? unable() : normalizeUnit(value) ? pass() : fail();
    case 'VALID_CURRENCY': return missing ? unable() : validCurrency(value) ? pass() : fail();
    case 'VALID_DATE_FORMAT': return missing ? unable() : validDate(value) ? pass() : fail();
    case 'IN_LIST': return missing || !Array.isArray(condition.expectedValue) ? unable() : condition.expectedValue.includes(value) ? pass() : fail();
    case 'VISUAL_CHECK': {
      const flag = getPath(request, condition.targetField);
      return typeof flag === 'boolean' ? (flag ? pass() : fail()) : unable();
    }
    case 'CONFLICT_EXISTS': return conflicts.length ? fail() : pass();
    case 'PACKAGE_TYPE': return request.productMetadata.packageType ? (request.productMetadata.packageType === condition.expectedValue ? pass() : fail()) : unable();
    case 'COMMODITY_TYPE': return request.productMetadata.commodityCategory ? (request.productMetadata.commodityCategory.toLowerCase() === String(condition.expectedValue).toLowerCase() ? pass() : fail()) : unable();
    case 'CONTEXT_TYPE': return request.context === condition.expectedValue ? pass() : fail();
    case 'EVIDENCE_CONFIDENCE': return items.length && Math.max(...items.map(e => e.confidence)) >= Number(condition.expectedValue) ? pass() : unable();
    default: return unable();
  }
}

function findingFor(rule: RuleDefinition, version: RuleVersion, condition: RuleCondition, result: ReturnType<typeof conditionResult>, index: number): Finding {
  return {
    findingId: `${rule.ruleCode}-${version.version}-${index + 1}`,
    ruleId: rule.ruleId, ruleCode: rule.ruleCode, ruleNumber: rule.ruleNumber, subclause: rule.subclause,
    ruleVersion: version.version, status: result.status, field: condition.targetField,
    message: result.status === 'PASS' ? condition.errorMessage.replace(/ is required\.?$/i, ' satisfied.') : result.message,
    violationReason: result.reason, evidenceUsed: result.evidence, missingEvidence: result.missing,
    conflicts: result.conflicts, legalReferences: version.legalSources, severity: rule.defaultSeverity,
    requiresLegalReview: version.legalSources.some(s => s.verificationStatus !== 'VERIFIED')
  };
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
}

export function evaluateInspection(request: InspectionRequest, rules: RuleDefinition[] = RULES): OverallInspectionResult {
  const findings: Finding[] = [];
  const applicableRules = rules.filter(rule => rule.enabled);

  for (const rule of applicableRules) {
    const version = chooseVersion(rule, request.inspectionDate.slice(0, 10));
    if (!version) continue;

    if (rule.ruleId === 'PCR-R3') {
      const excluded = request.productMetadata.consumerType === 'industrial' || request.productMetadata.consumerType === 'institutional';
      findings.push({
        findingId: `${rule.ruleCode}-${version.version}`,
        ruleId: rule.ruleId, ruleCode: rule.ruleCode, ruleNumber: rule.ruleNumber, ruleVersion: version.version,
        status: excluded ? 'NOT_APPLICABLE' : 'PASS', message: excluded ? 'Chapter II is excluded for the identified consumer type, subject to the rule exceptions.' : 'Chapter II applicability gate passed for a general consumer.',
        legalReferences: version.legalSources, severity: rule.defaultSeverity, requiresLegalReview: false
      });
      continue;
    }

    if (!applicable(request, version, rule)) {
      findings.push({ findingId: `${rule.ruleCode}-${version.version}-NA`, ruleId: rule.ruleId, ruleCode: rule.ruleCode, ruleNumber: rule.ruleNumber, ruleVersion: version.version, status: 'NOT_APPLICABLE', message: 'Rule is outside its structured applicability criteria.', legalReferences: version.legalSources, severity: rule.defaultSeverity, requiresLegalReview: false });
      continue;
    }

    if (version.status === 'REQUIRES_LEGAL_REVIEW') {
      findings.push({ findingId: `${rule.ruleCode}-${version.version}-LEGAL`, ruleId: rule.ruleId, ruleCode: rule.ruleCode, ruleNumber: rule.ruleNumber, ruleVersion: version.version, status: 'UNABLE_TO_VERIFY', message: 'Rule version is marked for legal review.', legalReferences: version.legalSources, severity: rule.defaultSeverity, requiresLegalReview: true });
      continue;
    }

    version.conditions.forEach((condition, index) => {
      findings.push(findingFor(rule, version, condition, conditionResult(request, condition), index));
    });
  }

  const summary = {
    totalRulesEvaluated: findings.length,
    passed: findings.filter(f => f.status === 'PASS').length,
    violations: findings.filter(f => f.status === 'VIOLATION').length,
    unableToVerify: findings.filter(f => f.status === 'UNABLE_TO_VERIFY').length,
    notApplicable: findings.filter(f => f.status === 'NOT_APPLICABLE').length
  };

  const overallStatus: EvaluationStatus = summary.violations > 0 ? 'VIOLATION' : summary.unableToVerify > 0 ? 'UNABLE_TO_VERIFY' : summary.passed > 0 ? 'PASS' : 'NOT_APPLICABLE';
  const resultBase = { inspectionId: request.inspectionId, productId: request.productId, inspectionDate: request.inspectionDate, overallStatus, engineVersion: ENGINE_VERSION, ruleSetVersion: RULESET_VERSION, summary, findings };
  const auditHash = createHash('sha256').update(canonical(resultBase)).digest('hex');
  return { ...resultBase, auditHash };
}
