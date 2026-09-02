import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

function value(r: InspectionRequest, field: string): unknown {
  const direct = field.split('.').reduce<unknown>((v, p) => v != null && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined, r as unknown);
  if (direct !== undefined) return direct;
  const e = r.evidence.find(x => x.field === field);
  return e?.normalizedValue ?? e?.rawValue;
}

function bool(r: InspectionRequest, field: string): boolean | undefined {
  const v = value(r, field);
  if (v === true || String(v).toLowerCase() === 'true') return true;
  if (v === false || String(v).toLowerCase() === 'false') return false;
  return undefined;
}

function finding(rule: string, id: string, status: EvaluationStatus, field: string, message: string, reason?: string, missing?: string[]): Finding {
  return {
    findingId: id,
    ruleId: `PCR-R${rule}`,
    ruleCode: `PCR-R${rule}`,
    ruleNumber: rule,
    ruleVersion: 1,
    status,
    field,
    message,
    violationReason: reason,
    missingEvidence: missing,
    legalReferences: [SOURCES.PRINCIPAL_2011],
    severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH',
    requiresLegalReview: false,
  };
}

/** Rule 24: declarations required on a wholesale package. */
export function rule24Findings(r: InspectionRequest): Finding[] {
  const wholesale = r.productMetadata.packageType === 'wholesale' || bool(r, 'packaging.wholesalePackage') === true;
  if (!wholesale) return [];

  const identity = bool(r, 'rule24.manufacturerImporterOrPackerDeclared');
  const commodity = bool(r, 'rule24.commodityIdentityDeclared');
  const countOrQuantity = bool(r, 'rule24.totalRetailPackagesOrNetQuantityDeclared');
  const otherLaw = bool(r, 'rule24.similarDeclarationRequiredByOtherLaw');

  if (otherLaw === true) {
    return [finding('24', 'PCR-R24-OTHER-LAW', 'PASS', 'rule24.similarDeclarationRequiredByOtherLaw', 'The supplied evidence identifies a corresponding declaration requirement under another law; Rule 24 contains an exception where such a declaration is required under another law.')];
  }

  if (identity === false || commodity === false || countOrQuantity === false) {
    return [finding('24', 'PCR-R24-VIOLATION', 'VIOLATION', 'rule24.declarations', 'The wholesale package is missing one or more declarations required by Rule 24.', 'A wholesale package must bear the prescribed identity/address declaration, commodity identity, and total retail-package count or net quantity in standard units.')];
  }

  const missing: string[] = [];
  if (identity === undefined) missing.push('rule24.manufacturerImporterOrPackerDeclared');
  if (commodity === undefined) missing.push('rule24.commodityIdentityDeclared');
  if (countOrQuantity === undefined) missing.push('rule24.totalRetailPackagesOrNetQuantityDeclared');
  if (missing.length) return [finding('24', 'PCR-R24-UNVERIFIED', 'UNABLE_TO_VERIFY', 'rule24.declarations', 'The package is within Rule 24 scope, but the required wholesale-package declaration evidence is incomplete.', undefined, missing)];

  return [finding('24', 'PCR-R24-PASS', 'PASS', 'rule24.declarations', 'The supplied wholesale-package evidence contains the declarations required by Rule 24.')];
}

/** Rule 25: export packages sold in India must be repacked/relabelled for Chapter II compliance. */
export function rule25Findings(r: InspectionRequest): Finding[] {
  const exportPackage = bool(r, 'rule25.exportPackage');
  const soldInIndia = bool(r, 'rule25.soldInIndia');
  if (exportPackage !== true || soldInIndia !== true) return [];

  const compliant = bool(r, 'rule25.repackedOrRelabelledForChapterII');
  if (compliant === true) return [finding('25', 'PCR-R25-PASS', 'PASS', 'rule25.repackedOrRelabelledForChapterII', 'The export package sold in India is recorded as repacked or relabelled to comply with Chapter II.')];
  if (compliant === false) return [finding('25', 'PCR-R25-VIOLATION', 'VIOLATION', 'rule25.repackedOrRelabelledForChapterII', 'An export package was recorded as being sold in India without the required repacking or relabelling.', 'Rule 25 prohibits sale in India of an export package unless it is repacked/relabelled in accordance with Chapter II.')];
  return [finding('25', 'PCR-R25-UNVERIFIED', 'UNABLE_TO_VERIFY', 'rule25.repackedOrRelabelledForChapterII', 'An export package is recorded as sold in India, but evidence of Chapter II compliant repacking or relabelling is missing.', undefined, ['rule25.repackedOrRelabelledForChapterII'])];
}

