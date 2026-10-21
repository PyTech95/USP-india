# Iter22 Rakhigarhi hero red accent line: attached to eyebrow (span.rak-hero-accent). Public GET-only checks + legacy CSS comparison,
# then TEST_ clone seeded with production-style eyebrow/heading offsets for public + editor (select, drag, rename, undo/redo, save, fresh reload).
# All rakhigarhi API calls rerouted to clone; other non-GET aborted; real page fingerprinted; clone deleted in finally.
import asyncio, os, json, uuid, copy, hashlib
from playwright.async_api import async_playwright
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env"); load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = f"TEST_rak_{uuid.uuid4().hex[:8]}"
HERO = "658b5d1f52e043a580c2e9a7fdf9b37c"
R, BLOCKED, ERRS = [], [], []
def ok(n, c, i=""): R.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n, i)
def fp(): return hashlib.sha256(json.dumps(db.pages.find_one({"key": "rakhigarhi"}, {"_id": 0}), sort_keys=True, default=str).encode()).hexdigest()
def fps(): return hashlib.sha256(json.dumps(list(db.settings.find({}, {"_id": 0})), sort_keys=True, default=str).encode()).hexdigest()
PROD = {"eyebrow": {"translateX": "60px", "width": "1270px"}, "heading": {"translateX": "61px", "fontSize": "32px", "width": "1269px"}}
LEGACY = """html body #public-site#public-site#public-site#public-site #rakhigarhi-reference .rak-hero-copy { padding-top: 0 !important; }
html body #public-site#public-site#public-site#public-site #rakhigarhi-reference .rak-hero-accent { display: none !important; }
html body #public-site#public-site#public-site#public-site #rakhigarhi-reference .rak-hero-copy::before { content: "" !important; display: block !important; width: var(--accent-line-w) !important; height: var(--accent-line) !important; margin-bottom: var(--accent-line-gap) !important; background: #b31944; }"""
M = """() => { const q=s=>document.querySelector(s); const r=e=>{if(!e) return null; const b=e.getBoundingClientRect(); return {l:+b.left.toFixed(2), t:+(b.top+scrollY).toFixed(2), w:+b.width.toFixed(2), h:+b.height.toFixed(2), b:+(b.bottom+scrollY).toFixed(2)}};
 const copy=q('#rakhigarhi-reference .rak-hero-copy'), eb=q('[data-testid=block-0-eyebrow]'), a=q('[data-testid=block-0-accent-line]'), h=q('[data-testid=block-0-heading]'); const ph=q('[data-testid=block-0-photos]');
 const bs=getComputedStyle(copy,'::before'); const es=getComputedStyle(eb), hs=getComputedStyle(h);
 const hav=q('#haveli-chaupal .eyebrow'), amb=q('#the-ambition .eyebrow'); const pa=e=>{if(!e) return null; const s=getComputedStyle(e,'::after'); return [s.content, s.width, s.height, s.marginTop, s.backgroundColor]};
 return {copy:r(copy), eb:r(eb), a:r(a), h:r(h), ph:r(ph), img:r(q('[data-testid=block-0-image]')), img2:r(q('[data-testid=block-0-image2]')), before:[bs.content, bs.display, bs.height, bs.width, bs.marginBottom], beforeVisible: bs.content!=='none' && bs.display!=='none',
  pt:getComputedStyle(copy).paddingTop, abg:a&&getComputedStyle(a).backgroundColor, apos:a&&getComputedStyle(a).position, ebFont:[es.fontSize, es.fontFamily, es.fontWeight, es.textTransform, es.letterSpacing], hFont:[hs.fontSize, hs.fontFamily, hs.fontWeight],
  label: eb.querySelector('[data-edit-text]')?.textContent, ebCE: eb.getAttribute('contenteditable'), innerCE: eb.querySelector('[data-edit-text]')?.getAttribute('contenteditable'), nAcc: document.querySelectorAll('.rak-hero-accent').length,
  hav:pa(hav), amb:pa(amb), sw:document.documentElement.scrollWidth, vw:innerWidth} }"""

