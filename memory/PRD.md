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

## Backlog
- P0: Publish (blocked: needs 50 ECU, balance 46).
- P1: Theatre split image crop keeps fixed figure height; header panel scroll nit.
- P2: Remove placeholder "New heading" section on homepage (client content — ask owner); email notifications for enquiries.
