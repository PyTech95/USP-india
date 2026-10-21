# RCA — Recurring publish caption loss: "What the Haveli Reveals" cover.caption blank in production

**Deployment:** launch-pad-462 (`d27de82b-...`)  •  **Active run:** `62bbff5e-1fe3-473b-9e54-a93acf6dd5d8` (redeploy, success, 2026-10-21T18:18:27Z)  •  **frontend_type:** cloudflare  •  **Mode:** read-only diagnosis (no deploy, no data/font/identity change)

## Problem statement
User expects caption **"Views from the restoration in progress"** to appear beneath the images for note `what-the-haveli-reveals` on `/field-notes`. On publish, the caption does not appear in production. Production standfirst `fontSize:22px` must be preserved.

## What the code does (consistent with the symptom)
- `backend/routes_public.py:33` lists cards using `cover.caption`; `NoteReader.jsx` Featured renders `n.caption` conditionally → when caption is blank the element is **absent** (no empty slot). So a blank `cover.caption` = no caption rendered. This is correct behaviour, not the bug.

## Evidence (production MongoDB, db `launch-pad-462-test_database`)

### 1. Baked/incoming content HAS the caption (baseline is restored, not blank)
`content_baselines` (key=`incoming`, source-derived) → note `e3f553ae432c4561a74287647b87c292`:
- `draft.cover.caption` = **"Views from the restoration in progress"**
- `published.cover.caption` = **"Views from the restoration in progress"**
- `styles` = `{}`  (no 22px in the incoming source)
- note `updated_at` = 2026-10-21T13:27:47Z  (caption was last set in PREVIEW here)

### 2. Production live note does NOT have it
`notes` collection, same id:
- `draft.cover.caption` = **""**  ;  `published.cover.caption` = **""**
- `styles.standfirst.fontSize` = **"22px"**  (prod-only live edit, must keep)
- `updated_at` = **2026-10-20T21:57:09Z**  (NOT advanced by the 10-21 release)

### 3. The content release skipped this note
`content_runtime` (key=`target`): release applied **2026-10-21T18:20:00Z**, `merge_policy = preserve_live_edits`, `preserved_count = 6`, `preserved_fields` lists ONLY `pages:craft-livelihood.*` — the note is not enumerated. Pages were rewritten by this release (`pages` docs show `published_at`/`updated_at` on 2026-10-21, e.g. theatre 18:39:52, home 17:05:43), but the note's `updated_at` stayed at 2026-10-20T21:57:09 → **the incoming note content (with the caption) was never written to prod.** Release carried `counts.notes = 5`, so notes were in scope.

### 4. Revision history — the blank was original, not a regression
`revisions` for the note (newest first):
- 2026-10-20T21:57:09 "live edit published" — caption "", standfirst **22px**
- 2026-10-20T21:52:49 "live edit published" — caption "", standfirst **20px**
- 2026-10-20T14:24:26 "published" — caption "", no styles
- 2026-10-20T14:24:26 "draft saved" — caption "", no styles

The prod caption was **"" in every single prod write** — it was published blank originally; the caption only ever existed in PREVIEW (added 2026-10-21T13:27). No prod revision ever lost a previously-present caption.

## Root cause
The content-sync/release merge runs with `merge_policy = preserve_live_edits`. This note carries prod-side live edits (the two "live edit published" fontSize changes on 10-20), so the merge **preserved the entire production note document** and declined to overlay the incoming source content. Result: prod keeps its blank `cover.caption` **and** its 22px style, while the incoming source caption is discarded on every release — the recurring "caption not coming through on publish".

The preservation is effectively **whole-note (coarse-grained)**: both the legitimately prod-only field (standfirst 22px) and the stale blank caption survive together. Pages are merged at field granularity (see `preserved_fields` listing individual `pages:craft-livelihood...` paths), but notes are not — consistent with the note live-save path lacking the optimistic-version / per-field live-edit tracking that the page live-save path has. The prod `notes` document carries no `version` field; pages are tracked field-wise.

## Hypotheses tested / rejected
- **Stale LiveEditor tab overwrote a present caption** → NOT supported. Prod revision history shows the caption never existed in prod, so nothing was overwritten. (The missing optimistic-version protection on note live-save is a real latent risk, but it is not what produced this blank.)
- **Source/image doesn't contain the caption** → Rejected. The baked incoming baseline contains the caption in both draft and published.
- **Deployment pipeline failure** → Rejected. Active run succeeded; this is a content-merge/data issue, not a build/deploy failure.

## Remediation (minimal, safe, preserves 22px)

### A. Code (E1) — fixes the recurrence
Give notes the same field-level live-edit tracking the pages path has, so `preserve_live_edits` preserves ONLY genuinely live-edited fields (e.g. `styles.standfirst`) and still applies incoming changes to untouched fields (e.g. `cover.caption`). Concretely: add optimistic version / per-field dirty tracking to the note live-save endpoint (mirror the page live-save), and make the release merge for notes field-granular rather than whole-document. Until this lands, every release will keep discarding the incoming caption for any note that has any prod live edit.

### B. User (immediate unblock) — one-field data fix, keep 22px
Set ONLY `cover.caption` on the prod note to "Views from the restoration in progress" for this note, without touching `styles.standfirst.fontSize` (22px). Safest done as a single targeted edit to `draft.cover.caption` and `published.cover.caption` (DB Manager), or by opening the note in a single fresh Live Editor tab and publishing the caption. Do NOT reopen stale tabs (note live-save has no version guard) and do not run a full re-sync, which would again be blocked by preserve_live_edits.

## Notes
- Deployment is healthy and live at https://launch-pad-462.emergent.host; no redeploy is required for the caption.
- All findings above are from direct production DB reads; nothing was modified.