async def isolate(ctx, clone=True):
    async def h(route):
        url = route.request.url
        if clone and ("/api/admin/pages/rakhigarhi/live" in url or url.split("?")[0].endswith("/api/public/pages/rakhigarhi")):
            return await route.continue_(url=url.replace("/pages/rakhigarhi", f"/pages/{KEY}"))
        if route.request.method != "GET" and "/auth/" not in url and not (clone and KEY in url): BLOCKED.append(url); return await route.abort()
        await route.continue_()
    await ctx.route("**/api/**", h)

def line_ok(tag, m, w=42, th=2, gap=30):
    a, e = m["a"], m["eb"]
    ok(f"{tag} line left == eyebrow left", abs(a["l"] - e["l"]) <= 0.6, (a["l"], e["l"]))
    ok(f"{tag} line {w}x{th}, gap {gap} above eyebrow", abs(a["w"] - w) <= 0.6 and abs(a["h"] - th) <= 0.6 and abs(e["t"] - a["b"] - gap) <= 0.6, (a["w"], a["h"], round(e["t"] - a["b"], 2)))
    ok(f"{tag} single line, no visible parent ::before, ruby", m["nAcc"] == 1 and not m["beforeVisible"] and m["abg"] == "rgb(179, 25, 68)", (m["nAcc"], m["before"], m["abg"]))

async def load(page, url, vw, vh=1000, wait=1800):
    await page.set_viewport_size({"width": vw, "height": vh}); await page.goto(url); await page.wait_for_selector('[data-testid=block-0-accent-line]', state="attached", timeout=25000); await page.wait_for_timeout(wait)
    return await page.evaluate(M)

