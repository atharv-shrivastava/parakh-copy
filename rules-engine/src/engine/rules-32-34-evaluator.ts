import type { Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

const SOURCE = SOURCES.PRINCIPAL_2011;

function finding(id: string, code: string, number: string, status: Finding['status'], field: string, message: string, reason?: string, missing?: string[]): Finding {
  return {
    findingId: id,
    ruleId: code,
    ruleCode: code,
    ruleNumber: number,
    ruleVersion: 1,
    status,
    field,
    message,
    violationReason: reason,
    missingEvidence: missing,
    legalReferences: [SOURCE],
    severity: status === 'VIOLATION' ? 'CRITICAL' : 'INFO',
    requiresLegalReview: status === 'UNABLE_TO_VERIFY'
  };
}

/**
 * Rules 32-34 are legal-consequence / transitional provisions rather than
 * ordinary package-label checks. The engine records their applicability only
 * when explicit enforcement evidence is supplied. It never invents a fine or
 * compounding outcome from a package finding alone.
 */
export function rules32To34Findings(r: InspectionRequest): Finding[] {
  const out: Finding[] = [];
  const enforcement = r.evidence.find(e => e.field === 'enforcement.rule32Applicable' || e.field === 'rule32Applicable');
  if (enforcement) {
    const value = enforcement.normalizedValue ?? enforcement.rawValue;
    if (value === true || String(value).toLowerCase() === 'true') {
      out.push(finding('PCR-R32-REVIEW', 'PCR-R32', '32', 'UNABLE_TO_VERIFY', 'enforcement.rule32Applicable', 'Rule 32 has been identified as applicable, but the engine does not determine statutory penalties from package evidence alone.', 'Penalty determination depends on the applicable Act/rule offence and enforcement facts.', ['enforcement.offenceBasis', 'enforcement.authorityDecision']));
    } else {
      out.push(finding('PCR-R32-NA', 'PCR-R32', '32', 'NOT_APPLICABLE', 'enforcement.rule32Applicable', 'No Rule 32 enforcement applicability was established by the supplied evidence.'));
    }
  }

  const compounding = r.evidence.find(e => e.field === 'enforcement.compoundingRequested' || e.field === 'compoundingRequested');
  if (compounding) {
    const value = compounding.normalizedValue ?? compounding.rawValue;
    if (value === true || String(value).toLowerCase() === 'true') {
      out.push(finding('PCR-R32A-REVIEW', 'PCR-R32A', '32A', 'UNABLE_TO_VERIFY', 'enforcement.compoundingRequested', 'A compounding process is indicated, but the engine does not determine or approve compounding amounts.', 'Rule 32A amounts are legal consequences of specified offences and applicant category, not package-label evidence.', ['enforcement.offenceSection', 'enforcement.applicantCategory', 'enforcement.authorityDecision']));
    }
  }

  const relaxation = r.evidence.find(e => e.field === 'enforcement.rule33RelaxationGranted' || e.field === 'rule33RelaxationGranted');
  if (relaxation) {
    const value = relaxation.normalizedValue ?? relaxation.rawValue;
    if (value === true || String(value).toLowerCase() === 'true') {
      out.push(finding('PCR-R33-REVIEW', 'PCR-R33', '33', 'UNABLE_TO_VERIFY', 'enforcement.rule33RelaxationGranted', 'A Rule 33 relaxation is indicated. The engine requires the authoritative relaxation decision and its corrective measures before treating a related package requirement as satisfied.', 'Rule 33 is an administrative Central Government relaxation pathway and is not inferred from product evidence.', ['enforcement.relaxationDecision', 'enforcement.correctiveMeasures']));
    }
  }

  const legacy = r.evidence.find(e => e.field === 'enforcement.legacyProceeding' || e.field === 'legacyProceeding');
  if (legacy) {
    const value = legacy.normalizedValue ?? legacy.rawValue;
    if (value === true || String(value).toLowerCase() === 'true') {
      out.push(finding('PCR-R34-REVIEW', 'PCR-R34', '34', 'UNABLE_TO_VERIFY', 'enforcement.legacyProceeding', 'A legacy proceeding or right is indicated. Rule 34 savings must be determined from the authoritative historical proceeding record.', 'Rule 34 preserves specified prior operations, rights, liabilities and proceedings; the package engine cannot resolve those legal consequences automatically.', ['enforcement.legacyProceedingRecord']));
    }
  }

  return out;
}
