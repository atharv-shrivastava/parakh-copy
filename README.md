# PARAKH

**Packaged Article Regulatory Assessment & Knowledge Hub**

PARAKH is an AI-assisted inspection and compliance platform for packaged commodities in India, designed around the **Legal Metrology Act, 2009** and the **Legal Metrology (Packaged Commodities) Rules, 2011**.

## Vision

Help inspectors examine packaged products faster, extract declaration information from package images, identify potential compliance issues, verify findings, register reusable product intelligence, and analyze inspection history.

## Core workflow

**Capture → OCR → Extract → Classify → Apply Rules → Detect → Verify → Register → Analyze**

AI output is advisory. The inspector remains responsible for reviewing and confirming compliance findings.

## Current platform

PARAKH is a responsive web application for mobile, tablet, laptop, and desktop. The same core workflow is available across screen sizes.

### Frontend

- React 19
- Vite
- React Router
- Responsive CSS theme system
- Light, dark, dark-gradient, gradient, and rainbow themes
- Client-side data caching with mutation-triggered invalidation
- jsPDF for client-side report generation where applicable

### Backend

- Node.js
- Express 5
- REST APIs
- Multer for image uploads
- Sharp for image processing
- Prisma 7 with the PostgreSQL driver adapter
- Role-aware authentication and authorization

### Database

- PostgreSQL
- Prisma schema and migrations
- Structured product, category, shop, inspection, compliance, evidence, and analytics data

### OCR and AI

The current scanning pipeline combines deterministic and remote semantic stages:

```text
Package image(s)
      ↓
RapidOCR service
      ↓
OCR evidence + confidence + geometry
      ↓
Local deterministic field reconciliation
      ↓
Semantic providers
 ├── Gemini
 ├── Cloudflare Gemma
 └── Cloudflare Moondream (best-effort)
      ↓
Semantic consensus
      ↓
Structured inspection result
```

The local reconciliation layer is deterministic and evidence-driven. Remote semantic providers are used for interpretation and cross-checking rather than acting as the legal source of truth.

## Product hierarchy

The catalogue is hierarchical and must remain intact:

**Category → Subcategory → Product Type → Brand → Product → Pack Size / Variant**

Example:

`Food → Ready to Eat → Chips → Lay's → Classic Salted → 50 g`

The implementation also supports category tree navigation, final product type selection, product registration, and category creation.

## Core modules

- Dashboard and real inspection analytics
- Multi-image package scanning
- OCR and semantic declaration extraction
- Confidence and uncertainty handling
- Visual inspection screening
- Product/category classification
- Configurable Legal Metrology rules
- Officer review and manual violations
- Product registration
- Shop management and shop-wise history
- Hierarchical product catalogue
- Inspection history and filtering
- Reports and PDF output
- E-commerce inspection
- Admin controls and platform analytics
- Theme and responsive UI system

## Dashboard intelligence

Dashboards use real stored inspection data.

They can show:

- Inspection volume over time
- Total inspections
- Total violations
- Highest-violation shop/source
- Highest-violation brand
- Highest-violation rule

User analytics are scoped to the user's inspection data. Admin analytics can represent platform-wide data.

## Performance model

The frontend caches successful GET responses in session storage and invalidates relevant cached data after persisted mutations such as product, shop, category, and inspection changes.

The UI also uses optimistic updates for selected actions, such as deletion, so the interface does not unnecessarily remount or reload the entire page after a successful mutation.

## Compliance approach

Legal requirements belong in the compliance engine, not in the UI and not inside an LLM.

The system distinguishes between:

- Compliant
- Potential / confirmed violation according to configured workflow
- Needs manual verification
- Unable to determine

Every important finding should be traceable to the rule, extracted value or observation, evidence, and officer decision.

AI confidence is not the same as legal certainty.

## Evidence

Where available, extracted fields retain:

- Source image
- OCR text
- Confidence
- Bounding box / geometry
- Semantic source or verification metadata

This supports explainability and visual evidence inspection.

## Security

Never commit:

- API keys
- Database credentials
- Production secrets
- Private certificates
- Real sensitive inspection data

Use environment variables for local and deployed configuration.

## Repository documentation

- `PROJECT_SPEC.md` — functional specification
- `ARCHITECTURE.md` — current technical architecture
- `DATABASE_SCHEMA.md` — logical data model
- `AI_MODULES.md` — OCR, extraction, semantic interpretation, and evidence
- `COMPLIANCE_ENGINE.md` — Legal Metrology rule architecture
- `API_SPEC.md` — API contract and current endpoint groups
- `UI_UX_SPEC.md` — interface requirements
- `DEVELOPMENT_RULES.md` — engineering rules
- `ROADMAP.md` — planned work

The specification documents describe intended behavior; the current implementation is the authoritative reference for what is actually running.