async def main():
    before, sbefore = fp(), fps()
    d = copy.deepcopy(db.pages.find_one({"key": "rakhigarhi"}, {"_id": 0})); d.update({"key": KEY, "id": uuid.uuid4().hex, "path": f"/{KEY}"})
    for part in ("published", "draft"):
        for s in d[part]["sections"]:
            if s["id"] == HERO: s["styles"] = copy.deepcopy(PROD)
    db.pages.insert_one(d)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            # ---- A: real preview page, GET only, default layout + legacy comparison
            ctx = await b.new_context(); await isolate(ctx, clone=False); page = await ctx.new_page()
            page.on("pageerror", lambda e: ERRS.append(str(e))); page.on("console", lambda m: ERRS.append(m.text) if m.type == "error" and ("React" in m.text or "Warning" in m.text) else None)
            for vw in (1920, 1280, 768, 390):
                m = await load(page, BASE + "/our-work/rakhigarhi", vw)
                line_ok(f"DEF {vw}", m); ok(f"DEF {vw} padding-top 32px", m["pt"] == "32px", m["pt"])
                await page.add_style_tag(content=LEGACY); await page.wait_for_timeout(400); L = await page.evaluate(M)
                bl = await page.evaluate("()=>{const c=document.querySelector('#rakhigarhi-reference .rak-hero-copy'); return +(c.getBoundingClientRect().top+scrollY).toFixed(2)}")
                same = all(abs(m[k][f] - L[k][f]) <= 0.6 for k in ("eb", "h", "ph", "img", "img2") if m[k] for f in ("l", "t", "w", "h"))
                ok(f"DEF {vw} eyebrow/heading/photos identical to legacy CSS", same and m["ebFont"] == L["ebFont"] and m["hFont"] == L["hFont"], {k: (m[k], L[k]) for k in ("eb", "h") } if not same else "")
                ok(f"DEF {vw} new line at legacy ::before spot (top {bl})", abs(m["a"]["t"] - bl) <= 0.6 and abs(m["a"]["l"] - m["copy"]["l"]) <= 0.6, (m["a"]["t"], bl))
                FIX = "html body #public-site#public-site#public-site#public-site #rakhigarhi-reference .rak-hero-copy { padding-top: calc(var(--accent-line) + var(--accent-line-gap)) !important; }"
                await page.evaluate("()=>document.querySelectorAll('style').forEach(s=>{if(s.textContent.includes('.rak-hero-accent { display: none')) s.remove()})"); await page.add_style_tag(content=FIX); await page.wait_for_timeout(300); F = await page.evaluate(M)
                ok(f"DIAG {vw} proposed specificity fix == legacy positions", all(abs(F[k][f] - L[k][f]) <= 0.6 for k in ("eb", "h", "ph") for f in ("l", "t")) and abs(F["a"]["t"] - bl) <= 0.6, (F["eb"]["t"], L["eb"]["t"], F["a"]["t"], bl, F["pt"]))
                ok(f"DEF {vw} no horizontal overflow", m["sw"] <= vw and L["sw"] == m["sw"], (m["sw"], L["sw"]))
                if vw == 1920: print("default 1920", m); d1920 = m
            # Haveli / Ambition lines unchanged
            ok("Haveli ::after line 42x2 gap30", d1920["hav"] and d1920["hav"][1:4] == ["42px", "2px", "30px"], d1920["hav"])
            ok("Ambition ::after line 42x2 gap30", d1920["amb"] and d1920["amb"][1:4] == ["42px", "2px", "30px"], d1920["amb"])
            # Global Header red-line vars (local style tag mimicking HeaderStyleTag output, not saved)
            m = await load(page, BASE + "/our-work/rakhigarhi", 1920)
            await page.add_style_tag(content="html body #public-site { --accent-line-w: 80px !important; --accent-line: 5px !important; --accent-line-gap: 12px !important; }"); await page.wait_for_timeout(300)
            g = await page.evaluate(M); line_ok("VARS 80/5/12", g, 80, 5, 12); ok("VARS padding-top = 17px", g["pt"] == "17px", g["pt"])
            ok("VARS Haveli line follows vars", g["hav"][1:4] == ["80px", "5px", "12px"], g["hav"])
            await ctx.close()
            # ---- B: clone with production-style offsets, public
            ctx = await b.new_context(); await isolate(ctx); page = await ctx.new_page(); page.on("pageerror", lambda e: ERRS.append(str(e)))
            for vw in (1920, 1280, 768, 390):
                m = await load(page, BASE + "/our-work/rakhigarhi", vw)
                line_ok(f"PROD {vw}", m); ok(f"PROD {vw} overflow info", True, (m["sw"], vw, m["eb"]["w"], m["h"]["w"]))
                if vw == 1920:
                    print("prod 1920", m); p1920 = m
                    ok("PROD 1920 eyebrow shifted +60 vs default, line too", abs(m["eb"]["l"] - d1920["eb"]["l"] - 60) <= 0.6 and abs(m["a"]["l"] - d1920["a"]["l"] - 60) <= 0.6, (m["eb"]["l"], d1920["eb"]["l"], m["a"]["l"]))
                    ok("PROD heading 32px kept", m["hFont"][0] == "32px", m["hFont"])
            await ctx.close()
            # ---- C: editor on clone
            ctx = await b.new_context(viewport={"width": 1920, "height": 1080}); await isolate(ctx); page = await ctx.new_page()
            page.on("pageerror", lambda e: ERRS.append(str(e))); page.on("console", lambda m: ERRS.append(m.text) if m.type == "error" and ("React" in m.text or "Warning" in m.text) else None)
            page.on("dialog", lambda dd: asyncio.ensure_future(dd.accept()))
            await page.goto(BASE + "/admin/login"); await page.fill('[data-testid="login-email"]', "admin@uspindia.org"); await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
            await page.click('[data-testid="login-submit"]'); await page.wait_for_url(lambda u: "/admin" in u and "/login" not in u, timeout=20000)
            await page.goto(BASE + "/our-work/rakhigarhi?edit=1"); await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=50000); await page.wait_for_timeout(2000)
            e0 = await page.evaluate(M); line_ok("ED init", e0)
            ab = await page.locator('[data-testid=block-0-accent-line]').bounding_box()
            await page.mouse.click(ab["x"] + 20, ab["y"] + 1); await page.wait_for_timeout(700)
            lbl = await page.locator('[data-testid="live-selected-label"]').inner_text() if await page.locator('[data-testid="live-selected-label"]').count() else None
            s1 = await page.evaluate(M)
            ok("ED click line selects eyebrow", lbl and "eyebrow" in lbl.lower() or (lbl and "label" in lbl.lower()), lbl)
            ok("ED only inner [data-edit-text] contenteditable", s1["innerCE"] == "true" and s1["ebCE"] != "true", (s1["ebCE"], s1["innerCE"]))
            sb = await page.locator('[data-testid=live-selection-box]').bounding_box()
            ok("ED selection box wraps eyebrow", sb and abs(sb["x"] - s1["eb"]["l"]) <= 3, (sb and sb["x"], s1["eb"]["l"]))
            # inline rename
            foc = await page.evaluate("()=>document.activeElement.hasAttribute('data-edit-text')")
            ok("ED (low) after clicking line, label text has focus for typing", foc, foc)
            await page.keyboard.press("End"); await page.keyboard.type("Q"); await page.wait_for_timeout(200)
            tq = await page.evaluate("()=>document.querySelector('[data-testid=block-0-eyebrow] [data-edit-text]').textContent")
            ok("ED first-click typing works after clicking line", tq.strip().endswith("Q"), tq)
            await page.keyboard.press("Backspace"); await page.wait_for_timeout(200)
            # rename by clicking the label text itself
            await page.locator('[data-testid=block-0-eyebrow] [data-edit-text]').click(); await page.wait_for_timeout(500)
            await page.keyboard.press("End"); await page.keyboard.type(" X"); await page.wait_for_timeout(200)
            print("DIAG typed:", await page.evaluate("()=>({txt:document.querySelector('[data-testid=block-0-eyebrow]').textContent, ae:document.activeElement.outerHTML.slice(0,160)})"))
            await page.mouse.click(1850, 1040); await page.wait_for_timeout(600)
            r1 = await page.evaluate(M)
            ok("ED rename keeps line + label 'Rakhigarhi X'", r1["nAcc"] == 1 and (r1["label"] or "").strip() == "Rakhigarhi X", (r1["nAcc"], r1["label"])); line_ok("ED after rename", r1)
            # reselect via text and drag the grip
            await page.locator('[data-testid=block-0-eyebrow] [data-edit-text]').click(); await page.wait_for_timeout(500); await page.keyboard.press("Escape"); await page.wait_for_timeout(200)
            await page.locator('[data-testid=block-0-eyebrow] [data-edit-text]').click(); await page.wait_for_timeout(500)
            pre = await page.evaluate(M)
            g = await page.locator('[data-testid=live-move-grip]').bounding_box()
            await page.mouse.move(g["x"] + g["width"] / 2, g["y"] + g["height"] / 2); await page.mouse.down()
            for i in range(1, 11): await page.mouse.move(g["x"] + g["width"] / 2 + 4.3 * i, g["y"] + g["height"] / 2 + 2.7 * i); await page.wait_for_timeout(30)
            await page.mouse.up(); await page.wait_for_timeout(700)
            dm = await page.evaluate(M)
            dx, dy = dm["eb"]["l"] - pre["eb"]["l"], dm["eb"]["t"] - pre["eb"]["t"]
            ok("ED drag moved eyebrow", abs(dx) > 5 or abs(dy) > 5, (dx, dy))
            ok("ED drag: line moved same dx/dy", abs((dm["a"]["l"] - pre["a"]["l"]) - dx) <= 0.6 and abs((dm["a"]["t"] - pre["a"]["t"]) - dy) <= 0.6, (dm["a"]["l"] - pre["a"]["l"], dm["a"]["t"] - pre["a"]["t"], dx, dy)); line_ok("ED after drag", dm)
            ok("ED drag: heading/photos not moved", all(abs(dm[k][f] - pre[k][f]) <= 0.6 for k in ("h", "img", "img2") if pre[k] for f in ("l", "t")), {k: (pre[k], dm[k]) for k in ("h", "img")})
            # Move X input nudge
            await page.evaluate("()=>{const i=document.querySelector('[data-testid=live-move-x]'); let d=i&&i.closest('details'); while(d){d.open=true; d=d.parentElement&&d.parentElement.closest('details')}}"); await page.wait_for_timeout(300)
            mx = page.locator('[data-testid=live-move-x]')
            if await mx.count():
                cur = float(await mx.input_value() or 0); await mx.fill(str(int(cur) + 15)); await page.wait_for_timeout(1200); nm = await page.evaluate(M)
                ok("ED Move X +15 moves line+text together", abs(nm["eb"]["l"] - dm["eb"]["l"] - (int(cur) + 15 - cur)) <= 1 and abs(nm["a"]["l"] - nm["eb"]["l"]) <= 0.6, (nm["eb"]["l"], dm["eb"]["l"], nm["a"]["l"]))
            else: ok("ED Move X input present", False); nm = dm
            # undo/redo
            await page.locator('[data-testid=live-undo]').click(); await page.wait_for_timeout(1200); u1 = await page.evaluate(M)
            ok("ED undo restores pre-nudge pos", abs(u1["eb"]["l"] - dm["eb"]["l"]) <= 1 and abs(u1["a"]["l"] - u1["eb"]["l"]) <= 0.6, (u1["eb"]["l"], dm["eb"]["l"]))
            await page.locator('[data-testid=live-redo]').click(); await page.wait_for_timeout(1200); r2 = await page.evaluate(M)
            ok("ED redo re-applies", abs(r2["eb"]["l"] - nm["eb"]["l"]) <= 1 and r2["nAcc"] == 1 and abs(r2["a"]["l"] - r2["eb"]["l"]) <= 0.6, (r2["eb"]["l"], nm["eb"]["l"]))
            await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
            ed = await page.evaluate(M); print("editor final", ed)
            async with page.expect_response(lambda rr: "/live" in rr.url and rr.request.method == "PUT", timeout=15000) as ri:
                await page.locator('[data-testid="live-save-btn"]').dispatch_event("click")
            st = (await ri.value).status; ok("ED save 200 (clone)", st == 200, st); await page.wait_for_timeout(1200)
            sec = next(s for s in db.pages.find_one({"key": KEY})["published"]["sections"] if s["id"] == HERO); print("saved", sec["styles"], sec["data"].get("eyebrow"))
            ok("DB clone eyebrow label + translate saved; heading untouched", sec["data"]["eyebrow"] == "Rakhigarhi X" and sec["styles"]["heading"] == PROD["heading"] and sec["styles"]["eyebrow"].get("width") == "1270px" and sec["styles"]["eyebrow"].get("translateY"), sec["styles"])
            await ctx.close()
            ctx = await b.new_context(); await isolate(ctx); page = await ctx.new_page(); page.on("pageerror", lambda e: ERRS.append(str(e)))
            f = await load(page, BASE + "/our-work/rakhigarhi", 1920, 1080)
            line_ok("FRESH", f)
            ok("FRESH geometry == editor", all(abs(f[k][x] - ed[k][x]) <= 1 for k in ("eb", "a", "h") for x in ("l", "t", "w")), {k: (f[k], ed[k]) for k in ("eb", "a")})
            ok("FRESH label + fonts", (f["label"] or "").strip() == "Rakhigarhi X" and f["ebFont"] == ed["ebFont"] and f["hFont"] == ed["hFont"] == p1920["hFont"], (f["label"], f["ebFont"], f["hFont"]))
            await ctx.close(); await b.close()
    except Exception as e:
        ok("EXCEPTION", False, repr(e)[:500])
    finally:
        db.pages.delete_many({"key": KEY}); db.revisions.delete_many({"entity_id": KEY})
        ok("REAL rakhigarhi unchanged", fp() == before); ok("settings unchanged", fps() == sbefore)
        ok("no React errors/pageerrors", not ERRS, ERRS[:5]); print("blocked", BLOCKED)
        print(f"TOTAL {sum(r for _, r in R)}/{len(R)}; FAILS:", [n for n, r in R if not r])
asyncio.run(main())
