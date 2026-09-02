import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from './sources.js';
import { rule22Findings } from '../engine/rule-22-evaluator.js';
import { rule23Findings } from '../engine/rule-23-evaluator.js';
import { rules24To28Findings } from '../engine/rules-24-28-evaluator.js';

export const UNVERIFIED_RULES = Object.freeze([] as const);

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
  return [
    ...rule22Findings(inspection),
    ...rule23Findings(inspection),
    ...rules24To28Findings(inspection),
  ];
}
