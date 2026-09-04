import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

const SOURCE = SOURCES.PRINCIPAL_2011;

function value(r: InspectionRequest, field: string): unknown {
  const direct = field.split('.').reduce<unknown>((v, p) => v != null && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined, r);
  if (direct !== undefined) return direct;
  const e = r.evidence.find(x => x.field === field);
  return e?.normalizedValue ?? e?.rawValue;
}

function finding(id: string, rule: string, status: EvaluationStatus, field: string, message: string, reason?: string, missing?: string[]): Finding {
  return { findingId: id, ruleId: rule, ruleCode: rule, ruleNumber: rule.replace('PCR-R',''), ruleVersion: 1, status, field, message, violationReason: reason, missingEvidence: missing, legalReferences: [SOURCE], severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH', requiresLegalReview: false };
}

/**
 * Rules 7-10 are presentation/placement requirements. The engine deliberately
 * evaluates only structured visual evidence. OCR text alone cannot establish
 * panel placement, prominence, contrast, or physical legibility.
 */
export function rules7to10Findings(r: InspectionRequest): Finding[] {
  if (r.context !== 'physical_package') return [];
  const out: Finding[] = [];

  const capacity = Number(value(r, 'packaging.capacityCm3'));
  const cardOrTape = value(r, 'presentation.smallPackageCardOrTape');
  if (Number.isFinite(capacity) && capacity <= 10) {
    if (cardOrTape === true) out.push(finding('PCR-R7-SMALL-PACKAGE-PASS','PCR-R7-1','PASS','presentation.smallPackageCardOrTape','The package is at or below 10 cm³ and the supplied evidence confirms the required card/tape is firmly affixed.'));
    else if (cardOrTape === false) out.push(finding('PCR-R7-SMALL-PACKAGE-VIOLATION','PCR-R7-1','VIOLATION','presentation.smallPackageCardOrTape','The package is at or below 10 cm³ but the required card/tape presentation is not confirmed.','Rule 7(1) permits the principal display panel to be a firmly affixed card or tape for packages having capacity of 10 cm³ or less.'));
    else out.push(finding('PCR-R7-SMALL-PACKAGE-UNVERIFIED','PCR-R7-1','UNABLE_TO_VERIFY','presentation.smallPackageCardOrTape','The package is at or below 10 cm³, but evidence of the required card/tape presentation is missing',undefined,['presentation.smallPackageCardOrTape']));
  }

  const heightStatus = value(r, 'presentation.numeralHeightCompliance');
  if (heightStatus === true) out.push(finding('PCR-R7-NUMERAL-PASS','PCR-R7-2','PASS','presentation.numeralHeightCompliance','Supplied evidence confirms the required numeral height.'));
  else if (heightStatus === false) out.push(finding('PCR-R7-NUMERAL-VIOLATION','PCR-R7-2','VIOLATION','presentation.numeralHeightCompliance','One or more required numerals do not meet the applicable minimum height under Rule 7.','Rule 7 prescribes minimum numeral/letter heights according to the applicable quantity declaration table.'));
  else if (value(r, 'presentation.numeralHeightMm') !== undefined) out.push(finding('PCR-R7-NUMERAL-UNVERIFIED','PCR-R7-2','UNABLE_TO_VERIFY','presentation.numeralHeightMm','Numeral height measurements were supplied, but the applicable Rule 7 table classification has not been established by the engine.',undefined,['presentation.quantityType','presentation.applicableNumeralHeightMinimumMm']));

  const grouped = value(r, 'presentation.principalDisplayPanelGrouped');
  if (grouped === true) out.push(finding('PCR-R8-PANEL-PASS','PCR-R8-1','PASS','presentation.principalDisplayPanelGrouped','The supplied visual evidence confirms the required declarations are grouped on the principal display panel as applicable.'));
  else if (grouped === false) out.push(finding('PCR-R8-PANEL-VIOLATION','PCR-R8-1','VIOLATION','presentation.principalDisplayPanelGrouped','The supplied evidence indicates required declarations are not presented in a compliant principal-display-panel arrangement.','Rule 8 requires declarations to be made on the principal display panel, subject to its grouping provisions.'));
  else out.push(finding('PCR-R8-PANEL-UNVERIFIED','PCR-R8-1','UNABLE_TO_VERIFY','presentation.principalDisplayPanelGrouped','Principal display panel arrangement cannot be verified from the supplied evidence.',undefined,['presentation.principalDisplayPanelGrouped']));

  const legible = value(r, 'presentation.declarationsLegibleAndProminent');
  if (legible === true) out.push(finding('PCR-R9-LEGIBLE-PASS','PCR-R9-1','PASS','presentation.declarationsLegibleAndProminent','The supplied visual evidence confirms the declarations are legible and prominent.'));
  else if (legible === false) out.push(finding('PCR-R9-LEGIBLE-VIOLATION','PCR-R9-1','VIOLATION','presentation.declarationsLegibleAndProminent','The supplied visual evidence indicates one or more required declarations are not legible and prominent.','Rule 9 requires declarations to be legible and prominent.'));
  else out.push(finding('PCR-R9-LEGIBLE-UNVERIFIED','PCR-R9-1','UNABLE_TO_VERIFY','presentation.declarationsLegibleAndProminent','Legibility and prominence cannot be established without suitable visual evidence.',undefined,['presentation.declarationsLegibleAndProminent']));

  const address = value(r, 'presentation.manufacturerPackerImporterAddressCompliant');
  if (address === true) out.push(finding('PCR-R10-ADDRESS-PASS','PCR-R10-1','PASS','presentation.manufacturerPackerImporterAddressCompliant','The supplied evidence confirms the manufacturer/packer/importer name and address presentation required by Rule 10.'));
  else if (address === false) out.push(finding('PCR-R10-ADDRESS-VIOLATION','PCR-R10-1','VIOLATION','presentation.manufacturerPackerImporterAddressCompliant','The supplied evidence indicates the manufacturer/packer/importer name or address presentation is non-compliant.','Rule 10 requires the applicable manufacturer, packer or importer name and complete address, subject to its package-size and import provisions.'));
  else out.push(finding('PCR-R10-ADDRESS-UNVERIFIED','PCR-R10-1','UNABLE_TO_VERIFY','presentation.manufacturerPackerImporterAddressCompliant','Manufacturer/packer/importer address presentation cannot be verified from the supplied evidence.',undefined,['presentation.manufacturerPackerImporterAddressCompliant']));

  return out;
}
