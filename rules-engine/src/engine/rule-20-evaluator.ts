import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

/** Rule 20: enforcement action after completion of a manufacturer/packer inspection. */
export function rule20Findings(r: InspectionRequest): Finding[] {
  const i = r.inspectionResults;
  if (!i) return [];

  const correctedAverage = i.correctedAverageNetQuantity;
  const declared = i.declaredNetQuantity;
  const excessMpeCount = i.packagesAboveMpeBelowTwiceMpe;
  const maxAllowed = i.maxPackagesAboveMpeBelowTwiceMpe;
  const anyAboveTwiceMpe = i.anyPackageAboveTwiceMpe;
  const declarationsComplete = i.mandatoryDeclarationsComplete;

  const valuesPresent = [correctedAverage, declared, excessMpeCount, maxAllowed, anyAboveTwiceMpe, declarationsComplete]
    .every(v => v !== undefined);
  if (!valuesPresent) {
    return [{
      findingId: 'PCR-R20-UNVERIFIED', ruleId: 'PCR-R20', ruleCode: 'PCR-R20', ruleNumber: '20', ruleVersion: 1,
      status: 'UNABLE_TO_VERIFY' as EvaluationStatus,
      field: 'inspectionResults',
      message: 'Rule 20 requires the completed Rule 19 inspection results to determine whether enforcement action is triggered.',
      missingEvidence: ['inspectionResults.correctedAverageNetQuantity', 'inspectionResults.declaredNetQuantity', 'inspectionResults.packagesAboveMpeBelowTwiceMpe', 'inspectionResults.maxPackagesAboveMpeBelowTwiceMpe', 'inspectionResults.anyPackageAboveTwiceMpe', 'inspectionResults.mandatoryDeclarationsComplete'],
      legalReferences: [SOURCES.PRINCIPAL_2011], severity: 'HIGH', requiresLegalReview: false
    }];
  }

  const violation = correctedAverage < declared || excessMpeCount > maxAllowed || anyAboveTwiceMpe === true || declarationsComplete === false;
  return [{
    findingId: violation ? 'PCR-R20-VIOLATION' : 'PCR-R20-PASS', ruleId: 'PCR-R20', ruleCode: 'PCR-R20', ruleNumber: '20', ruleVersion: 1,
    status: violation ? 'VIOLATION' : 'PASS', field: 'inspectionResults',
    message: violation ? 'The completed Rule 19 inspection results trigger the Rule 20 enforcement conditions.' : 'The supplied Rule 19 inspection results do not trigger the Rule 20 enforcement conditions.',
    legalReferences: [SOURCES.PRINCIPAL_2011], severity: violation ? 'CRITICAL' : 'HIGH', requiresLegalReview: false
  }];
}
