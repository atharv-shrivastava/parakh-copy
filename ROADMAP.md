# PARAKH Development Roadmap

## Phase 0 — Foundation

- Finalize repository documentation
- Establish frontend/backend structure
- Configure environment variables
- Establish database migrations
- Establish authentication model
- Create shared UI components

## Phase 1 — Core Application

- Login
- Dashboard shell
- Responsive navigation
- Shop creation and listing
- Product catalogue
- Category hierarchy
- Inspection creation
- Inspection history

## Phase 2 — Scanning Vertical Slice

- Mobile-friendly camera/upload interface
- Multi-image inspection capture
- Image validation
- OCR processing
- Structured field extraction
- Extraction review UI
- Confidence indicators

## Phase 3 — Product Intelligence

- Product matching
- Category/subcategory/product-type hierarchy
- Brand management
- Product variant management
- New product registration
- Unknown-product workflow

## Phase 4 — Compliance Engine

- Rule data model
- Representative Legal Metrology rules
- Applicability evaluation
- Deterministic validation functions
- Compliance findings
- Evidence linkage
- Manual verification workflow

## Phase 5 — Reports and History

- Complete inspection records
- Shop product history
- Advanced history filters
- Evidence viewer
- PDF reports
- Editable reports

## Phase 6 — Analytics

- Dashboard metrics
- Category analytics
- Product/brand analytics
- Shop analytics
- Location analytics
- Violation trends
- Repeat violation analysis

## Phase 7 — Hardening

- Authentication hardening
- Authorization tests
- File-upload security
- Error handling
- Database indexes
- Performance testing
- Responsive testing
- Accessibility checks
- Audit-log validation

## Phase 8 — SIH Demonstration

The demonstration should show one coherent story:

1. Officer logs in.
2. Officer selects or adds a shop.
3. Officer scans a packaged commodity.
4. PARAKH processes package images.
5. OCR extracts declarations.
6. AI/classification identifies the product.
7. Rule engine evaluates representative requirements.
8. Potential issues are highlighted with evidence.
9. Officer verifies/corrects the result.
10. Inspection is saved.
11. Shop and product histories update.
12. Report is generated.
13. Dashboard analytics reflect the inspection.

## Priority Principle

If time becomes limited, protect the complete vertical slice. Advanced AI features should not be allowed to prevent the core inspection workflow from working reliably.
