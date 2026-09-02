import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

function evidenceValue(r: InspectionRequest, field: string): unknown {
  const item = r.evidence.find(e => e.field === field);
  return item?.normalizedValue ?? item?.rawValue;
}

function boolValue(r: InspectionRequest, field: string): boolean | undefined {
  const v = evidenceValue(r, field);
  if (v === true || String(v).toLowerCase() === 'true') return true;
  if (v === false || String(v).toLowerCase() === 'false') return false;
  return undefined;
}

function finding(id: string, status: EvaluationStatus, field: string, message: string, reason?: string, missing?: string[]): Finding {
  return {
    findingId: id,
    ruleId: 'PCR-R21',
    ruleCode: 'PCR-R21',
    ruleNumber: '21',
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

/** Rule 21: quantity/error inspection at wholesale or retail dealer premises. */
export function rule21Findings(r: InspectionRequest): Finding[] {
  const packageType = r.productMetadata.packageType;
  const applies = r.context === 'both' || r.context === 'physical_package';
  const dealerContext = packageType === 'retail' || packageType === 'wholesale' || r.packaging?.wholesalePackage === true;
  if (!applies || !dealerContext) return [];

  const testPerformed = boolValue(r, 'rule21.testPerformed');
  const complaint = boolValue(r, 'rule21.complaintReceived');
  const tampering = boolValue(r, 'rule21.tamperingOrPilferageSuspected');
  const missingDeclarationSuspicion = boolValue(r, 'rule21.missingDeclarationsSuspected');

  if (testPerformed === undefined) {
    return [finding(
      'PCR-R21-TEST-PROCEDURE-UNVERIFIED',
      'UNABLE_TO_VERIFY',
      'rule21.testPerformed',
      'Rule 21 applies at wholesale or retail dealer premises, but the inspection record does not state whether a net-quantity test was performed.',
      undefined,
      ['rule21.testPerformed']
    )];
  }

  const triggerKnown = complaint !== undefined || tampering !== undefined || missingDeclarationSuspicion !== undefined;
  const trigger = complaint === true || tampering === true || missingDeclarationSuspicion === true;

  if (!testPerformed) {
    if (!triggerKnown) {
      return [finding(
        'PCR-R21-NO-TEST-UNVERIFIED',
        'UNABLE_TO_VERIFY',
        'rule21',
        'No quantity test was recorded, but the evidence does not establish whether one of the Rule 21 exceptions permitting a dealer-premises test existed.',
        undefined,
        ['rule21.complaintReceived', 'rule21.tamperingOrPilferageSuspected', 'rule21.missingDeclarationsSuspected']
      )];
    }
    return [finding(
      'PCR-R21-NO-TEST-PASS',
      'PASS',
      'rule21.testPerformed',
      trigger ? 'A Rule 21 trigger was recorded, but no quantity test was performed. This finding does not determine whether the officer had a separate lawful reason for not testing.' : 'No Rule 21 trigger permitting a dealer-premises quantity test was recorded, and no quantity test was performed.'
    )];
  }

  if (!triggerKnown) {
    return [finding(
      'PCR-R21-TRIGGER-UNVERIFIED',
      'UNABLE_TO_VERIFY',
      'rule21',
      'A quantity test was performed at a wholesale or retail dealer premises, but the evidence does not establish the Rule 21 condition permitting that test.',
      'Rule 21 ordinarily restricts net-quantity testing at dealer premises to specified complaint or suspicion circumstances.',
      ['rule21.complaintReceived', 'rule21.tamperingOrPilferageSuspected', 'rule21.missingDeclarationsSuspected']
    )];
  }

  if (!trigger) {
    return [finding(
      'PCR-R21-TEST-WITHOUT-TRIGGER',
      'VIOLATION',
      'rule21.testPerformed',
      'A net-quantity test was recorded at a wholesale or retail dealer premises without evidence of a Rule 21 permitting condition.',
      'Rule 21 ordinarily prohibits dealer-premises net-quantity testing unless a specified complaint or suspicion condition exists.'
    )];
  }

  const deficiencyExceedsMpe = boolValue(r, 'rule21.deficiencyExceedsMpe');
  const whenPacked = boolValue(r, 'rule21.whenPacked');
  const environmentalCause = boolValue(r, 'rule21.environmentalCauseSatisfied');
  const missingDeclarations = boolValue(r, 'rule21.missingDeclarations');

  if (deficiencyExceedsMpe === undefined && missingDeclarations === undefined) {
    return [finding(
      'PCR-R21-RESULT-UNVERIFIED',
      'UNABLE_TO_VERIFY',
      'rule21.testResult',
      'The permitted Rule 21 test was performed, but the inspection record does not establish whether deficiency exceeded the maximum permissible error or whether mandatory declarations were missing.',
      undefined,
      ['rule21.deficiencyExceedsMpe', 'rule21.missingDeclarations']
    )];
  }

  const environmentalException = whenPacked === true && environmentalCause === true;
  if (deficiencyExceedsMpe === true && !environmentalException) {
    return [finding(
      'PCR-R21-DEFICIENCY-VIOLATION',
      'VIOLATION',
      'rule21.deficiencyExceedsMpe',
      'The dealer-premises test found a deficiency greater than the maximum permissible error.',
      'Rule 21(3) requires seizure and appropriate action when deficiency exceeds the maximum permissible error, subject to the stated “when packed” environmental-condition proviso.'
    )];
  }

  if (missingDeclarations === true) {
    return [finding(
      'PCR-R21-MISSING-DECLARATIONS',
      'VIOLATION',
      'rule21.missingDeclarations',
      'The tested package or its label does not bear all required declarations, requiring source enquiries under Rule 21(5).',
      'Rule 21(5) authorises enquiries into the source of a package lacking required declarations.'
    )];
  }

  return [finding(
    'PCR-R21-PASS',
    'PASS',
    'rule21.testResult',
    environmentalException ? 'The recorded deficiency is attributed to environmental conditions for a package bearing the “when packed” legend, so the Rule 21 punitive-action proviso is engaged.' : 'The Rule 21 test evidence does not establish a deficiency exceeding the maximum permissible error or missing mandatory declarations.'
  )];
}
