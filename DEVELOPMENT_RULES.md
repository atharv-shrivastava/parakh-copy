# PARAKH Development Rules

This file is the contract for human developers and AI coding tools contributing to PARAKH.

## 1. Source of Truth

`README.md` gives the project overview. `PROJECT_SPEC.md` is the canonical functional specification. `ARCHITECTURE.md` is the canonical architecture. Other specification documents define their respective domains.

Do not invent features that contradict these documents.

## 2. Before Coding

Read the relevant specification before changing code. Understand existing components before creating new ones.

## 3. Feature Parity

Never create a feature that exists only on mobile or only on desktop unless there is a genuine hardware limitation. Camera access can be optimized for mobile, but the inspection workflow must remain available on larger screens through image upload/camera support where possible.

## 4. AI Coding Rules

AI coding assistants must:

- Inspect existing code before editing
- Reuse existing components
- Avoid unnecessary dependencies
- Avoid duplicated business logic
- Keep API contracts synchronized
- Explain breaking architectural changes
- Never invent legal requirements
- Never commit secrets

## 5. Naming

Use clear, descriptive names. Avoid meaningless names such as `data2`, `tempFinal`, `componentNew`, or `final_final`.

## 6. Frontend

- TypeScript strictness should be enabled where practical.
- Keep reusable UI in shared components.
- Keep API calls in service modules rather than scattering fetch logic throughout pages.
- Keep domain types centralized.
- Handle loading, empty, success, and error states.
- Do not put large business-rule calculations directly in JSX.

## 7. Backend

- Keep route handlers thin.
- Put business logic in services.
- Use schemas for validation.
- Use repository/data-access abstractions where beneficial.
- Never trust client-side validation.
- Return consistent API errors.

## 8. Database

- Use migrations.
- Do not silently mutate schema.
- Preserve inspection and verification history.
- Keep master catalogue data separate from inspection events.

## 9. Legal Metrology Rules

Legal requirements belong in the configurable compliance engine. Do not hard-code legal logic into React components or AI prompts.

Every implemented legal rule must have a source/reference and version information.

## 10. AI Safety and Accuracy

AI must not fabricate fields. Unknown information stays unknown.

AI confidence is not the same as legal certainty.

When evidence is insufficient, return `NEEDS_MANUAL_VERIFICATION` or `UNABLE_TO_DETERMINE`.

## 11. Evidence

Potential compliance findings should retain source evidence whenever technically possible.

Do not discard original AI extraction after an officer edits it.

## 12. Security

Never commit:

- API keys
- Passwords
- Private certificates
- Production database credentials
- Personal real-world inspection data

Use environment variables and provide safe example configuration files.

## 13. File Uploads

Validate file type, size, and dimensions server-side. Never trust filenames.

## 14. Error Handling

Errors must be understandable to the user. Technical details belong in server logs, not in production UI.

## 15. Testing

New business logic should have tests where practical. Compliance rules should have explicit unit tests. API behavior should be tested independently of the frontend.

## 16. Git Practices

Use focused commits. Suggested style:

- `feat:` new functionality
- `fix:` bug fix
- `docs:` documentation
- `refactor:` restructuring without intended behavior change
- `test:` tests
- `chore:` maintenance

Do not commit generated build artifacts unless explicitly required.

## 17. Pull Requests

A pull request should state:

- What changed
- Why it changed
- How it was tested
- Any known limitations

## 18. Prototype Discipline

Prefer a complete working vertical slice over ten unfinished features. The SIH prototype must demonstrate the core journey from package capture to officer-verified compliance result.

## 19. No Fake Functionality

Do not label a static mock as an AI result or claim an integration is operational when it is not. Clearly identify prototype/mock/demo behavior.

## 20. Documentation

When architecture, API, database, AI behavior, or legal-rule behavior changes, update the relevant documentation in the same development cycle.
