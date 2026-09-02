import type { RuleDefinition, RuleCondition } from '../../../domain/types.js';
import { SOURCES } from './sources.js';

const c = (conditionId: string, targetField: string, operator: RuleCondition['operator'], errorMessage: string, violationReason: string, expectedValue?: unknown): RuleCondition => ({ conditionId, targetField, operator, errorMessage, violationReason, expectedValue });
const ref = (...ids: (keyof typeof SOURCES)[]) => ids.map(id => SOURCES[id]);
const always = (contexts: RuleDefinition['versions'][number]['applicabilityCriteria']['contexts']) => ({ contexts });

export const RULES: RuleDefinition[] = [
  {
    ruleId: 'PCR-R3', ruleCode: 'PCR-R3-APPLICABILITY', ruleNumber: '3', title: 'Applicability and exclusions',
    description: 'Chapter II requirements do not apply to packages above the stated quantity limits or packages meant for industrial or institutional consumers, subject to the rule text and stated exceptions.',
    category: 'APPLICABILITY', defaultSeverity: 'HIGH', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: {}, conditions: [
      c('r3-industrial','productMetadata.consumerType','EQUALS','Chapter II applicability must be checked for industrial consumers.','Package is identified as intended for an industrial consumer.','industrial'),
      c('r3-institutional','productMetadata.consumerType','EQUALS','Chapter II applicability must be checked for institutional consumers.','Package is identified as intended for an institutional consumer.','institutional')
    ], amendmentNote: 'Applicability is represented as a gate in the evaluator; commodity/package exceptions remain explicit.' }]
  },
  {
    ruleId: 'PCR-R4', ruleCode: 'PCR-R4-DECLARATION', ruleNumber: '4', title: 'Mandatory declarations on pre-packaged commodities',
    description: 'A person shall not pre-pack for sale, distribution or delivery unless the package carries the mandatory declarations required by the Rules, subject to the rule explanations.',
    category: 'GENERAL_DECLARATION', defaultSeverity: 'HIGH', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011','AMEND_2026_418E'), applicabilityCriteria: always(['physical_package','both']), conditions: [
      c('r4-retail-price','declarations.retailSalePrice','EXISTS','Retail sale price evidence is required where Rule 6 applies.','Required retail sale price declaration could not be established.'),
      c('r4-manufacturer','declarations.manufacturerOrPacker','EXISTS','Manufacturer/packer/importer identity is required.','Required manufacturer, packer or importer declaration is missing.'),
      c('r4-generic-name','declarations.commonOrGenericName','EXISTS','Common or generic name is required.','Common/generic commodity name is missing.'),
      c('r4-net-quantity','declarations.netQuantity','EXISTS','Net quantity is required.','Net quantity declaration is missing.')
    ] }]
  },
  {
    ruleId: 'PCR-R6-1-A', ruleCode: 'PCR-R6-1-A-MANUFACTURER', ruleNumber: '6(1)(a)', title: 'Manufacturer, packer and importer declaration',
    description: 'The package must declare the name and complete address of the manufacturer, or manufacturer and packer where different, and importer information for imported packages, subject to applicable exceptions.',
    category: 'MANUFACTURER_PACKER_IMPORTER', defaultSeverity: 'HIGH', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: always(['physical_package','both']), conditions: [
      c('r6-1-a-identity','declarations.manufacturerOrPacker','EXISTS','Manufacturer/packer/importer declaration is missing.','Required identity and address declaration is not established.')
    ] }]
  },
  {
    ruleId: 'PCR-R6-1-B', ruleCode: 'PCR-R6-1-B-GENERIC-NAME', ruleNumber: '6(1)(b)', title: 'Common or generic name',
    description: 'The package shall bear the common or generic names of the commodity; multi-product packages require the applicable individual product information.',
    category: 'GENERAL_DECLARATION', defaultSeverity: 'HIGH', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: always(['physical_package','both']), conditions: [c('r6-1-b','declarations.commonOrGenericName','EXISTS','Common/generic name is missing.','Rule 6(1)(b) declaration is not established.')] }]
  },
  {
    ruleId: 'PCR-R6-1-C', ruleCode: 'PCR-R6-1-C-NET-QUANTITY', ruleNumber: '6(1)(c)', title: 'Net quantity declaration',
    description: 'The package shall bear the net quantity in terms of standard unit of weight or measure or in number where the commodity is sold by number.',
    category: 'NET_QUANTITY', defaultSeverity: 'HIGH', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: always(['physical_package','both']), conditions: [
      c('r6-1-c-exists','declarations.netQuantity','EXISTS','Net quantity declaration is missing.','Rule 6(1)(c) net quantity is not established.'),
      c('r6-1-c-unit','declarations.netQuantityUnit','VALID_UNIT','Net quantity unit is invalid or unavailable.','Declared quantity is not expressed in a recognized standard unit.')
    ] }]
  },
  {
    ruleId: 'PCR-R6-1-D', ruleCode: 'PCR-R6-1-D-DATE', ruleNumber: '6(1)(d)', title: 'Month and year declaration',
    description: 'The package shall declare the month and year in which the commodity was manufactured or pre-packed or imported, subject to commodity-specific exceptions.',
    category: 'DATE', defaultSeverity: 'MEDIUM', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: always(['physical_package','both']), conditions: [c('r6-1-d','declarations.manufactureOrImportDate','VALID_DATE_FORMAT','Manufacture/pre-pack/import date is missing or not in a supported format.','Rule 6(1)(d) date declaration could not be verified.')] }]
  },
  {
    ruleId: 'PCR-R6-1-E', ruleCode: 'PCR-R6-1-E-MRP', ruleNumber: '6(1)(e)', title: 'Retail sale price',
    description: 'The package shall bear the retail sale price inclusive of all taxes, with the special treatment prescribed by the Rules for specified commodities.',
    category: 'MRP', defaultSeverity: 'HIGH', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: always(['physical_package','both']), conditions: [c('r6-1-e','declarations.retailSalePrice','VALID_CURRENCY','MRP is missing or cannot be interpreted as a valid currency amount.','Rule 6(1)(e) retail sale price could not be verified.')] }]
  },
  {
    ruleId: 'PCR-R6-1-F', ruleCode: 'PCR-R6-1-F-DIMENSIONS', ruleNumber: '6(1)(f)', title: 'Dimensions where relevant',
    description: 'Where the size of the commodity is relevant, the package shall declare the dimensions in the prescribed manner.',
    category: 'DIMENSIONS', defaultSeverity: 'MEDIUM', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: always(['physical_package','both']), conditions: [c('r6-1-f','declarations.dimensions','EXISTS','Dimension declaration is required where size is relevant.','Required dimensions could not be established.')] }]
  },
  {
    ruleId: 'PCR-R6-2', ruleCode: 'PCR-R6-2-CONSUMER-CONTACT', ruleNumber: '6(2)', title: 'Consumer complaint contact',
    description: 'The package shall provide the prescribed name and address/contact details for consumer complaints, including telephone/email where available under the rule text.',
    category: 'GENERAL_DECLARATION', defaultSeverity: 'MEDIUM', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: always(['physical_package','both']), conditions: [c('r6-2','declarations.consumerComplaintContact','EXISTS','Consumer complaint contact is missing.','Rule 6(2) contact declaration could not be established.')] }]
  },
  {
    ruleId: 'PCR-R6-3', ruleCode: 'PCR-R6-3-STICKER', ruleNumber: '6(3)', title: 'Restrictions on separate stickers',
    description: 'Separate stickers shall not be affixed to make required declarations, except for the permitted reduced revised MRP sticker that does not obscure the original MRP declaration.',
    category: 'PRESENTATION', defaultSeverity: 'MEDIUM', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: always(['physical_package','both']), conditions: [c('r6-3','visual.stickerCompliance','VISUAL_CHECK','Sticker presentation requires visual verification.','A prohibited sticker or an obscured original declaration may be present.',true)] }]
  },
  {
    ruleId: 'PCR-R6-10A-2026', ruleCode: 'PCR-R6-10A-COUNTRY-OF-ORIGIN-FILTER', ruleNumber: '6(10A)', title: 'Country-of-origin filter for imported products on e-commerce',
    description: 'For the period beginning 1 July 2026 and ending 30 June 2027 under G.S.R. 128(E), every e-commerce entity selling imported products must provide searchable and sortable product listings specifying country of origin. From 1 July 2027, the substituted text in the Second Amendment Rules, 2026 applies.',
    category: 'E_COMMERCE', defaultSeverity: 'HIGH', enabled: true,
    versions: [
      { version: 1, effectiveFrom: '2026-07-01', effectiveUntil: '2027-06-30', status: 'SUPERSEDED', legalSources: ref('AMEND_2026_128E'), applicabilityCriteria: always(['ecommerce_listing','both']), conditions: [c('r6-10a-filter','ecommerce.countryOfOriginFilter','VISUAL_CHECK','Country-of-origin searchable/sortable filter is required.','Required country-of-origin filter could not be verified.',true)] },
      { version: 2, effectiveFrom: '2027-07-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('AMEND_2026_312E'), applicabilityCriteria: always(['ecommerce_listing','both']), conditions: [c('r6-10a-filter-2027','ecommerce.countryOfOriginFilter','VISUAL_CHECK','Country-of-origin searchable/sortable filter is required.','The imported product listing does not establish the required country-of-origin filter.',true)] }
    ]
  },
  {
    ruleId: 'PCR-R7', ruleCode: 'PCR-R7-DECLARATION-HEIGHT', ruleNumber: '7', title: 'Principal display panel and declaration dimensions',
    description: 'Declarations on the principal display panel must meet the prescribed area, numeral-height and letter-height requirements, subject to the rule package-size and commodity exceptions.',
    category: 'PRESENTATION', defaultSeverity: 'MEDIUM', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: always(['physical_package','both']), conditions: [c('r7-visual','visual.declarationLegibility','VISUAL_CHECK','Declaration dimensions and principal-display-panel presentation require visual verification.','Required declaration height/placement/legibility could not be verified.',true)] }]
  },
  {
    ruleId: 'PCR-R8', ruleCode: 'PCR-R8-PDP', ruleNumber: '8', title: 'Declarations on principal display panel',
    description: 'Required declarations shall appear on the principal display panel in the prescribed manner, including the clear-space requirements around quantity declarations and special returnable-container treatment.',
    category: 'PRESENTATION', defaultSeverity: 'MEDIUM', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: always(['physical_package','both']), conditions: [c('r8','visual.principalDisplayPanel','VISUAL_CHECK','Principal display panel placement requires visual verification.','Required declarations could not be verified on the principal display panel.',true)] }]
  },
  {
    ruleId: 'PCR-R9', ruleCode: 'PCR-R9-LEGIBILITY', ruleNumber: '9', title: 'Legibility and language of declarations',
    description: 'Declarations must be legible, prominent and presented in the permitted manner; required quantity and MRP declarations must meet contrast/readability requirements.',
    category: 'PRESENTATION', defaultSeverity: 'MEDIUM', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: always(['physical_package','both']), conditions: [c('r9','visual.legibility','VISUAL_CHECK','Legibility requires visual verification.','Required declarations may not be legible or prominent.',true)] }]
  },
  {
    ruleId: 'PCR-R10', ruleCode: 'PCR-R10-MANUFACTURER-ADDRESS', ruleNumber: '10', title: 'Manufacturer/packer/importer address presentation',
    description: 'The name and complete address of the manufacturer, packer or importer must be declared in the prescribed manner, including imported goods packed in India.',
    category: 'MANUFACTURER_PACKER_IMPORTER', defaultSeverity: 'HIGH', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2011-04-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('PRINCIPAL_2011'), applicabilityCriteria: always(['physical_package','both']), conditions: [c('r10','declarations.completeAddress','EXISTS','Complete address is required.','Required manufacturer/packer/importer address could not be established.')] }]
  },
  {
    ruleId: 'PCR-R12-6', ruleCode: 'PCR-R12-6-NON-MISLEADING-QUANTITY', ruleNumber: '12(6)', title: 'Quantity expression must not be exaggerated or misleading',
    description: 'The quantity declaration shall not contain words or expressions that create an exaggerated, misleading or inadequate impression as to the quantity.',
    category: 'NET_QUANTITY', defaultSeverity: 'HIGH', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2012-07-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('AMEND_2011_784E'), applicabilityCriteria: always(['physical_package','both']), conditions: [c('r12-6','declarations.quantityExpression','VISUAL_CHECK','Quantity expression requires visual/context verification.','The quantity expression may create an exaggerated, misleading or inadequate impression.',true)] }]
  },
  {
    ruleId: 'PCR-R26-A-PAN-MASALA', ruleCode: 'PCR-R26-A-PAN-MASALA', ruleNumber: '26(a)', title: 'Pan masala exception',
    description: 'From 1 February 2026, the specified clause of Rule 26(a) does not apply to pan masala under G.S.R. 881(E).',
    category: 'COMMODITY_SPECIFIC', defaultSeverity: 'INFO', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2026-02-01', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('AMEND_2025_881E'), applicabilityCriteria: { includedCommodities: ['pan masala'] }, conditions: [] }]
  },
  {
    ruleId: 'PCR-R27-REGISTRATION', ruleCode: 'PCR-R27-REGISTRATION-DIRECTOR', ruleNumber: '27', title: 'Registration of manufacturer/packer/importer',
    description: 'Registration requirements include the prescribed entity information; the 2026 amendment adds the name of the Director responsible for violations and annual information requirements.',
    category: 'REGISTRATION', defaultSeverity: 'HIGH', enabled: true,
    versions: [{ version: 1, effectiveFrom: '2026-05-29', effectiveUntil: null, status: 'ACTIVE', legalSources: ref('AMEND_2026_418E'), applicabilityCriteria: always(['physical_package','ecommerce_listing','both']), conditions: [
      c('r27-director','registration.responsibleDirector','EXISTS','Responsible Director information is required for applicable registration records.','Name of Director responsible for violations is not established.'),
      c('r27-products','registration.annualProductInformation','EXISTS','Annual product information is required.','Required annual address/product/country-of-origin information is not established.')
    ] }]
  }
];

export const RULESET_VERSION = 'PCR-2011-current-2026-05-29-core-v1';
