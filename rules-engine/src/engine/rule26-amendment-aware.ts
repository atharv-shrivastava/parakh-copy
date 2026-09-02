import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

function value(r: InspectionRequest, field: string): unknown {
  const direct = field.split('.').reduce<unknown>((v, p) => v != null && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined, r as unknown);
  if (direct !== undefined) return direct;
  const e = r.evidence.find(x => x.field === field);
  return e?.normalizedValue ?? e?.rawValue;
}
function bool(r: InspectionRequest, field: string): boolean | undefined {
  const v = value(r, field);
  if (v === true || String(v).toLowerCase() === 'true') return true;
  if (v === false || String(v).toLowerCase() === 'false') return false;
  return undefined;
}
function finding(status: EvaluationStatus, id: string, field: string, message: string, reason?: string, refs = [SOURCES.PRINCIPAL_2011]): Finding {
  return { findingId: id, ruleId: 'PCR-R26', ruleCode: 'PCR-R26', ruleNumber: '26', ruleVersion: 1, status, field, message, violationReason: reason, legalReferences: refs, severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH', requiresLegalReview: false };
}

export function rule26AmendmentAwareFindings(r: InspectionRequest): Finding[] {
  const category = r.productMetadata.commodityCategory.toLowerCase();
  const exemptionClaimed = bool(r, 'rule26.exemptionClaimed');
  const basis = String(value(r, 'rule26.exemptionBasis') ?? '').toLowerCase();
  if (exemptionClaimed === undefined) return [];

  const panMasala = category.includes('pan masala');
  const effective = r.inspectionDate.slice(0, 10) >= '2026-02-01';
  const smallPackBasis = basis.includes('10g') || basis.includes('10ml');

  if (panMasala && effective && smallPackBasis && exemptionClaimed) {
    return [finding('VIOLATION', 'PCR-R26-PAN-MASALA-VIOLATION', 'rule26.exemptionBasis', 'The claimed Rule 26(a) small-package exemption is not available to pan masala on this inspection date.', 'G.S.R. 881(E) inserted the pan-masala exclusion from Rule 26(a), effective 1 February 2026.', [SOURCES.AMEND_2025_881E])];
  }

  if (panMasala && !effective && smallPackBasis && exemptionClaimed) {
    return [finding('PASS', 'PCR-R26-HISTORICAL-PAN-MASALA', 'rule26.exemptionBasis', 'The inspection predates the 1 February 2026 pan-masala amendment; the later Rule 26(a) exclusion is not applied retroactively.')];
  }

  if (!exemptionClaimed) return [finding('PASS', 'PCR-R26-NO-EXEMPTION', 'rule26.exemptionClaimed', 'No Rule 26 exemption was claimed in the supplied inspection evidence.')];

  const recognised = ['10g', '10ml', 'fast food', 'restaurant', 'hotel', 'drug', 'scheduled formulation', 'non-scheduled formulation'].some(x => basis.includes(x));
  if (!recognised) return [finding('UNABLE_TO_VERIFY', 'PCR-R26-BASIS-UNVERIFIED', 'rule26.exemptionBasis', 'A Rule 26 exemption was claimed, but the supplied exemption basis is not recognised by the configured legal data.', undefined, [SOURCES.PRINCIPAL_2011])];
  return [finding('PASS', 'PCR-R26-PASS', 'rule26.exemptionBasis', 'The supplied evidence identifies a configured Rule 26 exemption basis.')];
}
