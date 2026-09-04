import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

const SOURCE = SOURCES.PRINCIPAL_2011;

type Evidence = { field: string; normalizedValue?: unknown; rawValue?: unknown };

function evidence(r: InspectionRequest, field: string): unknown {
  const direct = field.split('.').reduce<unknown>((v, p) => v != null && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined, r);
  if (direct !== undefined) return direct;
  const e = (r.evidence as Evidence[]).find(x => x.field === field || x.field === field.replace(/^declarations\./, ''));
  return e?.normalizedValue ?? e?.rawValue;
}

function finding(ruleCode: string, ruleNumber: string, status: EvaluationStatus, field: string, message: string, reason?: string, missingEvidence?: string[]): Finding {
  return { findingId: `${ruleCode}-${status}`, ruleId: ruleCode, ruleCode, ruleNumber, ruleVersion: 1, status, field, message, violationReason: reason, missingEvidence, legalReferences: [SOURCE], severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH', requiresLegalReview: false };
}

function bool(v: unknown): boolean | undefined {
  if (v === true || String(v).toLowerCase() === 'true') return true;
  if (v === false || String(v).toLowerCase() === 'false') return false;
  return undefined;
}

function commodityIncludes(r: InspectionRequest, words: string[]): boolean {
  const category = r.productMetadata?.commodityCategory?.toLowerCase() ?? '';
  return words.some(w => category.includes(w));
}

export function rules14To17Findings(r: InspectionRequest): Finding[] {
  const out: Finding[] = [];

  // Rule 14: finished dimensions for specified textile and similar commodities.
  if (commodityIncludes(r, ['bed-sheet', 'bedsheet', 'fabric', 'dhoti', 'saree', 'napkin', 'pillow-cover', 'pillow cover', 'towel', 'table cloth'])) {
    const count = evidence(r, 'declarations.numberOfPieces');
    const dimensions = evidence(r, 'declarations.finishedDimensions');
    if (count === undefined || dimensions === undefined) {
      out.push(finding('PCR-R14', '14', 'UNABLE_TO_VERIFY', 'declarations.finishedDimensions', 'Rule 14 applies to this commodity category, but the required number and finished dimensions were not supplied.', undefined, ['declarations.numberOfPieces', 'declarations.finishedDimensions']));
    } else {
      out.push(finding('PCR-R14', '14', 'PASS', 'declarations.finishedDimensions', 'The required number and finished dimensions evidence is present for the Rule 14 commodity category.'));
    }
    const multi = bool(evidence(r, 'package.containsDifferentDimensions'));
    if (multi === true) {
      const perPiece = bool(evidence(r, 'declarations.eachPieceDimensionsAndPrice'));
      if (perPiece === false) out.push(finding('PCR-R14-MULTI', '14', 'VIOLATION', 'declarations.eachPieceDimensionsAndPrice', 'Packages containing pieces of different dimensions require the dimensions and retail sale price of each piece to be marked on the individual piece.', 'Rule 14 provisos require per-piece dimensions and retail sale price for pieces of different dimensions.'));
      else if (perPiece === undefined) out.push(finding('PCR-R14-MULTI', '14', 'UNABLE_TO_VERIFY', 'declarations.eachPieceDimensionsAndPrice', 'The package contains pieces of different dimensions, but per-piece dimension and retail-sale-price evidence is missing.', undefined, ['declarations.eachPieceDimensionsAndPrice']));
    }
  }

  // Rule 15: dimensions/weight where they have a relationship to price.
  const priceRelated = bool(evidence(r, 'productMetadata.dimensionsOrWeightPriceRelated'));
  if (priceRelated === true) {
    const declared = bool(evidence(r, 'declarations.dimensionsWeightCombinationDeclared'));
    if (declared === true) out.push(finding('PCR-R15', '15', 'PASS', 'declarations.dimensionsWeightCombinationDeclared', 'The required dimensions, weight, or applicable combination is declared where it is related to the commodity price.'));
    else if (declared === false) out.push(finding('PCR-R15', '15', 'VIOLATION', 'declarations.dimensionsWeightCombinationDeclared', 'The package does not declare the dimensions, weight, or applicable combination even though it is identified as price-related.', 'Rule 15 requires the quantity declaration to include the dimensions, weight, or combination where these have a relationship to price.'));
    else out.push(finding('PCR-R15', '15', 'UNABLE_TO_VERIFY', 'declarations.dimensionsWeightCombinationDeclared', 'The package is identified as price-related by dimensions/weight, but the required declaration evidence is missing.', undefined, ['declarations.dimensionsWeightCombinationDeclared']));
  }

  // Rule 16: usable sheet count and dimensions.
  if (commodityIncludes(r, ['aluminium foil', 'aluminum foil', 'facial tissue', 'waxed paper', 'toilet paper', 'sheet'])) {
    const sheets = evidence(r, 'declarations.usableSheetCount');
    const dimensions = evidence(r, 'declarations.sheetDimensions');
    if (sheets === undefined || dimensions === undefined) out.push(finding('PCR-R16', '16', 'UNABLE_TO_VERIFY', 'declarations.usableSheetCount', 'A sheet-type commodity was identified, but the number of usable sheets and dimensions of each sheet were not both supplied.', undefined, ['declarations.usableSheetCount', 'declarations.sheetDimensions']));
    else out.push(finding('PCR-R16', '16', 'PASS', 'declarations.usableSheetCount', 'The required usable-sheet count and sheet dimensions are present.'));
  }

  // Rule 17: container-type commodities.
  if (bool(evidence(r, 'productMetadata.isContainerTypeCommodity')) === true) {
    const shape = String(evidence(r, 'productMetadata.containerShape') ?? '').toLowerCase();
    const count = evidence(r, 'declarations.containerCount');
    const dimensions = evidence(r, 'declarations.containerDimensions');
    if (count === undefined || dimensions === undefined) out.push(finding('PCR-R17', '17', 'UNABLE_TO_VERIFY', 'declarations.containerDimensions', 'A container-type commodity was identified, but the required number and dimensional declaration were not supplied.', undefined, ['declarations.containerCount', 'declarations.containerDimensions']));
    else if (!['bag', 'square', 'oblong', 'rectangular', 'circular', 'round', 'cup', 'pan'].some(x => shape.includes(x))) out.push(finding('PCR-R17', '17', 'UNABLE_TO_VERIFY', 'productMetadata.containerShape', 'The container shape is not mapped to a configured Rule 17 category, so the exact dimensional declaration cannot be determined.', undefined, ['productMetadata.containerShape']));
    else out.push(finding('PCR-R17', '17', 'PASS', 'declarations.containerDimensions', 'The required count and dimensional declaration evidence is present for the configured Rule 17 container category.'));
  }

  return out;
}
