import test from 'node:test';
import assert from 'node:assert/strict';
import { firstScheduleTableII } from '../legal/table-ii.js';
import { evaluateInspectionComplete } from '../engine/legal-dealer-rules.js';
import type { InspectionRequest } from '../../domain/types.js';

const base = (): InspectionRequest => ({ inspectionId: 'table-ii-test', productId: 'p1', inspectionDate: '2026-09-01', context: 'physical_package', productMetadata: { commodityCategory: 'cable' }, evidence: [] });

test('Table II length: 10m has 2% tolerance', () => {
  const x = firstScheduleTableII('m', 10, 9.8);
  assert.equal(x.withinTolerance, true);
  assert.equal(x.tolerance, 0.2);
});

test('Table II length: above 10m uses 1%', () => {
  const x = firstScheduleTableII('m', 20, 19.79);
  assert.equal(x.withinTolerance, false);
});

test('Table II area: 10m² has 4% tolerance', () => {
  const x = firstScheduleTableII('m2', 10, 9.6);
  assert.equal(x.withinTolerance, true);
  assert.equal(x.tolerance, 0.4);
});

test('Table II number uses 2%', () => {
  const x = firstScheduleTableII('number', 100, 98);
  assert.equal(x.withinTolerance, true);
});

test('complete evaluator reports Table II violation', () => {
  const r = base();
  r.measurements = { declaredQuantity: 20, declaredUnit: 'm', actualQuantity: 19.7, actualUnit: 'm' };
  const result = evaluateInspectionComplete(r);
  assert.equal(result.findings.some(f => f.ruleCode === 'PCR-SCHED-II-MPE' && f.status === 'VIOLATION'), true);
});
