import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

function evidenceValue(r: InspectionRequest, field: string): unknown {
  const item = r.evidence.find(e => e.field === field);
  return item?.normalizedValue ?? item?.rawValue;
}

function numberValue(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return undefined;
  const n = Number(v.replace(/%/g, '').trim());
  return Number.isFinite(n) ? n : undefined;
}

function finding(id: string, status: EvaluationStatus, field: string, message: string, reason?: string, missing?: string[]): Finding {
  return {
    findingId: id,
    ruleId: 'PCR-R22',
    ruleCode: 'PCR-R22',
    ruleNumber: '22',
    ruleVersion: 1,
    status,
    field,
    message,
    violationReason: reason,
    missingEvidence: missing,
    legalReferences: [SOURCES.PRINCIPAL_2011],
    severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH',
    requiresLegalReview: false,
  };
}

/**
 * Rule 22 validates the provenance of the MPE used for a quantity test.
 * It does not invent an MPE: the First Schedule calculation must be supplied
 * by the measurement/evidence layer and can then be checked for consistency.
 */
export function rule22Findings(r: InspectionRequest): Finding[] {
  if (!r.measurements && evidenceValue(r, 'rule22.mpeValue') === undefined && evidenceValue(r, 'rule22.mpePercent') === undefined) return [];

  const declared = r.measurements?.declaredQuantity ?? numberValue(evidenceValue(r, 'rule22.declaredQuantity'));
  const unit = r.measurements?.declaredUnit ?? String(evidenceValue(r, 'rule22.unit') ?? '').trim();
  const suppliedMpe = numberValue(evidenceValue(r, 'rule22.mpeValue'));
  const suppliedPercent = numberValue(evidenceValue(r, 'rule22.mpePercent'));
  const firstScheduleApplied = evidenceValue(r, 'rule22.firstScheduleApplied');
  const variationFactorsConsidered = evidenceValue(r, 'rule22.variationFactorsConsidered');

  if (declared === undefined || !unit) {
    return [finding('PCR-R22-INPUT-UNVERIFIED', 'UNABLE_TO_VERIFY', 'measurements', 'Rule 22 MPE validation was requested, but the declared quantity and unit required to identify the applicable First Schedule tolerance were not supplied.', undefined, ['measurements.declaredQuantity', 'measurements.declaredUnit'])];
  }

  if (firstScheduleApplied === false || String(firstScheduleApplied).toLowerCase() === 'false') {
    return [finding('PCR-R22-SCHEDULE-VIOLATION', 'VIOLATION', 'rule22.firstScheduleApplied', 'The supplied quantity-test record states that the First Schedule was not used to determine the maximum permissible error.', 'Rule 22 requires maximum permissible error to be determined with reference to the First Schedule.')];
  }

  if (firstScheduleApplied === undefined && suppliedMpe === undefined && suppliedPercent === undefined) {
    return [finding('PCR-R22-SCHEDULE-UNVERIFIED', 'UNABLE_TO_VERIFY', 'rule22.firstScheduleApplied', 'No evidence establishes that the applicable First Schedule maximum permissible error was used.', undefined, ['rule22.firstScheduleApplied', 'rule22.mpeValue'])];
  }

  if (suppliedMpe === undefined && suppliedPercent === undefined) {
    return [finding('PCR-R22-MPE-UNVERIFIED', 'UNABLE_TO_VERIFY', 'rule22.mpeValue', 'The First Schedule is identified, but the actual MPE used for the quantity test was not supplied.', undefined, ['rule22.mpeValue', 'rule22.mpePercent'])];
  }

  if (variationFactorsConsidered === false || String(variationFactorsConsidered).toLowerCase() === 'false') {
    return [finding('PCR-R22-VARIATION-VIOLATION', 'VIOLATION', 'rule22.variationFactorsConsidered', 'The quantity-test record states that relevant unavoidable variation factors were not considered when establishing the maximum permissible error.', 'Rule 22 requires unavoidable variation arising from weighing, measuring or counting and ordinary exposure to climate, transport, storage and distribution to be taken into account.')];
  }

  if (variationFactorsConsidered === undefined) {
    return [finding('PCR-R22-VARIATION-UNVERIFIED', 'UNABLE_TO_VERIFY', 'rule22.variationFactorsConsidered', 'The MPE value is supplied, but the inspection record does not establish that the Rule 22 variation factors were considered.', undefined, ['rule22.variationFactorsConsidered'])];
  }

  return [finding('PCR-R22-PASS', 'PASS', 'rule22.mpeValue', `The quantity-test record identifies the First Schedule basis, supplies an MPE (${suppliedMpe ?? `${suppliedPercent}%`}), and records consideration of Rule 22 variation factors for the declared ${declared} ${unit}.`)];
}
