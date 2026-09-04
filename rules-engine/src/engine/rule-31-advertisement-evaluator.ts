import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

const SOURCE = SOURCES.PRINCIPAL_2011;

function finding(status: EvaluationStatus, field: string, message: string, reason?: string, missingEvidence?: string[]): Finding {
  return {
    findingId: `PCR-R31-${status}-${field.replace(/[^A-Za-z0-9]+/g, '-').toUpperCase()}`,
    ruleId: 'PCR-R31',
    ruleCode: 'PCR-R31',
    ruleNumber: '31',
    ruleVersion: 1,
    status,
    field,
    message,
    violationReason: reason,
    missingEvidence,
    legalReferences: [SOURCE],
    severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH',
    requiresLegalReview: false
  };
}

/**
 * Rule 31 applies only when an advertisement mentions the retail sale price.
 * The evaluator intentionally does not infer advertisement facts from ordinary
 * package OCR. Advertisement evidence must be supplied explicitly.
 */
export function rule31AdvertisementFindings(r: InspectionRequest): Finding[] {
  const ad = r.evidence.find(e => e.field === 'advertisement');
  if (!ad) return [];

  const metadata = ad.metadata ?? {};
  const mentionsRetailSalePrice = metadata.mentionsRetailSalePrice;
  if (mentionsRetailSalePrice !== true) return [];

  const netQuantityDeclared = metadata.netQuantityDeclared;
  const netQuantityFontSize = typeof metadata.netQuantityFontSize === 'number' ? metadata.netQuantityFontSize : undefined;
  const mrpFontSize = typeof metadata.mrpFontSize === 'number' ? metadata.mrpFontSize : undefined;

  const findings: Finding[] = [];

  if (netQuantityDeclared === false) {
    findings.push(finding('VIOLATION', 'evidence.advertisement.metadata.netQuantityDeclared', 'The advertisement mentions retail sale price but does not declare the net quantity or number of the commodity.', 'Rule 31(1) requires an advertisement mentioning retail sale price to contain a declaration of net quantity or number.'));
  } else if (netQuantityDeclared === undefined) {
    findings.push(finding('UNABLE_TO_VERIFY', 'evidence.advertisement.metadata.netQuantityDeclared', 'The advertisement mentions retail sale price, but evidence confirming its net quantity or number declaration was not supplied.', undefined, ['evidence.advertisement.metadata.netQuantityDeclared']));
  } else {
    findings.push(finding('PASS', 'evidence.advertisement.metadata.netQuantityDeclared', 'The advertisement mentions retail sale price and the supplied evidence confirms a net quantity or number declaration.'));
  }

  if (netQuantityFontSize !== undefined && mrpFontSize !== undefined) {
    if (netQuantityFontSize !== mrpFontSize) {
      findings.push(finding('VIOLATION', 'evidence.advertisement.metadata.netQuantityFontSize', `The net-quantity font size (${netQuantityFontSize}) differs from the retail-sale-price font size (${mrpFontSize}).`, 'Rule 31(2) requires the font size of the net quantity in the advertisement to be the same as that of the retail sale price.'));
    } else {
      findings.push(finding('PASS', 'evidence.advertisement.metadata.netQuantityFontSize', 'The supplied advertisement measurements show the net-quantity and retail-sale-price font sizes are the same.'));
    }
  } else {
    findings.push(finding('UNABLE_TO_VERIFY', 'evidence.advertisement.metadata.fontSize', 'Font-size measurements for both net quantity and retail sale price were not supplied, so Rule 31(2) cannot be verified.', undefined, ['evidence.advertisement.metadata.netQuantityFontSize', 'evidence.advertisement.metadata.mrpFontSize']));
  }

  return findings;
}
