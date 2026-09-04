# PARAKH Legal Metrology Rules Engine Coverage

## Status

This is the first executable legal-core release. It is deliberately conservative: it never invents a missing legal threshold or treats missing OCR/visual evidence as proof of compliance or violation.

## Verified sources used by the executable catalog

- G.S.R. 202(E), 7 March 2011, principal Packaged Commodities Rules, effective 1 April 2011.
- G.S.R. 784(E), 24 October 2011, effective 1 July 2012, including the Rule 12(6), 19(7), 19(8), Rule 26(a) and Fourth Schedule changes represented in this release.
- G.S.R. 881(E), 2 December 2025, effective 1 February 2026, pan masala exception in Rule 26(a).
- G.S.R. 128(E), 13 February 2026, effective 1 July 2026, Rule 6(10A) e-commerce country-of-origin filter.
- Second Amendment Rules, 2026, dated 27 April 2026, effective 1 July 2027, substitution of Rule 6(10A).
- G.S.R. 418(E), 29 May 2026, effective on publication, Rule 4 Explanation-2 and Rule 27 changes.

The Department of Consumer Affairs publishes the principal rules and amendment archive. The consolidated government publication is used as a starting reference, but individual notifications control where a later notification changes an earlier rule.

## Implemented executable areas

The current catalog contains structured implementations for Rules 3, 4, 6(1)(a)-(f), 6(2), 6(3), 6(10A), 7, 8, 9, 10, 12(6), 26(a) pan masala exception and 27, with historical effective dates where verified.

The engine also implements evidence conflict handling, confidence-aware evidence, visual evidence gates, historical rule-version selection, deterministic outcome precedence and an audit hash.

## Intentionally not guessed

The following must be expanded only from verified schedule/notification text before being promoted to automatic legal conclusions:

- Every entry of the First Schedule and all commodity-specific maximum permissible error calculations.
- Every entry and exception of the Second Schedule standard package quantities.
- All commodity-specific provisions and later amendments not yet transcribed into the executable catalog.
- Any legal interpretation that depends on a fact not represented by the inspection evidence model.
- State-specific excise treatment and other external-law dependencies.
- Procedural enforcement powers, penalties and seizure workflows outside the package-compliance evaluation itself.

For these areas, integrations should pass explicit evidence or mark the finding `UNABLE_TO_VERIFY` rather than allowing the AI/OCR layer to guess.

## Important legal-version rule

An inspection date is part of the legal input. The evaluator selects the rule version whose effective interval contains that date. A rule is never evaluated using today's wording for a historical inspection.
