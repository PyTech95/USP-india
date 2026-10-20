# Deploy "ups-ggn-main" on Emergent

Get the uploaded project (ups-ggn-main-clean.zip) running in this environment with its current features and look.
After it works in preview, publish it to a live URL.

## Who it's for
The project owner. They want their existing app hosted and reachable here without rebuilding it.

## Core features and experience
- The uploaded code is extracted and its structure checked (frontend, backend, database, external services).
- The app runs as-is. Only changes needed for this environment are made: ports, API routes using the `/api` prefix, database connection through the provided MongoDB, and settings read from environment variables.
- Existing features, pages, and design stay as they are. Nothing is redesigned or added.
- Any external services the code depends on (payments, email, AI, maps, third-party databases) are listed. Keys are requested only for the services the app actually needs.
- If the stack can't run here (for example a non-Python backend or a SQL database), it is adapted as little as possible so behavior stays the same, and each adaptation is reported.

## User flow
1. The zip is extracted and reviewed.
2. The app is set up and started in preview.
3. The owner checks the preview link and gives keys if any are needed.
4. Once the main pages and flows work, the app is published to a live URL.

## UI/UX feel
Same as the original project. The visual design is not changed.

## Implementation phases
- **Phase 1 (MVP, built now):** extract, configure, and run the app in preview; fix blocking errors; smoke-test the main pages and APIs; publish to a live URL.
- **Phase 2:** connect remaining external services once keys are provided; fix smaller bugs found during use.
- **Phase 3:** improvements requested by the owner (new features, performance, design changes).

## Assumptions
- "Deploy here" means: run the uploaded code on Emergent and publish it. It does not mean rebuild it.
- Code changes are limited to what the environment requires. Existing behavior is kept.
- Any existing data in the original project is not migrated. The app starts with an empty database unless seed data is included in the zip.
- Integrations that need user keys are disabled or stubbed until keys are provided, and are clearly marked as MOCKED in the meantime.
- Publishing happens right after preview works, without further confirmation beyond any platform deploy charge.
