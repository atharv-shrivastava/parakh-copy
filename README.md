# PARAKH

**Packaged Article Regulatory Assessment & Knowledge Hub**

PARAKH is an AI-assisted, cross-platform inspection and compliance platform for packaged commodities, designed around the **Legal Metrology Act, 2009** and the **Legal Metrology (Packaged Commodities) Rules, 2011**.

## Vision

Help enforcement officials inspect packaged commodities faster, extract label information automatically, identify potential non-compliance, verify findings, and maintain reusable inspection intelligence.

## Core workflow

**Capture → Extract → Classify → Apply Rules → Detect → Verify → Record → Analyze**

## Platforms

PARAKH is a single responsive application available on mobile, tablet, laptop, and desktop. **Web and mobile must have feature parity.** Core functionality is available across devices; the UI adapts to screen size and device capabilities.

## Core modules

- Dashboard and inspection analytics
- Product scanning and multi-image capture
- OCR and AI-based declaration extraction
- Product/category classification
- Configurable Legal Metrology rule engine
- Compliance and potential non-compliance detection
- AI confidence scoring and uncertainty highlighting
- Officer verification workflow
- Shop management and shop-wise product history
- Hierarchical product catalogue
- New category and product registration
- Inspection history and advanced filters
- Evidence and audit trail
- PDF and editable inspection reports
- Role-based access control

## Product hierarchy

**Category → Subcategory → Product Type → Brand → Product → Pack Size / Variant**

Example: `Food → Ready to Eat → Chips → Lay's → Classic Salted → 50 g`

## Legal compliance approach

PARAKH includes a dedicated **Legal Metrology Compliance Rule Engine**. Legal requirements are represented as structured, versioned rules rather than being hard-coded into AI models. The engine evaluates extracted product information against applicable requirements and produces evidence-backed findings.

The system should distinguish between:

- Compliant
- Potential Non-Compliance
- Needs Manual Verification

AI output is advisory. The enforcement officer remains responsible for reviewing and confirming findings and the system must never present an AI prediction as a final legal determination.

## Proposed technology direction

- Frontend: React + TypeScript + Vite
- Backend: Python + FastAPI
- Database: PostgreSQL
- AI/OCR: Python-based services
- API: REST
- Authentication: role-based authentication

The exact AI models and supporting services will be selected during implementation based on accuracy, licensing, hardware requirements, and SIH prototype feasibility.

## Repository status

Specification and architecture phase. The repository is the single source of truth for the project requirements so that team members and AI coding tools implement the same system.

Planned documentation:

- `PROJECT_SPEC.md` — canonical functional specification
- `ARCHITECTURE.md` — technical architecture
- `DATABASE_SCHEMA.md` — data model
- `AI_MODULES.md` — OCR, vision, extraction and confidence architecture
- `COMPLIANCE_ENGINE.md` — Legal Metrology rule-engine design
- `API_SPEC.md` — backend API contract
- `UI_UX_SPEC.md` — cross-platform interface specification
- `DEVELOPMENT_RULES.md` — development standards and rules for AI coding tools
- `ROADMAP.md` — implementation phases
