import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateInspectionComplete } from '../engine/legal-dealer-rules.js';
import type { InspectionRequest } from '../../domain/types.js';

function request(overrides: Partial<InspectionRequest> = {}): InspectionRequest {
  return {
    inspectionId: 'test-inspection', productId: 'test-product', inspectionDate: '2026-09-02', context: 'physical_package',
    productMetadata: { commodityCategory: 'biscuits', packageType: 'retail' }, evidence: [], ...overrides
  };
}
const ev = (field: string, rawValue: unknown, normalizedValue: unknown = rawValue) => ({ evidenceId: field, field, rawValue, normalizedValue, confidence: 1, source: 'MANUAL_INPUT' as const, timestamp: '2026-09-02T00:00:00Z' });

test('Rule 11 rejects when-packed qualification for no environmental variation', () => {
  const r = evaluateInspectionComplete(request({ packaging: { environmentalVariation: 'NONE', quantityQualification: 'when packed', netQuantityExcludesPackaging: true } }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R11-2')?.status, 'VIOLATION');
});
test('Rule 11 accepts configured Third Schedule commodity with significant variation', () => {
  const r = evaluateInspectionComplete(request({ productMetadata: { commodityCategory: 'soap', packageType: 'retail' }, packaging: { environmentalVariation: 'SIGNIFICANT', quantityQualification: 'when packed', netQuantityExcludesPackaging: true } }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R11-4')?.status, 'PASS');
});
test('Rule 11 does not invent a conclusion when variation classification is missing', () => {
  const r = evaluateInspectionComplete(request({ packaging: { quantityQualification: 'when packed', netQuantityExcludesPackaging: true } }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R11-VARIATION')?.status, 'UNABLE_TO_VERIFY');
});
test('Rule 18(2) passes when sale price equals MRP', () => {
  const r = evaluateInspectionComplete(request({ transaction: { salePrice: 100, identicalPackagePriceConflict: false }, evidence: [ev('declarations.retailSalePrice', '₹100', 100)] }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R18-2')?.status, 'PASS');
});
test('Rule 18(2) flags sale above MRP', () => {
  const r = evaluateInspectionComplete(request({ transaction: { salePrice: 101, identicalPackagePriceConflict: false }, evidence: [ev('declarations.retailSalePrice', '₹100', 100)] }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R18-2')?.status, 'VIOLATION');
});
test('Rule 18(2) is unable to verify when sale price is missing', () => {
  const r = evaluateInspectionComplete(request({ transaction: { identicalPackagePriceConflict: false }, evidence: [ev('declarations.retailSalePrice', '₹100', 100)] }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R18-2')?.status, 'UNABLE_TO_VERIFY');
});
test('Rule 18(2A) flags conflicting MRP evidence', () => {
  const r = evaluateInspectionComplete(request({ transaction: { salePrice: 100, identicalPackagePriceConflict: true }, evidence: [ev('declarations.retailSalePrice', '₹100', 100)] }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R18-2A')?.status, 'VIOLATION');
});
test('Rule 12(6) passes a plain quantity declaration', () => {
  const r = evaluateInspectionComplete(request({ evidence: [ev('declarations.quantityText', 'Net Quantity: 500 g')] }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R12-6')?.status, 'PASS');
});
test('Rule 12(6) flags an obviously approximate quantity expression', () => {
  const r = evaluateInspectionComplete(request({ evidence: [ev('declarations.quantityText', 'Approximately 500 g')] }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R12-6')?.status, 'VIOLATION');
});
test('Rule 13(5)(ii) passes number plus recognised quantity word', () => {
  const r = evaluateInspectionComplete(request({ productMetadata: { commodityCategory: 'clips', packageType: 'retail', soldByNumber: true }, evidence: [ev('declarations.quantityText', '12 pieces')] }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R13-5-II')?.status, 'PASS');
});
test('Rule 13(5)(ii) requires a numerical quantity for items sold by number', () => {
  const r = evaluateInspectionComplete(request({ productMetadata: { commodityCategory: 'clips', packageType: 'retail', soldByNumber: true }, evidence: [ev('declarations.quantityText', 'pieces')] }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R13-5-II')?.status, 'VIOLATION');
});
test('Rule 13(5)(ii) does not overclaim when a number has no recognised quantity word', () => {
  const r = evaluateInspectionComplete(request({ productMetadata: { commodityCategory: 'clips', packageType: 'retail', soldByNumber: true }, evidence: [ev('declarations.quantityText', '12')] }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R13-5-II')?.status, 'UNABLE_TO_VERIFY');
});
test('Rule 6(11) is not applied before 1 December 2022', () => {
  const r = evaluateInspectionComplete(request({ inspectionDate: '2022-11-30', evidence: [ev('declarations.netQuantity', '500 g', 500), ev('declarations.netQuantityUnit', 'g'), ev('declarations.unitSalePrice', '₹0.50 per g')] }));
  assert.equal(r.findings.some(f => f.ruleCode === 'PCR-R6-11-UNIT-SALE-PRICE'), false);
});
test('Rule 6(11) verifies per-gram basis below 1 kg', () => {
  const r = evaluateInspectionComplete(request({ evidence: [ev('declarations.netQuantity', '500 g', 500), ev('declarations.netQuantityUnit', 'g'), ev('declarations.unitSalePrice', '₹0.50 per g')] }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R6-11-UNIT-SALE-PRICE')?.status, 'PASS');
});
test('Rule 6(11) rejects per gram for a 1 kg package', () => {
  const r = evaluateInspectionComplete(request({ evidence: [ev('declarations.netQuantity', '1 kg', 1), ev('declarations.netQuantityUnit', 'kg'), ev('declarations.unitSalePrice', '₹500 per g')] }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R6-11-UNIT-SALE-PRICE')?.status, 'VIOLATION');
});
test('Rule 6(11) returns unable to verify when unit-sale-price evidence is missing', () => {
  const r = evaluateInspectionComplete(request({ evidence: [ev('declarations.netQuantity', '500 g', 500), ev('declarations.netQuantityUnit', 'g')] }));
  assert.equal(r.findings.find(f => f.ruleCode === 'PCR-R6-11-UNIT-SALE-PRICE')?.status, 'UNABLE_TO_VERIFY');
});
