# PARAKH Development Rules

This file is the contract for human developers and AI coding tools contributing to PARAKH.

## 1. Source of Truth
`README.md` gives the overview. `PROJECT_SPEC.md` defines functional requirements. `ARCHITECTURE.md` defines the current technical architecture. The working source code is authoritative for implemented behavior.

## 2. Before Coding
Inspect existing code and read the relevant specification before editing. Reuse existing components/modules.

## 3. Feature Parity
Keep the inspection workflow usable across phone, tablet, laptop, and desktop.

## 4. AI Coding Rules
Inspect before editing; avoid unnecessary dependencies and duplicated logic; keep API contracts synchronized; never invent legal requirements; never commit secrets.

## 5. Frontend
Current stack: React + Vite + React Router using JSX/JavaScript.
Preserve shared components, theme variables, responsive behavior, loading/empty/error states, and reduced-motion support.

## 6. Backend
Current stack: Node.js + Express.
Keep routes understandable, validate server-side, preserve authentication/authorization, and keep reusable business logic out of UI code.

## 7. Database
Current persistence: PostgreSQL through Prisma.
Use migrations, preserve inspection history, separate master catalogue data from inspection events, and avoid unnecessary full-table queries.

## 8. Legal Metrology
Legal requirements belong in the configurable compliance/rules layer. Do not hard-code legal logic into React or hide deterministic checks inside LLM prompts. Maintain rule source/reference and version.

## 9. AI Safety
AI must not fabricate fields. Unknown stays unknown. AI confidence is not legal certainty. Insufficient evidence should trigger manual review or unable-to-determine states.

## 10. Evidence
Preserve original OCR/AI extraction and source evidence when an officer edits or verifies a result.

## 11. Security
Never commit API keys, passwords, production DB credentials, private certificates, or real sensitive inspection data. Use environment variables.

## 12. Uploads
Validate file type, size, and dimensions server-side.

## 13. Errors
User-facing errors should be understandable. Provider/model/database diagnostics belong in server logs. Provider failures should identify provider/model where practical.

## 14. Performance
Prefer targeted queries, parallel independent reads, bounded external-provider timeouts, short-lived GET caching, mutation-triggered invalidation, optimistic UI where safe, and avoiding unnecessary page remounts.

## 15. Testing
Test new business logic where practical. Compliance rules should have explicit unit tests. API behavior should be testable independently of the frontend.

## 16. Git
Use focused commits:
`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
Use feature branches and pull requests for team work.

## 17. No Fake Functionality
Do not present mocks as live AI or claim integrations are operational when they are not.

## 18. Documentation
When architecture, API, database, AI, UI, or compliance behavior changes, update the relevant documentation in the same development cycle.
