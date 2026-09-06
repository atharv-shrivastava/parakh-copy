# PARAKH Development Roadmap

## Current status
PARAKH is a working SIH prototype with a responsive UI, real database-backed products/shops/inspections, product hierarchy, OCR/AI scanning, compliance workflow, reports, analytics, caching, and administrative functionality.

## Completed / implemented
- React/Vite responsive frontend
- Node/Express backend
- Prisma/PostgreSQL persistence
- Authentication and role-aware access
- Product/category hierarchy
- Shop management and inspection history
- Multi-image scanning
- RapidOCR integration
- Deterministic OCR field reconciliation
- Gemini semantic integration
- Cloudflare Gemma semantic integration
- Cloudflare Moondream best-effort integration
- Semantic consensus and confidence handling
- Visual inspection screening
- Editable extraction results
- Manual violation entry
- Product registration
- Real-data dashboard analytics
- Inspection trends
- Highest-violation shop/brand/rule analytics
- Reports/PDF support
- E-commerce inspection workflow
- Responsive navigation
- Light/dark/gradient/rainbow themes
- Dark-theme contrast improvements
- Client GET caching
- Mutation-triggered cache invalidation
- Optimistic deletion for selected operations
- Shop query optimization
- Backend provider/model failure logging

## Next priorities

### 1. Scan performance
- Reduce RapidOCR latency
- Ensure slow semantic providers cannot unnecessarily delay a usable result
- Improve staged processing feedback
- Continue measuring provider performance

### 2. Evidence experience
- Stronger field-to-image highlighting
- Better bounding-box visualization
- Clearer source/evidence provenance

### 3. Inspection/product detail
- Richer inspection record pages
- Better timelines
- Stronger evidence presentation

### 4. Compliance
- Expand representative official rules
- Improve rule applicability configuration
- Add automated rule tests
- Preserve rule source/version information

### 5. Reliability
- Frontend/backend automated tests
- API integration tests
- Database performance testing
- OCR/AI failure tests
- Mobile/browser regression testing

### 6. Deployment
- Production environment hardening
- Pooled database configuration
- OCR deployment strategy
- Monitoring and structured logs

## Priority principle
Protect the end-to-end path:

```text
Scan → OCR → Extract → Classify → Rules → Review → Register → History → Analytics/Report
```

New features should not destabilize this vertical slice.
