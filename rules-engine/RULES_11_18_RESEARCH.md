# Rules 11-18 Legal Research

This document records the verified legal scope for the next executable Rules Engine tranche. It is research data, not a substitute for the Gazette text.

## Rule 11 - General provisions relating to declaration of quantity

Rule 11 requires the declared net quantity to exclude wrappers and materials other than the commodity. Where the commodity is not expected to vary in weight or measure because of environmental conditions, the declared quantity must correspond to the net quantity received by the consumer and must not be qualified by wording such as `when packed`.

Where a commodity is likely to undergo environmental variation and the variation is negligible, the declared quantity must account for the variation so that the consumer receives not less than the declared net quantity. The declaration must not be qualified by `when packed` in that case.

Where significant variation can occur because of environmental or other conditions, the quantity declaration may be qualified by `when packed`, for commodities specified in the Third Schedule.

Engine implication: Rule 11 must not be reduced to a simple declared-versus-single-measurement comparison. The evaluator needs commodity variation classification and, where applicable, the Third Schedule qualification. Missing classification or insufficient measurement evidence must produce `UNABLE_TO_VERIFY` rather than an invented conclusion.

## Rule 12 - Manner in which declaration of quantity shall be made

The quantity declaration must use the prescribed unit of weight, measure or number. The rule also contains specific presentation requirements for units, fractions, decimal declarations and commodity-specific quantity forms. These requirements must be implemented from the verified current rule text rather than approximated from general unit validation.

Rule 12(6), effective from 1 July 2012 following G.S.R. 784(E), requires that the quantity declaration not contain words or expressions creating an exaggerated, misleading or inadequate impression as to the quantity.

Engine implication: generic unit validation is not sufficient to claim complete Rule 12 compliance. The existing Rule 12(6) visual gate should remain separate from future structured unit/presentation checks.

## Rule 13 - Declarations to be made on wholesale packages

Wholesale-package declarations are distinct from retail-package declarations. The engine must first establish that the inspected package is a wholesale package before applying this rule. The 2021 amendment also changed the wording for items sold by number so that the number/unit/piece/pair/set or other appropriate word representing package quantity is used.

Engine implication: do not apply Rule 13 automatically to every package. Wholesale-package status and the applicable quantity representation must be evidence-backed.

## Rules 14-17

These rules contain package/declaration requirements and commodity/package-specific treatment that must be transcribed against the current consolidated text and amendment chain before automatic enforcement is enabled. They are therefore tracked as research-required in this release.

## Rule 18 - Provisions relating to wholesale and retail dealers

Rule 18(1) prohibits a wholesale dealer, retail dealer or importer from selling, distributing, delivering, displaying or storing for sale a packaged commodity unless the package complies with the Act and Rules.

Rule 18(1A) permits a wholesale dealer to sell pre-packaged commodities directly to industrial and institutional consumers.

Rule 18(2) prohibits sale of a packaged commodity at a price exceeding its retail sale price.

Rule 18(2A) prohibits a manufacturer, packer or importer from declaring different maximum retail prices on an identical pre-packaged commodity through restrictive or unfair trade practices, subject to the wording of the rule and applicable law.

Rule 18 contains additional provisions concerning revised prices following tax changes and other dealer obligations. These procedural provisions must be evaluated using the legally applicable version and evidence of the relevant tax/pricing event. The engine must not infer a historical price-relaxation permission merely from a changed tax rate.

Rule 18 also contains requirements concerning weighing/check-weighing facilities for specified retail and LPG contexts. These are operational inspection requirements and should be represented as physical/equipment evidence rather than OCR-only declarations.

## Evidence model required for this tranche

Recommended evidence fields include:

- `package.packageType`
- `package.wholesalePackage`
- `package.environmentalVariation`
- `package.variationSignificance`
- `declarations.netQuantity`
- `declarations.netQuantityUnit`
- `declarations.quantityExpression`
- `declarations.quantityQualification`
- `declarations.numberQuantityWord`
- `transaction.salePrice`
- `transaction.mrp`
- `transaction.revisedMrp`
- `transaction.taxRevision`
- `transaction.identicalPackagePriceConflict`
- `equipment.retailWeighingMachine`
- `equipment.checkWeigher`

These fields are suggestions for future structured evidence. They are not legal conclusions by themselves.

## Verification rule

The Department of Consumer Affairs archive is the authoritative discovery source for the Packaged Commodities Rules and amendments. Individual Gazette notifications control exact wording, effective dates and transitional provisions. The current DCA archive lists the principal Rules and amendment series through 2026.

No Rule 14-17 executable rule should be promoted solely from secondary summaries. Until their current text and amendments are fully transcribed, the engine should report `UNABLE_TO_VERIFY` where those provisions are materially relevant.
