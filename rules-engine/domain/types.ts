// domain/types.ts

export type EvaluationStatus =
  | 'PASS'
  | 'VIOLATION'
  | 'UNABLE_TO_VERIFY'
  | 'NOT_APPLICABLE';

export type InspectionContextType =
  | 'physical_package'
  | 'ecommerce_listing'
  | 'both';

export type SeverityLevel =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INFO';

export type RuleLifecycleStatus =
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'DRAFT'
  | 'REQUIRES_LEGAL_REVIEW'
  | 'DISABLED';

export type EvidenceSource =
  | 'OCR'
  | 'BARCODE'
  | 'MANUAL_INPUT'
  | 'IMAGE_INSPECTION'
  | 'PHYSICAL_MEASUREMENT'
  | 'DATABASE';

export type RuleCategory =
  | 'APPLICABILITY'
  | 'GENERAL_DECLARATION'
  | 'NET_QUANTITY'
  | 'MRP'
  | 'DATE'
  | 'DIMENSIONS'
  | 'PRESENTATION'
  | 'MANUFACTURER_PACKER_IMPORTER'
  | 'E_COMMERCE'
  | 'REGISTRATION'
  | 'STANDARD_QUANTITY'
  | 'MEASUREMENT'
  | 'COMMODITY_SPECIFIC'
  | 'PROCEDURAL';

export interface LegalSourceReference {
  sourceId: string;
  notification: string;
  title?: string;
  date: string;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  rule: string;
  subclause?: string;
  sourceDocument: string;
  sourcePage?: number;
  sourceUrl?: string;
  excerpt?: string;
  verificationStatus:
    | 'VERIFIED'
    | 'SECONDARY'
    | 'CONFLICTING'
    | 'REQUIRES_LEGAL_REVIEW';
}

export interface RuleVersion {
  version: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  status: RuleLifecycleStatus;
  legalSources: LegalSourceReference[];
  applicabilityCriteria: ApplicabilityCriteria;
  conditions: RuleCondition[];
  amendmentNote?: string;
}

export interface RuleDefinition {
  ruleId: string;
  ruleCode: string;
  ruleNumber: string;
  subclause?: string;
  title: string;
  description: string;
  category: RuleCategory;
  defaultSeverity: SeverityLevel;
  versions: RuleVersion[];
  enabled: boolean;
}

export interface ApplicabilityCriteria {
  contexts?: InspectionContextType[];
  packageTypes?: (
    | 'retail'
    | 'wholesale'
    | 'multi_unit'
    | 'group'
    | 'combination'
  )[];
  consumerTypes?: (
    | 'general'
    | 'industrial'
    | 'institutional'
  )[];
  excludedConsumerTypes?: (
    | 'industrial'
    | 'institutional'
  )[];
  minQuantity?: { value: number; unit: string };
  maxQuantity?: { value: number; unit: string };
  excludedCommodities?: string[];
  includedCommodities?: string[];
  conditions?: RuleCondition[];
}

export type RuleConditionOperator =
  | 'EXISTS'
  | 'NOT_EXISTS'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'REGEX_MATCH'
  | 'IN_NUMERIC_RANGE'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN_OR_EQUAL'
  | 'VALID_CURRENCY'
  | 'VALID_DATE_FORMAT'
  | 'VALID_UNIT'
  | 'IN_LIST'
  | 'IN_SCHEDULE_II_STANDARD'
  | 'WITHIN_FIRST_SCHEDULE_MPE'
  | 'EVIDENCE_CONFIDENCE'
  | 'DATE_RANGE'
  | 'PACKAGE_TYPE'
  | 'COMMODITY_TYPE'
  | 'CONTEXT_TYPE'
  | 'CONFLICT_EXISTS'
  | 'VISUAL_CHECK';

export interface RuleCondition {
  conditionId: string;
  targetField: string;
  operator: RuleConditionOperator;
  expectedValue?: unknown;
  visualCheckRequired?: boolean;
  minimumConfidence?: number;
  errorMessage: string;
  violationReason: string;
}

