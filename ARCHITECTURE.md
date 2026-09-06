# PARAKH Technical Architecture

## 1. Architecture Goals

PARAKH separates presentation, API/business logic, OCR/AI processing, compliance rules, persistence, evidence, reporting, and analytics.

The application is intentionally modular while remaining practical for an SIH prototype.

The AI layer must not become the application's source of truth.

## 2. Current High-Level Architecture

```text
┌───────────────────────────────────────────────────────────────┐
│                         PARAKH CLIENT                         │
│ React + Vite + React Router                                  │
│ Responsive UI / themes / cached GET data                     │
│ Dashboard | Scan | Shops | Products | History | Reports      │
│ E-commerce | Admin                                           │
└───────────────────────────────┬───────────────────────────────┘
                                │ REST / JSON / multipart
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                     NODE + EXPRESS BACKEND                    │
│ Auth | Business Logic | Products | Shops | Categories         │
│ Inspections | Rules | Analytics | Reports | E-commerce        │
└───────────────┬────────────────────┬──────────────────────────┘
                │                    │
                │                    ├───────────────┐
                ▼                    ▼               ▼
        ┌──────────────┐    ┌────────────────┐  ┌──────────────┐
        │ PostgreSQL   │    │ OCR / AI       │  │ Evidence /   │
        │ via Prisma   │    │ processing     │  │ report data  │
        └──────────────┘    └───────┬────────┘  └──────────────┘
                                    │
                                    ▼
                          ┌──────────────────────┐
                          │ Compliance Engine    │
                          │ Rule evaluation       │
                          │ Evidence + findings   │
                          └──────────────────────┘
```

## 3. Frontend Architecture

Current frontend stack:

- React 19
- Vite
- React Router
- JavaScript/JSX in the current repository
- Shared CSS theme system
- Responsive layouts
- Client-side caching helpers
- jsPDF where client-side report generation is used

The UI currently contains shared layout/theme infrastructure and feature-oriented pages for dashboard, scan, shops, products, history, reports, e-commerce, profile, and administration.

The frontend should reuse shared components and theme variables rather than creating page-specific versions of the same control.

## 4. Backend Architecture

Current backend stack:

- Node.js
- Express 5
- ES modules
- REST endpoints
- Multer
- Sharp
- Prisma 7
- PostgreSQL driver adapter

Current route groups include:

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

The backend owns:

- Authentication and authorization
- Product/category/shop operations
- Inspection persistence
- Rule evaluation
- Analytics aggregation
- OCR/semantic orchestration
- Report-related data operations
- Validation and error handling

## 5. Database Architecture

PostgreSQL stores the structured application state through Prisma.

Logical areas include:

- Users and roles
- Shops
- Category hierarchy
- Products and variants
- Inspections
- Inspection items
- Inspection images
- Extracted fields
- Compliance rules and checks
- Violations
- Evidence
- Verification records
- Reports
- Audit information
- Analytics source data

Analytics are derived from inspection records rather than maintained as manually edited counters.

## 6. OCR / AI Pipeline

The current fast analysis path is:

```text
Input image(s)
      ↓
RapidOCR service
      ↓
OCR evidence
(text + confidence + geometry)
      ↓
Local deterministic reconciliation
      ↓
Semantic provider fan-out
 ├── Gemini
 ├── Cloudflare Gemma
 └── Cloudflare Moondream
      ↓
Semantic consensus
      ↓
Structured result
      ↓
Visual screening + compliance workflow
```

The semantic providers run independently. A failed provider should not prevent the remaining providers from producing a result when enough information is available.

Provider failures are logged with provider/model details in the backend terminal.

## 7. Local Deterministic Reconciliation

The local OCR reconciler maps OCR detections into structured fields using:

- Declaration anchors
- Spatial relationships
- Text similarity
- Confidence
- Product/brand candidate scoring
- Quantity/date/MRP/batch/barcode patterns
- Bounding-box geometry

It preserves uncertainty instead of inventing values.

## 8. Semantic Consensus

Remote semantic providers can produce structured field interpretations and category suggestions.

The consensus layer:

- ignores failed providers
- compares field values across successful providers
- uses majority agreement when available
- marks conflicts as ambiguous
- reduces confidence when only one provider returns a result

AI interpretation therefore acts as an assistive semantic layer rather than a legal decision-maker.

## 9. Image Processing and Evidence

The scanning system retains image-level evidence where available.

Evidence can include:

- OCR text
- confidence
- source image
- bounding box
- semantic field mapping
- declaration evidence
- visual screening information

This enables the UI to show source evidence and supports later verification.

## 10. Product Classification

Classification combines:

1. Existing catalogue matching
2. OCR-derived product/brand information
3. Category hierarchy
4. Semantic suggestions where available
5. Officer confirmation

The canonical hierarchy remains:

`Category → Subcategory → Product Type → Brand → Product → Pack Size / Variant`

## 11. Compliance Engine

Compliance is kept separate from OCR and AI.

```text
Structured product data
        +
Applicable rules
        ↓
Validation
        ↓
Compliance findings
        ↓
Officer verification
```

Deterministic checks should remain deterministic.

The UI must not hard-code legal requirements.

## 12. Human-in-the-Loop

The intended workflow is:

```text
OCR / AI extraction
        ↓
Confidence + evidence
        ↓
Rule evaluation
        ↓
Inspector reviews uncertain values/findings
        ↓
Correct / accept / reject / add manual violation
        ↓
Registration / completion
```

The final legal responsibility remains with the authorized inspector.

## 13. Frontend Data and Performance

The current client keeps successful GET responses in session storage for a short TTL and invalidates the cache after data mutations.

The application uses targeted optimistic UI updates for selected mutations, especially deletions, to avoid unnecessary full-page remounts.

This is a UI/data freshness optimization only. It does not replace server-side persistence.

## 14. Analytics

The dashboard analytics are derived from actual inspection records.

Examples include:

- Inspection counts over time
- Total inspections
- Total violations
- Highest violating shop/source
- Highest violating brand
- Highest violating rule

User-facing analytics are scoped to the authenticated user where applicable. Administrative analytics can be platform-wide.

## 15. Reports

Reports consume structured inspection data and should distinguish:

- AI-extracted data
- Rule-engine results
- Officer-confirmed decisions

## 16. Failure Handling

The runtime must handle:

- OCR failure
- AI provider timeout
- Provider quota/authentication errors
- Missing provider credentials
- Poor image quality
- Unsupported image formats
- Database failures
- Duplicate or invalid data
- Report generation failures

Backend logs should contain technical provider details. User-facing errors should remain understandable.

## 17. Scalability Path

The current prototype is a modular monolith with external/local OCR and semantic providers.

A future scale-out architecture can move OCR/AI work into background workers:

```text
Responsive Client
      ↓
API / Load Balancer
      ↓
Multiple API instances
      ↓
Job Queue → OCR / AI Workers
      ↓
PostgreSQL + Object Storage
```

The prototype does not require this complexity yet.

## 18. Security

- Never commit secrets
- Validate uploads server-side
- Authenticate protected APIs
- Authorize role-sensitive operations
- Preserve evidence and verification history
- Do not expose stack traces or credentials to clients

## 19. Current vs Target Documentation

Earlier versions of PARAKH documentation described a Python/FastAPI implementation. The working repository has since moved to the Node.js/Express runtime described above.

The specification files remain useful for requirements, but implementation details in this document and the source code should be treated as the current technical reference.
