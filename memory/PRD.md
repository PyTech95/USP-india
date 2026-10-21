# USP India CMS — Deploy on Emergent

## Original problem statement
"deploy here" + uploaded ups-ggn-main-clean.zip (USP India website + live-editor CMS). Run as-is on Emergent, then publish.
Follow-ups: Field Notes title same size as other homepage titles; Explore Field Notes 10px lower; check responsiveness; editor must work 100%; one header for the whole site; hero alignment on every page like the home page.

## Architecture
- Backend: FastAPI (/app/backend, server.py + routes_*), MongoDB, cookie JWT auth + CSRF, SSR endpoint /api/ssr, photos in backend/storage.
- Frontend: React 19 CRA + craco + Tailwind; public site + admin + live editor. Dev SSR proxy in src/setupProxy.js.
- No external services (email notifications not configured by design).

## Implemented (2026-10-20)
- Imported code, env configured (SITE_URL, CORS_ORIGINS, JWT_SECRET, ADMIN_*, SSR_SCRIPT_TAGS=/static/js/bundle.js for dev), content auto-imported (10 pages, notes, media).
- Homepage: Field Notes title 28px (matches other section titles), Explore link +10px.
- Hero alignment fixed (About + Craft) — all page heroes share header box edges at all widths.
- Global header lock (boxed-layout.css): identical header on every page (colours, sizes, separators, Workshops width).
- Live editor fixes: device preview portal, header style overrides specificity + header background, site-text font size, footer copyright/email editable, undo/redo setState warning, Ctrl+Z with focused text, Esc closes preview, field→location auto, move grip position, arrow hint.
- Tests: iterations 1–4 passed.

## Completed follow-ups (handoff; tests through iteration 12)
- App deployed according to handoff; current production state has not been rechecked in this fork. Original credit blocker is historical.
- Header and homepage alignment, Our Work cards, independent editable card labels, Field Notes and Connect cleanup.
- LiveEditor drag/resize persistence, undo ordering, route scroll-to-top, caption editing restored.
- Global red accent lines standardized with editor controls; Haveli caption restored.
- Rakhigarhi Ambition converted to two columns (first two paragraphs left, third right).

## Implemented (2026-10-21; iterations 13–14 PASS)
- User request: "esme text box 3 aayega and right wala center me aayega verticle as a and pipe ka line v 70% karo".
- Ambition now has 3 independently editable rich text boxes: two left, right vertically centred; divider is 70% high with top 15%. Mobile stacks 1/2/3 with a horizontal divider.
- Normalizes current content into body_1_html/body_2_html/body_3_html without snapshot edits; first editor save persists the new shape. Typography copied to individual boxes, group geometry retained.
- Admin PageEditor supports the three rich text fields; SSR handles both existing and saved content. Empty rich text saves as an empty string.
- Live page editor now sends version hash and backend rejects stale saves with 409; atomic published-content comparison protects simultaneous writes. Conflict preserves unsaved local edits.
- Tests: iteration 13 full feature passed. Iteration 14: 8 backend tests, 20 LiveEditor checks, 6 admin checks passed; no open product bugs in requested flow.
- IMPORTANT testing safety: iteration 13 wrote temporary content to actual Rakhigarhi and a concurrent editor session saw it. All new tests were converted to disposable TEST_rak_* page clones in iteration 14. NEVER mutate/restore real client pages for testing. Iteration 14 fingerprints proved real page unchanged.
- Reference files: Blocks.jsx, editor/referenceGeometry.js, LiveEditor.jsx, PageEditor.jsx, styles/rakhigarhi-reference.css, backend/ssr.py, backend/routes_admin.py.
- Do not manually modify backend/content_release.json (checksum-protected).

## Current user request (2026-10-21; investigation)
- Remove Theatre > Theatre over time > "Explore past productions" text/button, keep image.
- Fix LiveEditor delete: deleting selected text/button must not delete its image or entire section; user reports this across site.
- Fix unwanted separator lines on Theatre. Asked whether to remove only full-width horizontal rules and keep small red accents, or all lines; waiting for answer.
- In "The Craft Centre — A Place for the Work to Continue", moving text should not move image; make independently movable.
- Latest tests for prior task: /app/test_reports/iteration_14.json. New task not implemented yet.

## Backlog
- P1: User verification of latest Ambition layout; no deployment requested for this fork yet.
- P2: Homepage placeholder "New heading / New paragraph" removal only with owner approval; email/external services only when credentials provided.
- Existing draft/publish and Field Note editing do not have page-live version protection; outside current scope.
- No general refactor requested.