export interface EvidenceItem {
  evidenceId: string;
  field: string;
  rawValue: string;
  normalizedValue?: unknown;
  unit?: string;
  confidence: number;
  source: EvidenceSource;
  sourceImageRef?: string;
  boundingBox?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  timestamp: string;
  reliability?: 'HIGH' | 'MEDIUM' | 'LOW';
  metadata?: Record<string, unknown>;
}

export interface EvidenceConflict {
  conflictId: string;
  field: string;
  evidenceIds: string[];
  description: string;
  status: 'UNRESOLVED' | 'RESOLVED';
  resolutionReason?: string;
}

export interface PhysicalMeasurement {
  declaredQuantity: number;
  declaredUnit: string;
  actualQuantity: number;
  actualUnit: string;
  tareWeightGrams?: number;
  numberOfSamplesTested?: number;
  measurementMethod?: string;
  instrumentId?: string;
  measurementUncertainty?: number;
}

export interface ProductMetadata {
  brandName?: string;
  genericName?: string;
  commodityCategory: string;
  commoditySubcategory?: string;
  consumerType?: 'general' | 'industrial' | 'institutional';
  isImported?: boolean;
  countryOfOrigin?: string;
  packageType?:
    | 'retail'
    | 'wholesale'
    | 'multi_unit'
    | 'group'
    | 'combination';
}

export interface PackagingEvidence {
  /** Whether the physical measurement is confirmed to exclude packaging/wrapper material. */
  netQuantityExcludesPackaging?: boolean;
  /** Whether environmental variation is legally relevant to the commodity/package. */
  environmentalVariation?: 'NONE' | 'NEGLIGIBLE' | 'SIGNIFICANT' | 'UNKNOWN';
  /** Whether the package uses the legally relevant "when packed" qualification. */
  quantityQualification?: string;
  /** Evidence-backed indication that this is a wholesale package. */
  wholesalePackage?: boolean;
}

export interface TransactionEvidence {
  /** Actual price charged for the packaged commodity, when a sale is being inspected. */
  salePrice?: number;
  /** Revised MRP communicated/declared for a tax-related price change, when applicable. */
  revisedMrp?: number;
  /** Evidence that a tax revision is relevant to the revised-price procedure. */
  taxRevision?: boolean;
  /** Comparison evidence that identical packages carry conflicting MRPs. */
  identicalPackagePriceConflict?: boolean;
}

export interface EquipmentEvidence {
  retailWeighingMachine?: boolean;
  checkWeigher?: boolean;
}

export interface InspectionRequest {
  inspectionId: string;
  productId: string;
  inspectionDate: string;
  context: InspectionContextType;
  productMetadata: ProductMetadata;
  evidence: EvidenceItem[];
  measurements?: PhysicalMeasurement;
  packaging?: PackagingEvidence;
  transaction?: TransactionEvidence;
  equipment?: EquipmentEvidence;
  visualFlags?: Record<string, boolean>;
  evidenceConflicts?: EvidenceConflict[];
}

export interface Finding {
  findingId: string;
  ruleId: string;
  ruleCode: string;
  ruleNumber: string;
  subclause?: string;
  ruleVersion: number;
  status: EvaluationStatus;
  field?: string;
  message: string;
  violationReason?: string;
  evidenceUsed?: EvidenceItem[];
  missingEvidence?: string[];
  conflicts?: EvidenceConflict[];
  legalReferences: LegalSourceReference[];
  severity: SeverityLevel;
  requiresLegalReview: boolean;
}

export interface InspectionSummary {
  totalRulesEvaluated: number;
  passed: number;
  violations: number;
  unableToVerify: number;
  notApplicable: number;
}

export interface OverallInspectionResult {
  inspectionId: string;
  productId: string;
  inspectionDate: string;
  overallStatus: EvaluationStatus;
  engineVersion: string;
  ruleSetVersion: string;
  summary: InspectionSummary;
  findings: Finding[];
  auditHash: string;
}
