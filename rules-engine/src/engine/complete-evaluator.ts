import { createHash } from 'node:crypto';
import type { EvaluationStatus, InspectionRequest, OverallInspectionResult, RuleDefinition } from '../../domain/types.js';
import { evaluateInspectionComplete as evaluateLegalInspection } from './legal-dealer-rules.js';
import { unitSalePriceFinding } from './unit-sale-price-evaluator.js';

function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
}

export function evaluateInspectionCompleteWithCurrentRules(
  r: InspectionRequest,
  rules?: RuleDefinition[],
): OverallInspectionResult {
  const base = evaluateLegalInspection(r, rules);
  const unitSalePrice = unitSalePriceFinding(r);
  if (!unitSalePrice) return base;
  const findings = [...base.findings, unitSalePrice];
  const summary = {
    totalRulesEvaluated: findings.length,
    passed: findings.filter(f => f.status === 'PASS').length,
    violations: findings.filter(f => f.status === 'VIOLATION').length,
    unableToVerify: findings.filter(f => f.status === 'UNABLE_TO_VERIFY').length,
    notApplicable: findings.filter(f => f.status === 'NOT_APPLICABLE').length,
  };
  const overallStatus: EvaluationStatus = summary.violations > 0 ? 'VIOLATION' : summary.unableToVerify > 0 ? 'UNABLE_TO_VERIFY' : summary.passed > 0 ? 'PASS' : 'NOT_APPLICABLE';
  const result = { ...base, overallStatus, summary, findings };
  return { ...result, auditHash: createHash('sha256').update(canonical(result)).digest('hex') };
}
