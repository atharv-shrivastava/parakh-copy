import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

const SOURCE = SOURCES.PRINCIPAL_2011;
const REQUIRED_FIELDS = [
  ['manufacturerOrPacker', '6(1)(a)', 'Manufacturer/packer/importer name and address declaration'],
  ['commonGenericName', '6(1)(b)', 'Common or generic name of the commodity'],
  ['netQuantity', '6(1)(c)', 'Net quantity in the prescribed standard unit or number'],
  ['dateOfManufacturePackingImport', '6(1)(d)', 'Month and year of manufacture, pre-packing or import, subject to commodity-specific exceptions'],
  ['retailSalePrice', '6(1)(e)', 'Retail sale price declaration, subject to the rule exceptions'],
] as const;

function value(r: InspectionRequest, field: string): unknown {
  const parts = field.split('.');
  let current: unknown = r;
  for (const part of parts) current = current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined;
  if (current !== undefined) return current;
  const e = r.evidence.find(x => x.field === field || x.field === `declarations.${field}` || x.field === field.replace(/^declarations\./, ''));
  return e?.normalizedValue ?? e?.rawValue;
}
function present(v: unknown): boolean { if (v === undefined || v === null) return false; if (typeof v === 'string') return v.trim().length > 0; return true; }
function result(id: string, code: string, number: string, status: EvaluationStatus, field: string, message: string, missing?: string[]): Finding {
  return { findingId: id, ruleId: code, ruleCode: code, ruleNumber: number, ruleVersion: 1, status, field, message, missingEvidence: missing, legalReferences: [SOURCE], severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH', requiresLegalReview: false };
}
export function declarationFindings(r: InspectionRequest): Finding[] {
  const out: Finding[] = [];
  const declarations = r.declarations;
  const imported = value(r, 'productMetadata.imported') === true || String(value(r, 'productMetadata.imported')).toLowerCase() === 'true';
  for (const [field, number, label] of REQUIRED_FIELDS) {
    if (field === 'manufacturerOrPacker' && imported) {
      const importer = value(r, 'declarations.importerNameAddress');
      if (!present(importer)) out.push(result(`PCR-R6-1A-IMPORTER-${number}`, 'PCR-R6-1A', '6(1)(a)', 'UNABLE_TO_VERIFY', 'declarations.importerNameAddress', 'Imported package evidence does not establish the importer name and address.', ['declarations.importerNameAddress']));
      else out.push(result('PCR-R6-1A-IMPORTER-PASS', 'PCR-R6-1A', '6(1)(a)', 'PASS', 'declarations.importerNameAddress', 'Importer name and address declaration is present in the supplied evidence.'));
      continue;
    }
    const v = declarations?.[field] ?? value(r, `declarations.${field}`);
    if (!present(v)) out.push(result(`PCR-R6-${field}-UNVERIFIED`, `PCR-R6-${number}`, number, 'UNABLE_TO_VERIFY', `declarations.${field}`, `${label} was not established by the supplied evidence.`, [`declarations.${field}`]));
    else out.push(result(`PCR-R6-${field}-PASS`, `PCR-R6-${number}`, number, 'PASS', `declarations.${field}`, `${label} is present in the supplied evidence.`));
  }
  const soldByNumber = value(r, 'productMetadata.soldByNumber') === true || String(value(r, 'productMetadata.soldByNumber')).toLowerCase() === 'true';
  const netUnit = String(value(r, 'declarations.netQuantityUnit') ?? '').toLowerCase();
  if (soldByNumber || netUnit === 'number' || netUnit === 'unit' || netUnit === 'piece' || netUnit === 'pieces') {
    const count = value(r, 'declarations.quantityText') ?? value(r, 'declarations.netQuantityText');
    if (!present(count)) out.push(result('PCR-R6-1C-NUMBER-UNVERIFIED', 'PCR-R6-1C', '6(1)(c)', 'UNABLE_TO_VERIFY', 'declarations.quantityText', 'The package is quantity-declared by number, but the numerical quantity evidence is missing.', ['declarations.quantityText']));
  }
  const dimensionsRelevant = value(r, 'productMetadata.dimensionsRelevant');
  if (dimensionsRelevant === true || String(dimensionsRelevant).toLowerCase() === 'true') {
    const dimensions = value(r, 'declarations.dimensions');
    if (!present(dimensions)) out.push(result('PCR-R6-1F-UNVERIFIED', 'PCR-R6-1F', '6(1)(f)', 'UNABLE_TO_VERIFY', 'declarations.dimensions', 'Dimensions are relevant to the commodity, but the required dimensions declaration was not established.', ['declarations.dimensions']));
    else out.push(result('PCR-R6-1F-PASS', 'PCR-R6-1F', '6(1)(f)', 'PASS', 'declarations.dimensions', 'The dimensions declaration is present for a commodity for which dimensions are relevant.'));
  }
  const contact = value(r, 'declarations.consumerComplaintContact');
  if (contact !== undefined) {
    if (!present(contact)) out.push(result('PCR-R6-2-UNVERIFIED', 'PCR-R6-2', '6(2)', 'UNABLE_TO_VERIFY', 'declarations.consumerComplaintContact', 'A consumer-complaint contact field was supplied but contains no usable contact information.', ['declarations.consumerComplaintContact']));
    else out.push(result('PCR-R6-2-PASS', 'PCR-R6-2', '6(2)', 'PASS', 'declarations.consumerComplaintContact', 'Consumer complaint contact information is present in the supplied evidence.'));
  }
  return out;
}
