# PARAKH Technical Architecture

## 1. Architecture Goals

PARAKH must be modular, explainable, maintainable, secure, responsive, and practical for an SIH prototype. The architecture should allow the prototype to demonstrate the complete inspection workflow without requiring a national-scale deployment on day one.

The design separates the user interface, application APIs, AI/OCR processing, compliance rules, persistent data, evidence storage, reporting, and analytics. This prevents the AI model from becoming the application's source of truth.

## 2. High-Level Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                     PARAKH CLIENT                           │
│ React + TypeScript + Vite                                   │
│ Responsive UI: Mobile / Tablet / Desktop                   │
│ Dashboard | Scan | Shops | Products | History | Reports     │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS / REST
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND                           │
│ Authentication | Authorization | Business Logic | APIs      │
│ Inspection Service | Shop Service | Product Service         │
│ Report Service | Audit Service                              │
└───────┬──────────────────┬───────────────────┬───────────────┘
        │                  │                   │
        ▼                  ▼                   ▼
┌───────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ PostgreSQL    │  │ AI/OCR Pipeline  │  │ Evidence Storage │
│ Core records  │  │ OCR + CV + NLP   │  │ Package images   │
│ Rules         │  │ Extraction       │  │ Reports          │
│ History       │  │ Classification   │  │ Evidence crops   │
└───────────────┘  └─────────┬────────┘  └──────────────────┘
                             │
                             ▼
                   ┌──────────────────────┐
                   │ Compliance Engine     │
                   │ Versioned rule set    │
                   │ Applicability checks  │
                   │ Validation            │
                   └──────────┬───────────┘
                              ▼
                   ┌──────────────────────┐
                   │ Findings + Confidence │
                   │ Evidence + Rule refs  │
                   └──────────────────────┘
```

## 3. Frontend Architecture

Use React with TypeScript and Vite.

Suggested feature-oriented structure:

```text
frontend/
  src/
    app/
    components/
    layouts/
    features/
      auth/
      dashboard/
      scanning/
      shops/
      products/
      inspections/
      reports/
      analytics/
      administration/
    services/
    hooks/
    types/
    utils/
    assets/
```

The frontend should use reusable components rather than page-specific duplicated UI.

The responsive design should be mobile-first because package scanning is primarily a field activity. Desktop layouts should expose the same capabilities using larger panels, tables, filters, and multi-column views.

## 4. Backend Architecture

Use Python + FastAPI.

Suggested structure:

```text
backend/
  app/
    main.py
    api/
    core/
    models/
    schemas/
    services/
    repositories/
    ai/
    compliance/
    reports/
    security/
    workers/
    utils/
```

Responsibilities:

- API routing
- Authentication and authorization
- Input validation
- Inspection workflow
- Product and shop management
- AI pipeline orchestration
- Compliance evaluation
- Report generation
- Audit logging
- Database access

Business rules should not be hidden inside route handlers.

## 5. AI/OCR Pipeline

The AI pipeline should be treated as a processing service with explicit stages.

```text
Input Images
    ↓
Image Quality Assessment
    ↓
Preprocessing
    ↓
Text / Region Detection
    ↓
OCR
    ↓
Text Normalization
    ↓
Field Extraction
    ↓
Field Confidence Scoring
    ↓
Product Classification
    ↓
Compliance Engine
```

If multiple package images are submitted, the system should maintain image-level evidence and associate extracted fields with their source image and region where possible.

## 6. Image Processing

Before OCR, the pipeline may perform:

- Orientation correction
- Perspective correction
- Cropping
- Resolution checks
- Denoising
- Contrast normalization
- Blur detection
- Glare detection

The system should avoid silently producing low-quality results. If the image is unsuitable, it should request another capture.

## 7. OCR and Extraction

OCR produces raw text and optionally bounding boxes. A separate extraction stage maps the text into structured fields.

Example:

```json
{
  "field": "mrp",
  "value": "₹20",
  "confidence": 0.98,
  "source_image_id": "img_123",
  "source_region": [120, 450, 340, 510]
}
```

This separation allows OCR models to change without rewriting the product and compliance layers.

## 8. Product Classification Architecture

Classification should not depend exclusively on an AI model. The system should combine:

1. Existing catalogue matching
2. OCR-derived brand/product information
3. Category hierarchy
4. Optional AI suggestions
5. Officer confirmation

The canonical hierarchy is:

`Category → Subcategory → Product Type → Brand → Product → Pack Size / Variant`

## 9. Compliance Engine

The compliance engine is deterministic where possible.

```text
Product Record
      +
