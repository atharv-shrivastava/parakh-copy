import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from './sources.js';
import { rule21Findings } from '../engine/rule-21-evaluator.js';

/**
 * Legal provisions whose current consolidated wording has not yet been
 * verified to enforcement-grade standard by the engine's legal-source pass.
 * Rule 21 is implemented separately from this fallback list because its
 * current text has now been verified.
 */
export const UNVERIFIED_RULES = Object.freeze([
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
  const verifiedRule21 = rule21Findings(inspection);
  return [...verifiedRule21, ...UNVERIFIED_RULES.map(ruleNumber => legalReviewFinding(inspection, ruleNumber))];
}
