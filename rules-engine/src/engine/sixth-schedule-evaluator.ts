import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';
import { samplingRuleForLot } from '../legal/sampling-schedules.js';

const SOURCE = SOURCES.PRINCIPAL_2011;

function evidenceValue(r: InspectionRequest, field: string): unknown {
  const direct = field.split('.').reduce<unknown>((v, p) => v != null && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined, r);
  if (direct !== undefined) return direct;
  const e = r.evidence.find(x => x.field === field);
  return e?.normalizedValue ?? e?.rawValue;
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function finding(id: string, code: string, status: EvaluationStatus, field: string, message: string, reason?: string, missing?: string[]): Finding {
  return {
    findingId: id,
    ruleId: code,
    ruleCode: code,
    ruleNumber: '19 / Sixth Schedule',
    ruleVersion: 1,
    status,
    field,
    message,
    violationReason: reason,
    missingEvidence: missing,
    legalReferences: [SOURCE],
    severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH',
    requiresLegalReview: false,
  };
}

/**
 * Applies the mathematical portion of Sixth Schedule Part II using supplied
 * inspection measurements. This evaluator deliberately does not perform
 * physical weighing, tare determination, or random sampling itself.
 * Those are evidence-acquisition operations performed by the inspector.
 */
export function sixthScheduleFindings(r: InspectionRequest): Finding[] {
  const lotSize = num(evidenceValue(r, 'inspection.lotSize')) ?? num(evidenceValue(r, 'lotSize'));
  const declared = num(evidenceValue(r, 'measurements.declaredQuantity')) ?? num(evidenceValue(r, 'declaredQuantity'));
  const sample = evidenceValue(r, 'measurements.sampleNetQuantities') ?? evidenceValue(r, 'sampleNetQuantities');

  if (lotSize === undefined && declared === undefined && sample === undefined) return [];
  if (lotSize === undefined) return [finding('PCR-R19-SAMPLE-UNVERIFIED', 'PCR-R19-SIXTH-SCHEDULE', 'UNABLE_TO_VERIFY', 'inspection.lotSize', 'A Rule 19 quantity test was supplied without an inspection lot size, so the applicable Fifth Schedule sampling rule cannot be selected.', undefined, ['inspection.lotSize'])];

  const rule = samplingRuleForLot(lotSize);
  if (!rule) return [finding('PCR-R19-SAMPLE-UNSUPPORTED', 'PCR-R19-SIXTH-SCHEDULE', 'UNABLE_TO_VERIFY', 'inspection.lotSize', `Lot size ${lotSize} is outside the configured current Fifth Schedule sampling table (minimum inspection lot size 100).`, undefined, ['inspection.lotSize'])];

  if (!Array.isArray(sample)) return [finding('PCR-R19-NET-UNVERIFIED', 'PCR-R19-SIXTH-SCHEDULE', 'UNABLE_TO_VERIFY', 'measurements.sampleNetQuantities', `The applicable sample size is ${rule.sampleSize}, but individual net-quantity measurements were not supplied.`, undefined, ['measurements.sampleNetQuantities'])];

  const values = sample.map(num);
  if (values.some(v => v === undefined)) return [finding('PCR-R19-NET-UNVERIFIED', 'PCR-R19-SIXTH-SCHEDULE', 'UNABLE_TO_VERIFY', 'measurements.sampleNetQuantities', 'One or more sample net-quantity values is not numeric.', undefined, ['measurements.sampleNetQuantities'])];
  const xs = values as number[];
  if (xs.length !== rule.sampleSize) return [finding('PCR-R19-SAMPLE-SIZE', 'PCR-R19-SIXTH-SCHEDULE', 'UNABLE_TO_VERIFY', 'measurements.sampleNetQuantities', `The Fifth Schedule requires ${rule.sampleSize} packages for this lot size, but ${xs.length} measurements were supplied.`, undefined, ['measurements.sampleNetQuantities'])];
  if (declared === undefined) return [finding('PCR-R19-DECLARED-UNVERIFIED', 'PCR-R19-SIXTH-SCHEDULE', 'UNABLE_TO_VERIFY', 'measurements.declaredQuantity', 'Sample measurements are available, but the declared net quantity is missing.', undefined, ['measurements.declaredQuantity'])];

  const mean = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const variance = xs.reduce((sum, x) => sum + ((x - mean) ** 2), 0) / xs.length;
  const sigma = Math.sqrt(variance);
  const correctedAverage = mean + (sigma * rule.correctionFactor);

  const mpe = num(evidenceValue(r, 'measurements.maximumPermissibleError')) ?? num(evidenceValue(r, 'maximumPermissibleError'));
  if (mpe === undefined) return [finding('PCR-R19-MPE-UNVERIFIED', 'PCR-R19-SIXTH-SCHEDULE', 'UNABLE_TO_VERIFY', 'measurements.maximumPermissibleError', 'The corrected average can be calculated, but the maximum permissible error is required to determine the package-level deficiency criteria.', undefined, ['measurements.maximumPermissibleError'])];

  const deficientBeyondMpe = xs.filter(x => (declared - x) > mpe).length;
  const deficientBeyondTwiceMpe = xs.some(x => (declared - x) > (2 * mpe));
  const averagePass = correctedAverage >= declared;
  const countPass = deficientBeyondMpe <= rule.maxPackagesAboveMpeBelowTwiceMpe;

  if (deficientBeyondTwiceMpe || !averagePass || !countPass) {
    const reasons = [
      !averagePass ? `corrected average ${correctedAverage.toFixed(6)} is below declared quantity ${declared}` : undefined,
      !countPass ? `${deficientBeyondMpe} packages exceed MPE, above the permitted ${rule.maxPackagesAboveMpeBelowTwiceMpe}` : undefined,
      deficientBeyondTwiceMpe ? 'at least one package exceeds twice the maximum permissible error in deficiency' : undefined,
    ].filter(Boolean).join('; ');
    return [finding('PCR-R19-NET-VIOLATION', 'PCR-R19-SIXTH-SCHEDULE', 'VIOLATION', 'measurements.sampleNetQuantities', `The Rule 19 quantity test fails: ${reasons}.`, 'The Fifth/Sixth Schedule lot-approval criteria are not satisfied.')];
  }

  return [finding('PCR-R19-NET-PASS', 'PCR-R19-SIXTH-SCHEDULE', 'PASS', 'measurements.sampleNetQuantities', `The corrected average (${correctedAverage.toFixed(6)}) is at least the declared quantity, no package exceeds twice MPE, and the number exceeding MPE (${deficientBeyondMpe}) is within the permitted limit (${rule.maxPackagesAboveMpeBelowTwiceMpe}).`)];
}