Extracted Fields
      +
Applicable Rules
      ↓
Validation Functions
      ↓
Compliance Findings
```

AI may assist with extraction and interpretation, but deterministic checks should be used for straightforward validations.

Each finding should store:

- Rule identifier
- Rule version
- Input field(s)
- Expected condition
- Actual value
- Result
- Confidence where relevant
- Evidence reference
- Verification status

## 10. Rule Applicability

Not every requirement applies identically to every commodity. The rule engine must first determine which rules are applicable based on structured product attributes and the configured rule set.

Avoid a single giant conditional function such as `if food and chips and ...`. Rules should be data-driven and modular.

## 11. Human-in-the-Loop Workflow

```text
AI Extraction
     ↓
AI Confidence
     ↓
High confidence ──────→ Automated rule evaluation
     │
Low confidence
     ↓
Officer review
     ↓
Correct / confirm
     ↓
Rule evaluation
```

A finding that requires human review must be visually distinguishable from a confirmed result.

## 12. Evidence Model

Evidence is a first-class object.

Evidence can include:

- Original package image
- Cropped region
- OCR text
- Extracted field
- Rule reference
- Officer note
- Verification action

Evidence should not be deleted simply because an AI finding is rejected; the audit record should preserve what the system originally detected and what the officer decided.

## 13. Database Architecture

PostgreSQL stores structured application data.

Main logical areas:

- Identity and access
- Shops and locations
- Product catalogue
- Inspections
- Images and evidence metadata
- Extracted fields
- Rules
- Compliance checks
- Violations
- Verification
- Reports
- Audit logs

Binary files should preferably be stored in object/file storage, with metadata and references in PostgreSQL.

## 14. API Layer

Use REST APIs with consistent JSON schemas.

Example resource groups:

```text
/api/auth
/api/dashboard
/api/shops
/api/products
/api/categories
/api/inspections
/api/scans
/api/compliance
/api/rules
/api/reports
/api/analytics
/api/admin
```

API contracts should be documented and versionable.

## 15. Authentication and Authorization

Authentication establishes identity. Authorization determines what that identity can do.

At minimum:

- Inspector
- Administrator

Every protected API should verify both authentication and authorization.

## 16. Audit Logging

Important events should be logged:

- Login/logout
- Product creation/edit
- Shop creation/edit
- Inspection creation
- Image upload
- AI processing result
- Rule evaluation
- Officer verification
- Report generation
- Administrative changes

Each event should have actor, timestamp, action, target, and relevant metadata.

## 17. Report Generation

The report service converts structured inspection data into a reproducible document. Reports should include a report identifier and inspection timestamp and should reference evidence.

The report should clearly distinguish:

- AI-generated extraction
- Rule-engine findings
- Officer-confirmed findings

## 18. Analytics Architecture

Analytics should be derived from inspection records rather than maintained as manually updated counters.

Prototype analytics can use PostgreSQL aggregation queries. A separate analytics warehouse or stream-processing platform is unnecessary for the first SIH version.

## 19. Scalability Path

The SIH prototype can use a modular monolith with background AI jobs. If deployment scales later:

```text
Responsive Client
      ↓
API Gateway / Load Balancer
      ↓
Multiple API Instances
      ↓
Job Queue → AI Workers
      ↓
PostgreSQL + Object Storage
```

This allows OCR/AI workloads to scale independently from the API.

## 20. Processing States

An inspection should have explicit states such as:

`CREATED → UPLOADED → PROCESSING → EXTRACTED → REVIEW_REQUIRED → VERIFIED → COMPLETED`

Failure states should also be represented, for example `PROCESSING_FAILED`.

## 21. Failure Handling

The application must handle:

- Blurry images
- Missing package sides
- OCR failure
- Unsupported image format
- AI service timeout
- Duplicate upload
- Database failure
- Report generation failure

The user should receive an actionable error rather than an unexplained technical message.

## 22. Security Principles

- HTTPS in deployment
- Password hashing
- Short-lived access tokens where token authentication is used
- Role-based authorization
- Server-side input validation
- File type and size validation
- Safe filename handling
- No secrets in source code
- Audit logs for sensitive operations
- Least-privilege database access

## 23. Prototype Boundary

Do not attempt to build a national production system during the SIH prototype phase. Demonstrate a complete, reliable vertical slice using representative rules and realistic package images.

The architecture must make future expansion possible without pretending the prototype already provides national-level legal or AI coverage.
