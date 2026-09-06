# PARAKH Database Schema

## Current implementation
PARAKH currently uses PostgreSQL through Prisma 7 and the PostgreSQL driver adapter.

## Core relationships
```text
User ──< Session
 │
 ├──< Scan ──0..1── Inspection >── Shop
 │                         │
 │                         └── Product ── Category tree
 │
 ├──< Inspection
 ├──< Category
 ├──< Product
 ├──< Shop
 └──< ComplianceRule
```

## User
Fields include `id`, `name`, `email`, `passwordHash`, `role`, and timestamps.

## Session
Stores authenticated session tokens, user ownership, expiry, and creation time.

## Shop
Current fields include `id`, `name`, address/location fields, `sourceType`, optional `ownerId`, and timestamps. Inspections reference shops.

## Category
Categories are a self-referencing tree through `parentId`. Current fields include `name`, `slug`, `isSystem`, `sourceType`, `ownerId`, and `isFinalProductType`.

This supports the application hierarchy:

`Category → Subcategory → Product Type → Brand → Product → Pack Size / Variant`

The current database stores the hierarchy primarily through categories and product records rather than separate Brand/ProductVariant tables.

## Product
Current fields include product/brand names, description, OCR data, net quantity/unit, MRP, barcode, image URL(s), compliance status/reason, source type/URL/site name, owner, category, and timestamps.

## Scan
Stores scan id, image URL, OCR text, status, creation time, and owning worker/user. A scan can be linked to one inspection.

## Inspection
Stores status, notes, inspection time, worker/user, shop, product, and optional unique scan link. Indexes support common shop/product/user/time queries.

## ComplianceRule
Current rule records contain:
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
- definition JSON
- createdById
- timestamps

## Important implementation boundary
Earlier conceptual specifications described richer normalized entities such as separate inspection images, extracted fields, compliance checks, violations, evidence, verification records, and reports. The current Prisma schema is simpler. Do not assume those are separate database tables unless the schema contains them.

Some evidence and OCR/AI metadata currently travel through application JSON/result structures rather than dedicated Prisma models.

## Indexing
The current schema includes indexes for category hierarchy, ownership, shops, products, brand/product names, barcode, compliance status, source type, inspection relationships, timestamps, and rules.

## Migrations
Use **Prisma migrations**, not Alembic.

## Data integrity
Preserve inspection history and catalogue relationships. Apply ownership and authorization rules at the application layer and relational constraints at the database layer.

## Analytics
Dashboard analytics are calculated from real stored inspection records rather than manually maintained counters.
