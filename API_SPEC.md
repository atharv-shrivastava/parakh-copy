# PARAKH API Specification

## 1. API Principles

The API is the contract between the responsive client and backend services. APIs should be resource-oriented, validated, authenticated, documented, and versionable.

Base path:

`/api/v1`

## 2. Authentication

```text
POST /auth/login
POST /auth/logout
GET  /auth/me
```

The exact token/session mechanism may be selected during implementation. Secrets must never be committed to the repository.

## 3. Dashboard

```text
GET /dashboard/summary
GET /dashboard/recent-inspections
GET /dashboard/compliance-trends
```

## 4. Shops

```text
GET    /shops
POST   /shops
GET    /shops/{shop_id}
PATCH  /shops/{shop_id}
GET    /shops/{shop_id}/inspections
GET    /shops/{shop_id}/products
GET    /shops/{shop_id}/statistics
```

Supported filters should include location, date range, and status where relevant.

## 5. Categories

```text
GET    /categories/tree
POST   /categories
GET    /categories/{category_id}
PATCH  /categories/{category_id}
```

## 6. Products

```text
GET    /products
POST   /products
GET    /products/{product_id}
PATCH  /products/{product_id}
GET    /products/{product_id}/inspections
```

Filters:

- Category
- Subcategory
- Product type
- Brand
- Product name
- Pack size

## 7. Scanning

```text
POST /scans
POST /scans/{scan_id}/images
GET  /scans/{scan_id}
POST /scans/{scan_id}/process
GET  /scans/{scan_id}/status
```

A scan should not block the HTTP request while a long AI operation executes. Processing can be asynchronous.

## 8. Extraction

```text
GET  /inspections/{inspection_id}/items/{item_id}/extractions
PATCH /inspections/{inspection_id}/items/{item_id}/extractions/{field_id}
```

Corrections must preserve the original AI extraction in the audit history.

## 9. Compliance

```text
GET /inspections/{inspection_id}/items/{item_id}/checks
POST /compliance/evaluate/{inspection_item_id}
GET /compliance/rules
```

## 10. Verification

```text
POST /compliance/checks/{check_id}/verify
POST /extractions/{field_id}/verify
```

Verification payloads should include the decision and optional reason/correction.

## 11. Inspections

```text
GET    /inspections
POST   /inspections
GET    /inspections/{inspection_id}
PATCH  /inspections/{inspection_id}
POST   /inspections/{inspection_id}/complete
GET    /inspections/{inspection_id}/evidence
```

Filters:

- Date range
- Shop
- Location
- Product
- Brand
- Category
- Compliance status
- Violation type
- Officer

## 12. Reports

```text
POST /inspections/{inspection_id}/reports
GET  /reports/{report_id}
GET  /reports/{report_id}/download
```

Supported prototype formats:

- PDF
- Editable document format

## 13. Analytics

```text
GET /analytics/overview
GET /analytics/by-category
GET /analytics/by-product
GET /analytics/by-brand
GET /analytics/by-location
GET /analytics/by-shop
GET /analytics/violations
```

## 14. Administration

```text
GET   /admin/users
POST  /admin/users
PATCH /admin/users/{user_id}
GET   /admin/rules
POST  /admin/rules
PATCH /admin/rules/{rule_id}
```

Only authorized roles can access administrative endpoints.

## 15. Error Format

Use a consistent structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation",
    "details": {}
  }
}
```

Do not return stack traces or secrets to clients.

## 16. Pagination

List endpoints should support pagination. Example query parameters:

`?page=1&page_size=25`

Large lists should never require the client to download the complete database.

## 17. Filtering

Filtering parameters should use predictable names and documented semantics. Date ranges should use an unambiguous ISO format.

## 18. File Uploads

Uploads must validate:

- MIME type
- File size
- Image dimensions
- Extension

Never trust a client-provided filename or MIME type alone.

## 19. API Security

Every protected endpoint should perform authentication and authorization. Server-side validation is mandatory even when the frontend validates the same input.
