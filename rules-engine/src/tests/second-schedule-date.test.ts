import test from 'node:test';
import assert from 'node:assert/strict';
import { secondScheduleAppliesOn } from '../legal/second-schedule.js';
import { evaluateInspectionComplete } from '../engine/legal-dealer-rules.js';
import type { InspectionRequest } from '../../domain/types.js';

test('Second Schedule applies through 30 September 2022', () => {
  assert.equal(secondScheduleAppliesOn('2022-09-30'), true);
});

test('Second Schedule does not apply from 1 October 2022', () => {
  assert.equal(secondScheduleAppliesOn('2022-10-01'), false);
  assert.equal(secondScheduleAppliesOn('2026-09-01'), false);
});

test('current inspection does not create historical Second Schedule violation', () => {
  const inspection: InspectionRequest = {
    inspectionId: 'schedule-date-current',
    productId: 'p1',
    inspectionDate: '2026-09-01',
    context: 'physical_package',
    productMetadata: { commodityCategory: 'biscuits' },
    declarations: { netQuantity: 110, netQuantityUnit: 'g' },
    evidence: []
  };
  const result = evaluateInspectionComplete(inspection);
  assert.equal(result.findings.some(f => f.ruleCode === 'PCR-R5-SCHEDULE-II'), false);
});
