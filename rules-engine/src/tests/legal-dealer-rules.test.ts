import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateInspectionComplete } from '../engine/legal-dealer-rules.js';
import type { InspectionRequest } from '../../domain/types.js';

function request(overrides: Partial<InspectionRequest> = {}): InspectionRequest {
  return {
    inspectionId: 'test-inspection',
    productId: 'test-product',
    inspectionDate: '2026-09-02',
    context: 'physical_package',
    productMetadata: { commodityCategory: 'biscuits', packageType: 'retail' },
    evidence: [],
    ...overrides
  };
}

test('Rule 11 rejects when-packed qualification for no environmental variation', () => {
  const result = evaluateInspectionComplete(request({
    packaging: { environmentalVariation: 'NONE', quantityQualification: 'when packed', netQuantityExcludesPackaging: true }
  }));
  const finding = result.findings.find(f => f.ruleCode === 'PCR-R11-2');
  assert.equal(finding?.status, 'VIOLATION');
});

test('Rule 11 accepts when-packed for configured Third Schedule commodity with significant variation', () => {
  const result = evaluateInspectionComplete(request({
    productMetadata: { commodityCategory: 'soap', packageType: 'retail' },
    packaging: { environmentalVariation: 'SIGNIFICANT', quantityQualification: 'when packed', netQuantityExcludesPackaging: true }
  }));
  const finding = result.findings.find(f => f.ruleCode === 'PCR-R11-4');
  assert.equal(finding?.status, 'PASS');
});

test('Rule 11 does not invent a conclusion when variation classification is missing', () => {
  const result = evaluateInspectionComplete(request({
    packaging: { quantityQualification: 'when packed', netQuantityExcludesPackaging: true }
  }));
  const finding = result.findings.find(f => f.ruleCode === 'PCR-R11-VARIATION');
  assert.equal(finding?.status, 'UNABLE_TO_VERIFY');
});

test('Rule 18(2) passes when sale price equals MRP', () => {
  const result = evaluateInspectionComplete(request({
    transaction: { salePrice: 100, identicalPackagePriceConflict: false },
    evidence: [{ evidenceId: 'mrp', field: 'declarations.retailSalePrice', rawValue: '₹100', normalizedValue: 100, confidence: 1, source: 'MANUAL_INPUT', timestamp: '2026-09-02T00:00:00Z' }]
  }));
  const finding = result.findings.find(f => f.ruleCode === 'PCR-R18-2');
  assert.equal(finding?.status, 'PASS');
});

test('Rule 18(2) flags sale above MRP', () => {
  const result = evaluateInspectionComplete(request({
    transaction: { salePrice: 101, identicalPackagePriceConflict: false },
    evidence: [{ evidenceId: 'mrp', field: 'declarations.retailSalePrice', rawValue: '₹100', normalizedValue: 100, confidence: 1, source: 'MANUAL_INPUT', timestamp: '2026-09-02T00:00:00Z' }]
  }));
  const finding = result.findings.find(f => f.ruleCode === 'PCR-R18-2');
  assert.equal(finding?.status, 'VIOLATION');
});

test('Rule 18(2) is unable to verify when sale price is missing', () => {
  const result = evaluateInspectionComplete(request({
    transaction: { identicalPackagePriceConflict: false },
    evidence: [{ evidenceId: 'mrp', field: 'declarations.retailSalePrice', rawValue: '₹100', normalizedValue: 100, confidence: 1, source: 'MANUAL_INPUT', timestamp: '2026-09-02T00:00:00Z' }]
  }));
  const finding = result.findings.find(f => f.ruleCode === 'PCR-R18-2');
  assert.equal(finding?.status, 'UNABLE_TO_VERIFY');
});

test('Rule 18(2A) flags conflicting MRP evidence', () => {
  const result = evaluateInspectionComplete(request({
    transaction: { salePrice: 100, identicalPackagePriceConflict: true },
    evidence: [{ evidenceId: 'mrp', field: 'declarations.retailSalePrice', rawValue: '₹100', normalizedValue: 100, confidence: 1, source: 'MANUAL_INPUT', timestamp: '2026-09-02T00:00:00Z' }]
  }));
  const finding = result.findings.find(f => f.ruleCode === 'PCR-R18-2A');
  assert.equal(finding?.status, 'VIOLATION');
});