/** Rule 26: current exemptions from Chapter II, including the 2026 pan-masala amendment. */
export function rule26Findings(r: InspectionRequest): Finding[] {
  const category = r.productMetadata.commodityCategory.toLowerCase();
  const net = r.measurements?.declaredQuantity;
  const unit = (r.measurements?.declaredUnit ?? '').toLowerCase();
  const exemptionClaimed = bool(r, 'rule26.exemptionClaimed');
  const exemptionBasis = String(value(r, 'rule26.exemptionBasis') ?? '').toLowerCase();

  if (exemptionClaimed !== true && exemptionClaimed !== false) return [];

  if (exemptionClaimed === true) {
    if (category.includes('pan masala') && exemptionBasis.includes('10g')) {
      return [finding('26', 'PCR-R26-PAN-MASALA-VIOLATION', 'VIOLATION', 'rule26.exemptionBasis', 'The claimed small-package exemption is not available to pan masala under the amendment effective 1 February 2026.', 'G.S.R. 881(E) added a proviso to Rule 26(a) excluding pan masala from that clause.')];
    }
    const recognised = ['10g', '10ml', 'fast food', 'restaurant', 'hotel', 'drug', 'scheduled formulation', 'non-scheduled formulation', 'agricultural farm produce'].some(x => exemptionBasis.includes(x));
    if (!recognised) return [finding('26', 'PCR-R26-BASIS-UNVERIFIED', 'UNABLE_TO_VERIFY', 'rule26.exemptionBasis', 'A Rule 26 exemption was claimed, but the supplied exemption basis is not a recognised configured basis.', undefined, ['rule26.exemptionBasis'])];
    if (exemptionBasis.includes('agricultural') && net !== undefined && net <= 50) return [finding('26', 'PCR-R26-AGRI-VIOLATION', 'VIOLATION', 'rule26.exemptionBasis', 'The agricultural farm-produce exemption was claimed for a package not exceeding 50 kg.', 'The former agricultural-produce exemption applied to packages above 50 kg and was subsequently omitted; this engine does not extend it to smaller packages.')];
    return [finding('26', 'PCR-R26-PASS', 'PASS', 'rule26.exemptionBasis', 'The supplied evidence identifies a Rule 26 exemption basis.')];
  }

  if (category.includes('pan masala') && net !== undefined && (unit === 'g' || unit === 'gram' || unit === 'grams') && net <= 10) {
    return [finding('26', 'PCR-R26-PAN-MASALA-NOT-EXEMPT', 'PASS', 'rule26.exemptionClaimed', 'Pan masala is not treated as exempt under the Rule 26(a) small-package exemption, including where the declared quantity is 10 g or less.')];
  }
  return [finding('26', 'PCR-R26-NO-EXEMPTION', 'PASS', 'rule26.exemptionClaimed', 'No Rule 26 exemption was claimed in the supplied inspection evidence.')];
}

/** Rule 28: a shorter manufacturer/packer address is lawful only after registration. */
export function rule28Findings(r: InspectionRequest): Finding[] {
  const used = bool(r, 'rule28.shorterAddressUsed');
  if (used !== true) return [];
  const registered = bool(r, 'rule28.shorterAddressRegistered');
  const identifies = bool(r, 'rule28.shorterAddressIdentifiesEntity');
  if (registered === false) return [finding('28', 'PCR-R28-NOT-REGISTERED', 'VIOLATION', 'rule28.shorterAddressRegistered', 'A shorter address is being used without evidence that it was registered under Rule 28.', 'Rule 28 permits a registered shorter address to be stated on the label only after the prescribed application and registration.')];
  if (registered === undefined || identifies === undefined) return [finding('28', 'PCR-R28-UNVERIFIED', 'UNABLE_TO_VERIFY', 'rule28.shorterAddress', 'A shorter address is being used, but registration and entity-identification evidence is incomplete.', undefined, ['rule28.shorterAddressRegistered', 'rule28.shorterAddressIdentifiesEntity'])];
  if (!identifies) return [finding('28', 'PCR-R28-IDENTITY-VIOLATION', 'VIOLATION', 'rule28.shorterAddressIdentifiesEntity', 'The registered shorter address does not adequately identify the manufacturer or packer.', 'Rule 28 requires the authority to be satisfied that the shorter address is sufficient to identify the manufacturer or packer.')];
  return [finding('28', 'PCR-R28-PASS', 'PASS', 'rule28.shorterAddress', 'The shorter address is recorded as registered and sufficient to identify the manufacturer or packer.')];
}

export function rules24To28Findings(r: InspectionRequest): Finding[] {
  return [...rule24Findings(r), ...rule25Findings(r), ...rule26Findings(r), ...rule28Findings(r)];
}
