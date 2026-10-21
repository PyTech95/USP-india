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

## Theatre, Craft and Contact editor fixes (2026-10-21)
- User request: remove Theatre Over Time's Explore Past Productions link/button without removing image; fix globally unsafe field delete; separate Craft Centre text/image movement; clean Theatre separators; enable Contact address/phone editing and white-card width/height controls.
- Reproduced in iteration 15: field toolbar always deleted/reordered whole section; blank text-column clicks selected whole section. True field dragging was already independent.
- Implemented contextual SelectionToolbar: field trash clears only selected field; field arrows nudge only selected element; section operations require explicit Whole section selection, with confirmation before section deletion. Blank image_text text-region gaps select nearest text field; link arrows select their label.
- Theatre archive link_label/link_href cleared in both published and draft through a scoped positional update, preserving image, other content and any unrelated draft edits. Grey full-width section rules removed; red accents retained (conservative default after line clarification remained unanswered).
- Contact email/address/phone now use shared Site text editor. Backend allowlists contact.address. Empty phone shows Add phone number only while editing; no fake number stored. Compact form labels and submit label also editable.
- White contact card is layout-only _contact_card, selectable via click or All page fields; drag and numeric width/height controls persist. Small desktop heights scroll internally; mobile uses auto-height and constrained width. Size & position opens by default for layout selections.
- Fixed root cause of repeated stale bundles: craco watchOptions ignored '**/public/**', including src/components/public and src/pages/public. Narrowed ignore to frontend/public only. Restarted frontend to activate configuration.
- Tests: contact settings backend 6/6 pass; Theatre/Craft/home browser 43/43 pass. Contact initial overflow failure fixed and final isolated retest 40/40 PASS, including exact saved/public geometry, reachable Send button, mobile auto-height and no overflow. Total 89/89 checks pass; no React errors. Report: /app/test_reports/iteration_17.json; detailed log /tmp/contact_retest_17.log.
- Hot reload verified after fix: touching src/components/public/Blocks.jsx triggered successful recompilation without restarting frontend. Earlier handoff's recurring stale-bundle issue is resolved.
- Every new browser test uses disposable page/settings clones; no real customer pages/settings are written or restored during tests. Tests confirm fingerprints and remove fixtures.
- Reference files: LiveEditor.jsx, editor/SelectionToolbar.jsx, editor/editorFields.js, editor/FieldInspector.jsx, Blocks.jsx, PageSections.jsx, ContactForm.jsx, editor/SiteChromeEditor.jsx, editor/SiteText.jsx, styles/boxed-layout.css, styles/theatre-reference.css, backend/routes_admin.py, frontend/craco.config.js.
- User added credits after testing interruption; resumed pending browser testing without restarting implementation.

## Backlog
- P1: User verification of latest Ambition layout; no deployment requested for this fork yet.
- P2: Homepage placeholder "New heading / New paragraph" removal only with owner approval; email/external services only when credentials provided.
- Existing draft/publish and Field Note editing do not have page-live version protection; outside current scope.
- No general refactor requested.
