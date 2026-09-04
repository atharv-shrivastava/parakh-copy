import { createHash } from 'node:crypto';
import type { EvaluationStatus, InspectionRequest, OverallInspectionResult, RuleDefinition } from '../../domain/types.js';
import { evaluateInspectionComplete as evaluateSpecializedInspection } from './legal-dealer-rules.js';
import { evaluateInspection as evaluateConfiguredRules } from './evaluator.js';
import { unitSalePriceFinding } from './unit-sale-price-evaluator.js';

function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
}

function summarize(findings: OverallInspectionResult['findings']) {
  return {
    totalRulesEvaluated: findings.length,
    passed: findings.filter(f => f.status === 'PASS').length,
    violations: findings.filter(f => f.status === 'VIOLATION').length,
    unableToVerify: findings.filter(f => f.status === 'UNABLE_TO_VERIFY').length,
    notApplicable: findings.filter(f => f.status === 'NOT_APPLICABLE').length,
  };
}

export function evaluateInspectionCompleteWithCurrentRules(
  r: InspectionRequest,
  rules?: RuleDefinition[],
): OverallInspectionResult {
  const specialized = evaluateSpecializedInspection(r);
  const configured = rules?.length ? evaluateConfiguredRules(r, rules) : null;
  const configuredIds = new Set((rules ?? []).map(rule => rule.ruleId));

  // Database-managed rule definitions replace the generic rule layer. The
  // specialized evaluators remain for advanced checks whose rule IDs are not
  // represented in the configurable rule catalog.
  const findings = configured
    ? [
        ...specialized.findings.filter(f => !configuredIds.has(f.ruleId)),
        ...configured.findings,
      ]
    : specialized.findings;

  const unitSalePrice = unitSalePriceFinding(r);
  if (unitSalePrice && !findings.some(f => f.findingId === unitSalePrice.findingId)) {
    findings.push(unitSalePrice);
  }

  const summary = summarize(findings);
  const overallStatus: EvaluationStatus = summary.violations > 0
    ? 'VIOLATION'
    : summary.unableToVerify > 0
      ? 'UNABLE_TO_VERIFY'
      : summary.passed > 0
        ? 'PASS'
        : 'NOT_APPLICABLE';

  const result = {
    ...specialized,
    overallStatus,
    summary,
    findings,
    ruleSetVersion: configured ? `DB-${new Date().toISOString().slice(0, 10)}` : specialized.ruleSetVersion,
  };

  return { ...result, auditHash: createHash('sha256').update(canonical(result)).digest('hex') };
}
