import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';
import { firstScheduleTableII, type TableIIUnit } from '../legal/table-ii.js';

export function tableIIFinding(r: InspectionRequest): Finding | undefined {
  const m = r.measurements;
  const unit = m?.declaredUnit as TableIIUnit | undefined;
  if (!m || !unit || !['m', 'm2', 'number'].includes(unit)) return undefined;
  const x = firstScheduleTableII(unit, m.declaredQuantity, m.actualQuantity);
  if (!x.applicable) return {
    findingId: 'PCR-SCHED-II-MPE-UNVERIFIED', ruleId: 'PCR-SCHED-II-MPE', ruleCode: 'PCR-SCHED-II-MPE',
    ruleNumber: 'First Schedule Table II', ruleVersion: 1, status: 'UNABLE_TO_VERIFY', field: 'measurements',
    message: x.reason ?? 'First Schedule Table II could not be evaluated.', legalReferences: [SOURCES.PRINCIPAL_2011], severity: 'HIGH', requiresLegalReview: false
  };
  const status: EvaluationStatus = x.withinTolerance ? 'PASS' : 'VIOLATION';
  return {
    findingId: 'PCR-SCHED-II-MPE', ruleId: 'PCR-SCHED-II-MPE', ruleCode: 'PCR-SCHED-II-MPE', ruleNumber: 'First Schedule Table II', ruleVersion: 1,
    status, field: 'measurements',
    message: status === 'PASS' ? `Measured deficiency is within Table II MPE ${x.tolerance} ${unit === 'm2' ? 'm²' : unit}.` : `Measured deficiency ${x.deficiency} exceeds Table II MPE ${x.tolerance} ${unit === 'm2' ? 'm²' : unit}.`,
    violationReason: status === 'VIOLATION' ? 'Measured deficiency exceeds the applicable First Schedule Table II maximum permissible error.' : undefined,
    legalReferences: [SOURCES.PRINCIPAL_2011], severity: 'CRITICAL', requiresLegalReview: false
  };
}
