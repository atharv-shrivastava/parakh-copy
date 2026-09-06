# PARAKH Project Specification

## Identity
**PARAKH — Packaged Article Regulatory Assessment & Knowledge Hub**  
SIH Problem Statement: **26034**

## Purpose
PARAKH assists inspectors in examining packaged commodities, extracting declarations, classifying products, evaluating applicable Legal Metrology requirements, recording officer decisions, and building reusable inspection intelligence.

## Core principle
AI assists; the authorized officer verifies. PARAKH must not present an AI prediction as a final legal determination.

## Current workflow
```text
Login
 ↓
Select/Add Shop
 ↓
Capture / Upload package images
 ↓
RapidOCR
 ↓
Local deterministic field reconciliation
 ↓
Gemini / Cloudflare semantic interpretation
 ↓
Consensus / structured result
 ↓
Classification
 ↓
Rules / compliance evaluation
 ↓
Officer review, correction, or manual violation
 ↓
Register / save
 ↓
History + shop/product updates
 ↓
Reports + analytics
```

## Product hierarchy
`Category → Subcategory → Product Type → Brand → Product → Pack Size / Variant`

The hierarchy is fundamental and must not be replaced by a flat catalogue.

## Current modules
- Authentication and role-aware access
- Dashboard with real inspection analytics
- Multi-image product scanning
- OCR and semantic extraction
- Confidence/status review
- Visual screening
- Product/category hierarchy
- Manual and automated compliance findings
- Product registration
- Shops and shop history
- Inspection history
- Reports/PDF output
- E-commerce inspection
- Administration
- Responsive themed UI
- Client GET caching and mutation invalidation

## Current technology
### Frontend
React 19, Vite, React Router, JSX/JavaScript, responsive CSS/theme system, jsPDF where used.

### Backend
Node.js, Express 5, ES modules, Multer, Sharp, Prisma 7, PostgreSQL driver adapter.

### OCR/AI
RapidOCR service, deterministic field reconciliation, Gemini, Cloudflare Gemma, Cloudflare Moondream as a best-effort provider.

## Data and performance
The application uses real database data. The frontend uses short-lived GET caching and invalidates relevant caches after persisted mutations. Selected destructive operations use optimistic UI updates.

## Security
Secrets belong in environment variables and must never be committed. Server-side validation and authorization are required.

## Legal boundary
Rules belong to the configurable compliance layer. AI can extract and interpret; the rules engine evaluates configured requirements; the officer verifies the result.

## Prototype boundary
This is an SIH-oriented working prototype. The goal is a reliable end-to-end inspection vertical slice, not a claim of national-scale deployment or complete legal coverage.
