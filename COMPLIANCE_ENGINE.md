# PARAKH Legal Metrology Compliance Engine

## 1. Purpose

The Compliance Engine is PARAKH's legal/business-rule layer. It evaluates structured inspection information against configured Legal Metrology requirements.

It is intentionally separate from OCR and AI semantic interpretation.

## 2. Legal Scope

The implementation is intended around the Legal Metrology Act, 2009 and the Legal Metrology (Packaged Commodities) Rules, 2011, together with the specific official requirements and amendments adopted into PARAKH's rule set.

Every implemented legal requirement should retain an identifiable source/reference and version information.

## 3. Current Rule Representation

The current database stores rules as `ComplianceRule` records with fields including:

- ruleId
- ruleCode
- ruleNumber
- subclause
- title
- description
- category
- defaultSeverity
- enabled
- isBuiltin
- definition (JSON)
- createdById
- timestamps

The JSON definition is intended to carry machine-readable validation/configuration data.

## 4. Rule Separation

The system separates:

```text
Package image / OCR / AI
        ↓
Structured product data
        ↓
Compliance rules
        ↓
Rule evaluation / finding
        ↓
Officer review
```

Do not put legal decisions inside an LLM prompt or React component.

## 5. Result States

PARAKH should distinguish among:

- compliant
- potential or confirmed violation according to workflow
- needs manual verification
- not applicable
- unable to determine

The exact stored status strings used by the running application remain the implementation authority.

## 6. Deterministic Checks

Use deterministic backend logic for checks such as:

- required field presence
- numeric parsing
- declaration presence
- category applicability
- exact structural conditions

Use AI only where semantic interpretation is actually required.

## 7. Uncertainty

Some photographic evidence cannot establish compliance conclusively.

Examples:

- unclear placement
- poor image quality
- uncertain text
- insufficient scale for exact physical measurement
- conflicting evidence

These should lead to review rather than fabricated certainty.

## 8. Evidence

A finding should be traceable to:

1. Inspection/product
2. Applicable rule
3. Actual extracted value or observation
4. Supporting package evidence where available
5. Explanation
6. Officer decision

## 9. Manual Officer Violations

The scan workflow supports manual violation entry in addition to automated rule findings.

Manual entries must remain distinguishable from automated detections and should remain part of the inspection record.

## 10. Versioning

When a legal requirement changes, create a new rule/version configuration rather than silently changing the interpretation of historical inspections.

## 11. Administration

Built-in rules and administrator-created rules can coexist. Administrative interfaces should protect rule creation/editing with appropriate authorization.

## 12. Testing

Rules should be tested independently of the UI with valid, invalid, missing, ambiguous, and not-applicable cases where relevant.

## 13. Important Limitation

PARAKH is inspection decision support. Its AI and rule output is not itself a final legal determination. The authorized enforcement officer and applicable official procedure remain authoritative.
