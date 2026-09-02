import type { Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

const SOURCE = SOURCES.AMEND_2026_312E;
const EFFECTIVE_FROM = '2027-07-01';

function evidenceValue(r: InspectionRequest, ...fields: string[]): unknown {
  for (const field of fields) {
    const item = r.evidence.find(e => e.field === field);
    if (item) return item.normalizedValue ?? item.rawValue;
  }
  return undefined;
}

function finding(status: Finding['status'], message: string, reason?: string, missingEvidence?: string[]): Finding {
  return {
    findingId: `PCR-R6-10A-${status}`,
    ruleId: 'PCR-R6-10A',
    ruleCode: 'PCR-R6-10A-COUNTRY-ORIGIN-FILTER',
    ruleNumber: '6(10A)',
    ruleVersion: 1,
    status,
    field: 'ecommerce.countryOfOriginFilter',
    message,
    violationReason: reason,
    missingEvidence,
    legalReferences: [SOURCE],
    severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH',
    requiresLegalReview: false
  };
}

export function ecommerceCountryOriginFinding(r: InspectionRequest): Finding | undefined {
  if (r.inspectionDate.slice(0, 10) < EFFECTIVE_FROM) return undefined;
  if (r.context !== 'ecommerce_listing' && r.context !== 'both') return undefined;

  if (r.productMetadata.isImported === false) return undefined;
  if (r.productMetadata.isImported === undefined) {
    return finding('UNABLE_TO_VERIFY', 'The inspection is an e-commerce listing inspection, but imported-product status was not established.', undefined, ['productMetadata.isImported']);
  }

  const filter = evidenceValue(
    r,
    'ecommerce.countryOfOriginFilter',
    'countryOfOriginFilter',
    'ecommerce.originFilter'
  );

  if (filter === true || String(filter).toLowerCase() === 'true') {
    return finding('PASS', 'The imported-product listing has evidence of a searchable and sortable country-of-origin filter.');
  }
  if (filter === false || String(filter).toLowerCase() === 'false') {
    return finding('VIOLATION', 'The imported-product listing does not provide the required searchable and sortable country-of-origin filter.', 'Rule 6(10A), as substituted by the Second Amendment Rules, 2026, requires this filter from 1 July 2027.');
  }
  return finding('UNABLE_TO_VERIFY', 'The imported-product listing was identified, but evidence of the required searchable and sortable country-of-origin filter was not supplied.', undefined, ['ecommerce.countryOfOriginFilter']);
}
