import test from 'node:test';
import assert from 'node:assert/strict';
import { firstScheduleMpe, isSecondScheduleStandard } from '../src/legal/schedules.js';

test('First Schedule MPE passes a 500g package with 497g actual quantity', () => {
  const result = firstScheduleMpe(500, 497, 'g');
  assert.equal(result.applicable, true);
  assert.equal(result.tolerance, 15);
  assert.equal(result.withinTolerance, true);
});

test('First Schedule MPE rejects a 500g package with 480g actual quantity', () => {
  const result = firstScheduleMpe(500, 480, 'g');
  assert.equal(result.applicable, true);
  assert.equal(result.withinTolerance, false);
});

test('First Schedule rounds percentage tolerance to one decimal at or below 1000g', () => {
  const result = firstScheduleMpe(333, 323.0, 'g');
  assert.equal(result.tolerance, 10);
});

test('Second Schedule recognizes standard biscuit quantities', () => {
  assert.equal(isSecondScheduleStandard('Biscuits', 250, 'g').compliant, true);
  assert.equal(isSecondScheduleStandard('Biscuits', 275, 'g').compliant, false);
});

test('Second Schedule recognizes standard mineral-water quantities', () => {
  assert.equal(isSecondScheduleStandard('mineral water', 500, 'mL').compliant, true);
  assert.equal(isSecondScheduleStandard('mineral water', 550, 'mL').compliant, false);
});

test('Unknown commodity is not treated as unrestricted by inference', () => {
  assert.equal(isSecondScheduleStandard('random commodity', 123, 'g').applicable, false);
});
