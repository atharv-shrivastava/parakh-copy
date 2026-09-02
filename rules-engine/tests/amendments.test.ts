import test from 'node:test';
import assert from 'node:assert/strict';
import type { InspectionRequest } from '../domain/types.js';
import { rule26Findings, rule27Findings } from '../src/engine/rules-24-28-evaluator.js';
import { ecommerceCountryOriginFinding } from '../src/engine/ecommerce-country-origin-evaluator.js';

const base = (overrides: Partial<InspectionRequest> = {}): InspectionRequest => ({
  inspectionId: 'amendment-test',
  productId: 'product-001',
  inspectionDate: '2026-09-02',
  context: 'physical_package',
  productMetadata: { commodityCategory: 'food', consumerType: 'general', isImported: false, packageType: 'retail' },
  evidence: [],
  ...overrides
});

test('Rule 26 does not apply the 2026 pan-masala exclusion to historical inspections', () => {
  const result = rule26Findings(base({ inspectionDate: '2026-01-31', productMetadata: { commodityCategory: 'pan masala', consumerType: 'general', isImported: false, packageType: 'retail' }, measurements: { declaredQuantity: 10, declaredUnit: 'g' }, evidence: [{ evidenceId: 'r26', field: 'rule26.exemptionClaimed', normalizedValue: true, rawValue: true, confidence: 1, source: 'MANUAL', timestamp: '2026-01-31T10:00:00Z' }, { evidenceId: 'r26b', field: 'rule26.exemptionBasis', normalizedValue: '10g', rawValue: '10g', confidence: 1, source: 'MANUAL', timestamp: '2026-01-31T10:00:00Z' }] }));
  assert.equal(result[0]?.status, 'PASS');
});

test('Rule 26 rejects the pan-masala small-package exemption from 1 February 2026', () => {
  const result = rule26Findings(base({ inspectionDate: '2026-02-01', productMetadata: { commodityCategory: 'pan masala', consumerType: 'general', isImported: false, packageType: 'retail' }, measurements: { declaredQuantity: 10, declaredUnit: 'g' }, evidence: [{ evidenceId: 'r26', field: 'rule26.exemptionClaimed', normalizedValue: true, rawValue: true, confidence: 1, source: 'MANUAL', timestamp: '2026-02-01T10:00:00Z' }, { evidenceId: 'r26b', field: 'rule26.exemptionBasis', normalizedValue: '10g', rawValue: '10g', confidence: 1, source: 'MANUAL', timestamp: '2026-02-01T10:00:00Z' }] }));
  assert.equal(result[0]?.status, 'VIOLATION');
  assert.equal(result[0]?.legalReferences[0]?.notification, 'G.S.R. 881(E)');
});

test('Rule 6(10A) is inactive before 1 July 2026', () => {
  const result = ecommerceCountryOriginFinding(base({ inspectionDate: '2026-06-30', context: 'ecommerce_listing', productMetadata: { commodityCategory: 'electronics', consumerType: 'general', isImported: true, packageType: 'retail' } }));
  assert.equal(result, undefined);
});

test('Rule 6(10A) uses G.S.R. 128(E) between 1 July 2026 and 30 June 2027', () => {
  const result = ecommerceCountryOriginFinding(base({ inspectionDate: '2026-08-01', context: 'ecommerce_listing', productMetadata: { commodityCategory: 'electronics', consumerType: 'general', isImported: true, packageType: 'retail' }, evidence: [{ evidenceId: 'coo', field: 'ecommerce.countryOfOriginFilter', normalizedValue: false, rawValue: false, confidence: 1, source: 'MANUAL', timestamp: '2026-08-01T10:00:00Z' }] }));
  assert.equal(result?.status, 'VIOLATION');
  assert.equal(result?.legalReferences[0]?.notification, 'G.S.R. 128(E)');
});

test('Rule 6(10A) uses the substituted rule from 1 July 2027', () => {
  const result = ecommerceCountryOriginFinding(base({ inspectionDate: '2027-07-01', context: 'ecommerce_listing', productMetadata: { commodityCategory: 'electronics', consumerType: 'general', isImported: true, packageType: 'retail' }, evidence: [{ evidenceId: 'coo', field: 'ecommerce.countryOfOriginFilter', normalizedValue: false, rawValue: false, confidence: 1, source: 'MANUAL', timestamp: '2027-07-01T10:00:00Z' }] }));
  assert.equal(result?.status, 'VIOLATION');
  assert.equal(result?.legalReferences[0]?.notification, 'Second Amendment Rules, 2026');
});

test('Rule 27 findings cite the 2026 amendment after its effective date', () => {
  const result = rule27Findings(base({ administrative: { rule27RegistrationApplicable: true, rule27Registered: true, rule27RequiredParticularsComplete: true, rule27ResponsibleDirectorDeclared: true, rule27AnnualUpdateComplete: true } } as Partial<InspectionRequest>));
  assert.equal(result[0]?.status, 'PASS');
  assert.ok(result[0]?.legalReferences.some(x => x.notification === 'G.S.R. 418(E)'));
});
