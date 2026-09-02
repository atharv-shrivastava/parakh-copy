import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from './sources.js';

/**
 * Legal provisions whose current consolidated wording has not yet been
 * verified to enforcement-grade standard by the engine's legal-source pass.
 *
 * These are deliberately represented as data, not executable assumptions.
 * An unverified provision can therefore never silently become a PASS or
 * VIOLATION merely because an inspection happened to contain related fields.
 */
export const UNVERIFIED_RULES = Object.freeze([
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '28',
] as const);

export function ruleRequiresLegalReview(ruleNumber: string): boolean {
  return (UNVERIFIED_RULES as readonly string[]).includes(ruleNumber);
}

export function legalReviewFinding(
  inspection: InspectionRequest,
  ruleNumber: string,
): Finding {
  const source = SOURCES.PRINCIPAL_2011;
  const status: EvaluationStatus = 'UNABLE_TO_VERIFY';
  return {
    findingId: `PCR-R${ruleNumber}-LEGAL-REVIEW`,
    ruleId: `PCR-R${ruleNumber}`,
    ruleCode: `PCR-R${ruleNumber}`,
    ruleNumber,
    ruleVersion: 1,
    status,
    field: 'legal.ruleVerification',
    message: `Rule ${ruleNumber} has not been verified to enforcement-grade current consolidated wording. No substantive compliance conclusion is produced for this rule.`,
    missingEvidence: [`legal.currentText.rule${ruleNumber}`],
    legalReferences: [source],
    severity: 'HIGH',
    requiresLegalReview: true,
  };
}

export function unverifiedRuleFindings(inspection: InspectionRequest): Finding[] {
  return UNVERIFIED_RULES.map(ruleNumber => legalReviewFinding(inspection, ruleNumber));
}
