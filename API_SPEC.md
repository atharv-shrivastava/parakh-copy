# PARAKH API Specification

## 1. API Principles
The API is the contract between the responsive React/Vite client and the Node.js/Express backend. Protected resources require authentication/authorization. Current base path is `/api`.

## 2. Current Route Groups
```text
/api/auth
/api/categories
/api/products
/api/shops
/api/rules
/api/admin
/api/analytics
/api/translate
/api/products/ecommerce-ocr
/api/ocr
```
The running source code is authoritative for exact endpoint paths and payloads.

## 3. Authentication
Authentication and authorization are handled by the backend auth routes/middleware. Secrets must never be committed.

## 4. Categories and Products
Category APIs provide the hierarchical catalogue:
`Category → Subcategory → Product Type → Brand → Product → Variant`
Product APIs support catalogue listing, registration, detail/update/delete where authorized, hierarchy relationships, and inspection-linked information.

## 5. Shops
Shop APIs support listing/search, creation, detail, inspection history, products, statistics, and authorized deletion. Statistics are derived from stored inspection data.

## 6. Scanning and OCR
Current fast scan endpoint:
`POST /api/ocr/analyze`

Flow:
```text
Images → RapidOCR → OCR evidence → deterministic field reconciliation
      → Gemini / Cloudflare semantic providers → consensus → structured result
```

Responses can include structured fields, evidence, semantic-provider state/timing, category suggestion, visual screening, and warnings.

## 7. Compliance and Rules
Rule APIs expose the configurable compliance rule set. Compliance logic belongs in the backend/rules layer, not the React UI. Manual violations must remain auditable.

## 8. Analytics
Analytics are derived from real inspection records and include inspection trends, totals, violation totals, highest-violation shop/source, brand, and rule. User views are scoped appropriately; admin views can be platform-wide.

## 9. E-commerce
`/api/products/ecommerce-ocr` handles online listing analysis.

## 10. Administration
`/api/admin` contains authorized administrative operations.

## 11. Error Handling
Preferred shape:
```json
{"error":{"code":"VALIDATION_ERROR","message":"Human-readable explanation","details":{}}}
```
Do not return stack traces or secrets to clients.

## 12. Upload Validation
Server-side validation covers supported MIME types, file size, and image constraints. The current OCR upload path accepts JPEG, PNG, and WebP.

## 13. Caching
The frontend uses short-lived GET caching. Persisted mutations invalidate relevant cache entries so dashboards, shops, products, history, and reports can return current server data without forcing unnecessary full-page remounts.

## 14. Versioning Note
Older documentation described a planned `/api/v1` contract. The current implementation uses `/api`.
