# PARAKH Database Schema

## 1. Purpose

This document defines the canonical logical data model for PARAKH. The schema separates reusable master data from individual inspection events and preserves the evidence and verification history required for accountable enforcement workflows.

## 2. Core Principles

- Products are reusable catalogue entities.
- Product variants represent pack-size or other meaningful variants.
- Shops are independent from inspections.
- An inspection is a time-bound event involving a shop, officer, and one or more products.
- Extracted values are not automatically trusted as legal facts.
- Compliance checks reference explicit rule versions.
- Verification records preserve human decisions.
- Evidence is linked to the finding and source image.
- Audit logs preserve important system actions.

## 3. Entity Relationship Overview

```text
User ───────────────< Inspection >────────────── Shop
                         │
                         ├──────────────< InspectionItem >──── ProductVariant
                         │                                      │
                         │                                      └── Product ── Category hierarchy
                         │
                         ├──────────────< InspectionImage
                         │
                         └──────────────< ComplianceCheck >──── ComplianceRule
                                                   │
                                                   ├────< Evidence
                                                   └────< VerificationRecord >──── User

Shop ───────────────< ShopVisit / Inspection

User ───────────────< AuditLog
```

## 4. Users

Fields:

- id
- name
- email/username
- password_hash or external identity reference
- role_id
- status
- created_at
- updated_at
- last_login_at

## 5. Roles

Fields:

- id
- name
- description

Initial roles:

- INSPECTOR
- ADMIN

Future roles may include reviewer, supervisor, auditor, or system administrator.

## 6. Shops

Fields:

- id
- name
- owner/reference information where legally appropriate
- address
- city
- district
- state
- postal_code
- latitude
- longitude
- status
- created_by
- created_at
- updated_at

A shop should have a stable identifier so that inspection history can be aggregated over time.

## 7. Categories

Categories form a tree rather than hard-coded columns.

Fields:

- id
- parent_id nullable
- name
- category_level
- category_type
- status
- created_by
- created_at
- updated_at

Example:

```text
Food
└── Ready to Eat
    └── Chips
```

The same model supports non-food areas such as utensils and cleaning products.

## 8. Brands

Fields:

- id
- name
- normalized_name
- status
- created_at
- updated_at

Brand is separate from product category.

## 9. Products

Fields:

- id
- category_id
- brand_id
- product_type_id/reference
- name
- normalized_name
- description
- status
- created_by
- created_at
- updated_at

## 10. Product Variants

Fields:

- id
- product_id
- pack_size_value
- pack_size_unit
- variant_name
- identifier/reference where available
- status
- created_at
- updated_at

Example:

`Lay's Classic Salted → 50 g`

and

`McCain Frozen French Fries → 500 g`

are separate variants of their respective products.

## 11. Inspections

Fields:

- id
- inspection_number
- shop_id
- officer_id
- started_at
- completed_at
- latitude
- longitude
- status
- overall_status
- notes
- created_at
- updated_at

An inspection can contain multiple inspection items.

## 12. Inspection Items

Fields:

- id
- inspection_id
- product_variant_id nullable
- detected_product_name
- classification_status
- officer_classification_status
- processing_status
- overall_compliance_status
- created_at
- updated_at

A nullable product reference allows an unknown product to be processed before catalogue registration.

## 13. Inspection Images

Fields:

- id
- inspection_item_id
- storage_key/path
- original_filename
- mime_type
- file_size
- image_width
- image_height
- capture_timestamp
- image_side/reference
- quality_score
- quality_status
- created_at

The database stores metadata; actual image bytes should use controlled file/object storage.

## 14. Extracted Fields

Fields:

- id
- inspection_item_id
- field_name
- raw_value
- normalized_value
- confidence_score
- source_image_id
- bounding_box
- extraction_method
- verification_status
- verified_value
- verified_by
- verified_at
- created_at
- updated_at

This structure supports explainability and correction without overwriting the original AI extraction.

## 15. Compliance Rules

Fields:

- id
- rule_code
- title
- requirement_text
- category_scope
- applicability_expression/reference
- validation_type
- validation_parameters JSON
- evidence_requirements JSON
- source_reference
- version
- effective_from
- effective_to nullable
- status
- created_at
- updated_at

Rules should be versioned so that historical inspections remain understandable even when the rule set changes.

## 16. Compliance Checks

Fields:

- id
- inspection_item_id
- rule_id
- result
- actual_value
- expected_condition
- confidence_score nullable
- explanation
- evaluated_at
- engine_version
- verification_status
- created_at
- updated_at

Possible results:

- COMPLIANT
- POTENTIAL_NON_COMPLIANCE
- NEEDS_MANUAL_VERIFICATION
- NOT_APPLICABLE
- UNABLE_TO_DETERMINE

## 17. Evidence

Fields:

- id
- compliance_check_id
- inspection_image_id nullable
- evidence_type
- storage_key/path nullable
- text_excerpt nullable
- bounding_box nullable
- description
- created_at

## 18. Verification Records

Fields:

- id
- target_type
- target_id
- previous_status
- new_status
- corrected_value nullable
- decision
- reason
- verified_by
- verified_at

This should be append-oriented rather than simply overwriting history.

## 19. Violations

A violation can be represented through a compliance check, but a separate normalized record can be useful for reporting.

Fields:

- id
- inspection_item_id
- compliance_check_id
- violation_code
- title
- severity
- status
- officer_confirmed
- confirmed_by
- confirmed_at
- notes

## 20. Reports

Fields:

- id
- inspection_id
- report_number
- format
- storage_key/path
- generated_by
- generated_at
- template_version
- checksum/reference

## 21. Audit Logs

Fields:

- id
- actor_id
- action
- entity_type
- entity_id
- timestamp
- metadata JSON
- request_reference

Avoid storing unnecessary sensitive information in logs.

## 22. Recommended Indexes

Important indexes include:

- shops by city/district/state
- inspections by shop_id
- inspections by officer_id
- inspections by started_at
- inspection items by product_variant_id
- products by normalized_name
- brands by normalized_name
- categories by parent_id
- compliance checks by rule_id and result
- audit logs by actor_id and timestamp

## 23. Search

Prototype search can use PostgreSQL text search and normalized fields. Do not introduce Elasticsearch solely for demonstration unless scale or fuzzy search requirements justify it.

## 24. Data Retention

Retention policies should be configurable. Inspection evidence and audit records should not be casually deleted because they may support enforcement history.

## 25. Migration Strategy

Use a migration tool such as Alembic. Never modify production schema manually without a migration.

## 26. Seed Data

The prototype should include a clearly labelled demo dataset containing:

- Representative categories
- Sample brands/products
- Sample shops
- Representative compliance rules
- Demo inspection records

Demo data must be clearly distinguishable from real enforcement data.
