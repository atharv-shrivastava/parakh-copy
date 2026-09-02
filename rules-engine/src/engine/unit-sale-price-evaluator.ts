import type { Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

const SOURCE = SOURCES.AMEND_2021_779E;
const EFFECTIVE_FROM = '2022-12-01';
const SECOND_PHASE_FROM = '2027-07-01';

function valueAt(input: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value != null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, input);
}

function evidenceValue(r: InspectionRequest, ...fields: string[]): unknown {
  for (const field of fields) {
    const direct = valueAt(r, field);
    if (direct !== undefined) return direct;
    const item = r.evidence.find(e => e.field === field);
    if (item) return item.normalizedValue ?? item.rawValue;
  }
  return undefined;
}

function quantity(r: InspectionRequest): { value?: number; unit?: string } {
  const direct = valueAt(r, 'declarations.netQuantity');
  const measurement = r.measurements?.[0];
  const value = typeof direct === 'number' ? direct : typeof measurement?.declaredValue === 'number' ? measurement.declaredValue : undefined;
  const unit = typeof valueAt(r, 'declarations.netQuantityUnit') === 'string'
    ? String(valueAt(r, 'declarations.netQuantityUnit'))
    : typeof measurement?.declaredUnit === 'string' ? measurement.declaredUnit : undefined;
  return { value, unit };
}

function finding(status: Finding['status'], message: string, reason?: string, missingEvidence?: string[]): Finding {
  return {
    findingId: `PCR-R6-11-${status}`,
    ruleId: 'PCR-R6-11',
    ruleCode: 'PCR-R6-11-UNIT-SALE-PRICE',
    ruleNumber: '6(11)',
    ruleVersion: 1,
    status,
    field: 'declarations.unitSalePrice',
    message,
    violationReason: reason,
    missingEvidence,
    legalReferences: [SOURCE],
    severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH',
    requiresLegalReview: false
  };
}

export function unitSalePriceFinding(r: InspectionRequest): Finding | undefined {
  const date = r.inspectionDate.slice(0, 10);
  if (date < EFFECTIVE_FROM) return undefined;
  if (r.context !== 'physical_package' && r.context !== 'both') return undefined;

  const declared = evidenceValue(r, 'declarations.unitSalePrice', 'unitSalePrice');
  const { value, unit } = quantity(r);
  if (declared === undefined) return finding('UNABLE_TO_VERIFY', 'Unit sale price declaration was not established.', 'Rule 6(11) requires the applicable unit sale price declaration.', ['declarations.unitSalePrice']);
  if (typeof declared !== 'string' || declared.trim() === '') return finding('UNABLE_TO_VERIFY', 'The unit sale price declaration is not in a readable textual form.', undefined, ['declarations.unitSalePrice']);
  if (value === undefined || !unit) return finding('UNABLE_TO_VERIFY', 'The unit sale price is present, but net quantity and unit are required to verify the prescribed unit basis.', undefined, ['declarations.netQuantity', 'declarations.netQuantityUnit']);

  const normalized = declared.toLowerCase().replace(/₹|rs\.?/g, 'rs').replace(/\s+/g, ' ').trim();
  const numeric = value;
  let expected: RegExp;
  const u = unit.toLowerCase();
  if (u === 'g' || u === 'gram' || u === 'grams') expected = numeric < 1000 ? /per\s*g\b|\/\s*g\b/ : /per\s*kg\b|\/\s*kg\b/;
  else if (u === 'kg' || u === 'kilogram' || u === 'kilograms') expected = numeric >= 1 ? /per\s*kg\b|\/\s*kg\b/ : /per\s*g\b|\/\s*g\b/;
  else if (u === 'm' || u === 'meter' || u === 'metre' || u === 'metres' || u === 'meters') expected = numeric < 1 ? /per\s*cm\b|\/\s*cm\b/ : /per\s*(meter|metre)\b|\/\s*(meter|metre)\b/;
  else if (u === 'cm' || u === 'centimeter' || u === 'centimetre') expected = /per\s*cm\b|\/\s*cm\b/;
  else if (u === 'ml' || u === 'millilitre' || u === 'milliliter') expected = numeric < 1000 ? /per\s*ml\b|\/\s*ml\b/ : /per\s*(litre|liter|l)\b|\/\s*(litre|liter|l)\b/;
  else if (u === 'l' || u === 'litre' || u === 'liter' || u === 'litres' || u === 'liters') expected = numeric >= 1 ? /per\s*(litre|liter|l)\b|\/\s*(litre|liter|l)\b/ : /per\s*ml\b|\/\s*ml\b/;
  else if (u === 'number' || u === 'piece' || u === 'pieces') expected = /per\s*(number|piece|unit)\b|\/\s*(number|piece|unit)\b/;
  else return finding('UNABLE_TO_VERIFY', `The quantity unit “${unit}” is not mapped to a Rule 6(11) unit-sale-price basis.`, undefined, ['declarations.netQuantityUnit']);

  if (!expected.test(normalized)) return finding('VIOLATION', `The unit sale price declaration does not use the prescribed basis for the declared quantity (${value} ${unit}).`, 'Rule 6(11) prescribes the unit basis according to net quantity, length, volume or number.');
  return finding('PASS', date >= SECOND_PHASE_FROM ? 'The unit sale price uses a basis consistent with the post-1 July 2027 Rule 6(11) requirement.' : 'The unit sale price uses a basis consistent with the Rule 6(11) requirement applicable from 1 December 2022.');
}
