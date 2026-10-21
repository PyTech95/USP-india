# Iter19 ISOLATED Playwright: Rakhigarhi "The Ambition" spacing/footer/height/width on TEST_ clone seeded with prod typography (h28/body18).
# All rakhigarhi API calls rerouted to clone; other writes aborted; real page fingerprinted; clone deleted in finally.
import asyncio, os, json, uuid, copy, hashlib
from playwright.async_api import async_playwright
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env"); load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
SID = "1017b7e20a8648a0b3f8c546ed6f89d6"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = f"TEST_rak_{uuid.uuid4().hex[:8]}"
R, BLOCKED = [], []
def ok(n, c, i=""): R.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n, i)
def fp(): return hashlib.sha256(json.dumps(db.pages.find_one({"key": "rakhigarhi"}, {"_id": 0}), sort_keys=True, default=str).encode()).hexdigest()
def amb(): return next(s for s in db.pages.find_one({"key": KEY})["published"]["sections"] if s["id"] == SID)
M = """() => { const w=document.querySelector('#the-ambition'); const st=w.querySelector('.stacked')||w.querySelector('section'); const f=document.querySelector('footer');
 const wr=w.getBoundingClientRect(), sr=st.getBoundingClientRect(), fr=f.getBoundingClientRect(), cs=getComputedStyle(st); const body=w.querySelector('.ambition-body'); const dv=w.querySelector('.ambition-divider');
 const texts=[...w.querySelectorAll('h2,p,.eyebrow')]; const lastB=Math.max(...texts.map(e=>e.getBoundingClientRect().bottom)); const par=w.parentElement.getBoundingClientRect();
 const h=w.querySelector('[data-edit=heading]'); const p=w.querySelector('.ambition-text p');
 return {wx:Math.round(wr.left), wr:Math.round(wr.right), ww:Math.round(wr.width), wh:Math.round(wr.height), wtop:Math.round(wr.top+scrollY), pt:cs.paddingTop, pb:cs.paddingBottom,
  gapText:Math.round(wr.bottom-lastB), footGap:Math.round(fr.top-wr.bottom), fx:Math.round(fr.left), fxr:Math.round(fr.right), parL:Math.round(wr.left-par.left), parR:Math.round(par.right-wr.right),
  hfs:h&&getComputedStyle(h).fontSize, pfs:p&&getComputedStyle(p).fontSize, boxes:[1,2,3].map(i=>!!w.querySelector(`[data-edit=body_${i}_html]`)), divRatio: dv&&body? +(dv.getBoundingClientRect().height/body.getBoundingClientRect().height).toFixed(2):null,
  clip: lastB > wr.bottom+1, vw:innerWidth} }"""

async def isolate(ctx):
    async def h(route):
        url = route.request.url
        if "/api/admin/pages/rakhigarhi/live" in url or url.split("?")[0].endswith("/api/public/pages/rakhigarhi"):
            return await route.continue_(url=url.replace("/pages/rakhigarhi", f"/pages/{KEY}"))
        if route.request.method != "GET" and "/auth/" not in url: BLOCKED.append(url); return await route.abort()
        await route.continue_()
    await ctx.route("**/api/**", h)

async def main():
    before = fp()
    d = copy.deepcopy(db.pages.find_one({"key": "rakhigarhi"}, {"_id": 0})); d.update({"key": KEY, "id": uuid.uuid4().hex, "path": f"/{KEY}"})
    for part in ("published", "draft"):
        for s in d[part]["sections"]:
            if s["id"] == SID: s["styles"] = {"body_html": {"fontSize": "18px"}, "heading": {"fontSize": "28px"}}
    db.pages.insert_one(d)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1920, "height": 1080}); await isolate(ctx)
            page = await ctx.new_page(); page.on("dialog", lambda dd: asyncio.ensure_future(dd.accept()))
            for vw, vh, ept, epb in ((1920, 1080, "72px", "64px"), (1440, 900, "72px", "64px"), (390, 844, "40px", "40px")):
                await page.set_viewport_size({"width": vw, "height": vh}); await page.goto(BASE + "/our-work/rakhigarhi"); await page.wait_for_selector("#the-ambition", timeout=20000); await page.evaluate("document.querySelector('#the-ambition').scrollIntoView({block:'end'})"); await page.wait_for_timeout(1800)
                m = await page.evaluate(M); print(vw, m)
                if m["clip"]: print("  overflowing:", await page.evaluate("()=>{const w=document.querySelector('#the-ambition'); const wb=w.getBoundingClientRect().bottom; return [...w.querySelectorAll('h2,p,.eyebrow')].filter(e=>e.getBoundingClientRect().bottom>wb+1).map(e=>[e.tagName, e.className, (e.innerText||'').slice(0,40), Math.round(e.getBoundingClientRect().bottom-wb), getComputedStyle(e).marginBottom, getComputedStyle(w).overflow, getComputedStyle(w.querySelector('.stacked')).height, w.getAttribute('style')])}"))
                ok(f"PUB {vw} default padding {ept}/{epb}", m["pt"] == ept and m["pb"] == epb, (m["pt"], m["pb"]))
                ok(f"PUB {vw} footer gap 0 + edges aligned", abs(m["footGap"]) <= 1 and abs(m["fx"] - m["wx"]) <= 1 and abs(m["fxr"] - m["wr"]) <= 1, (m["footGap"], m["fx"], m["wx"], m["fxr"], m["wr"]))
                ok(f"PUB {vw} text bottom gap ~ padding (no excess)", m["gapText"] <= int(epb[:-2]) + 30 and not m["clip"], m["gapText"])
                if vw == 1920:
                    ok("PUB typography h28/body18 + 3 boxes + divider 70%", m["hfs"] == "28px" and m["pfs"] == "18px" and all(m["boxes"]) and m["divRatio"] == 0.7, (m["hfs"], m["pfs"], m["boxes"], m["divRatio"]))
                    pub_default = m
            await page.set_viewport_size({"width": 1920, "height": 1080})
            await page.goto(BASE + "/admin/login"); await page.fill('[data-testid="login-email"]', "admin@uspindia.org"); await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
            await page.click('[data-testid="login-submit"]'); await page.wait_for_url(lambda u: "/admin" in u and "/login" not in u, timeout=20000)
            await page.goto(BASE + "/our-work/rakhigarhi?edit=1"); await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=50000); await page.wait_for_timeout(2000)
            e0 = await page.evaluate(M); print("editor default", e0)
            st = page.locator("#the-ambition .stacked").first; await st.scroll_into_view_if_needed(); bb = await st.bounding_box()
            await page.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + 15); await page.wait_for_timeout(700)
            print("selected:", await page.locator('[data-testid="live-selected-label"]').inner_text() if await page.locator('[data-testid="live-selected-label"]').count() else None)
            pbx = page.locator('[data-testid="live-sec-pad-bottom"]'); ptx = page.locator('[data-testid="live-sec-pad-top"]')
            ok("ED whole section selected (padding controls visible)", await pbx.count() == 1)
            ok("ED pad-bottom placeholder shows actual inner 64", await pbx.get_attribute("placeholder") == "64", await pbx.get_attribute("placeholder"))
            for v in ("0", "20"):
                await pbx.fill(v); await page.wait_for_timeout(500); m = await page.evaluate(M)
                ok(f"ED pad-bottom {v} sets ACTUAL inner padding (not additive)", m["pb"] == f"{v}px" and abs(m["wh"] - (e0["wh"] - 64 + int(v))) <= 2, (m["pb"], m["wh"], e0["wh"]))
            await ptx.fill("30"); await page.wait_for_timeout(500); m = await page.evaluate(M)
            ok("ED pad-top 30 applied", m["pt"] == "30px" and abs(m["wh"] - (e0["wh"] - 64 + 20 - 72 + 30)) <= 2, (m["pt"], m["wh"]))
            await page.evaluate("()=>{const d=document.querySelector('[data-testid=live-group-layout]'); if(d) d.open=true}")
            hx = page.locator('[data-testid="live-height"]'); base_h = m["wh"]
            await hx.fill("1200"); await page.wait_for_timeout(500); m = await page.evaluate(M)
            ok("ED min-height 1200 grows section, footer still adjacent", abs(m["wh"] - 1200) <= 2 and abs(m["footGap"]) <= 1, (m["wh"], m["footGap"]))
            await hx.fill("200"); await page.wait_for_timeout(500); m = await page.evaluate(M)
            ok("ED height 200 shrinks safely to content (no clip into footer)", not m["clip"] and m["footGap"] >= -1 and abs(m["wh"] - base_h) <= 2, (m["wh"], base_h, m["clip"], m["footGap"]))
            lab = await page.evaluate("()=>{const i=document.querySelector('[data-testid=live-height]'); return i&&i.closest('label')&&i.closest('label').innerText}")
            ok("ED height label says Minimum height", lab and "Minimum" in lab, lab)
            wx = page.locator('[data-testid="live-width"]')
            await wx.fill("1000"); await page.wait_for_timeout(500); m = await page.evaluate(M)
            ok("ED width 1000 centered", abs(m["ww"] - 1000) <= 2 and abs(m["parL"] - m["parR"]) <= 2, (m["ww"], m["parL"], m["parR"]))
            await wx.fill("5000"); await page.wait_for_timeout(500); m = await page.evaluate(M)
            ok("ED width 5000 bounded (no overflow)", m["ww"] <= m["vw"] and await page.evaluate("document.documentElement.scrollWidth") <= m["vw"], (m["ww"], m["vw"]))
            await wx.fill("1100"); await hx.fill(""); await page.wait_for_timeout(500)
            ed = await page.evaluate(M); print("editor final", ed)
            ok("ED typography untouched by section edits", ed["hfs"] == "28px" and ed["pfs"] == "18px" and ed["divRatio"] == 0.7, (ed["hfs"], ed["pfs"], ed["divRatio"]))
            async with page.expect_response(lambda rr: "/live" in rr.url and rr.request.method == "PUT", timeout=15000) as ri:
                await page.locator('[data-testid="live-save-btn"]').dispatch_event("click")
            ok("ED save 200 (clone)", (await ri.value).status == 200, (await ri.value).status); await page.wait_for_timeout(1200)
            sec = amb()["styles"]; print("saved styles", sec)
            ok("DB clone _section saved paddings/width; heading/body fonts kept", (sec.get("_section") or {}).get("paddingBottom") == "20px" and (sec.get("_section") or {}).get("width") == "1100px" and sec["heading"]["fontSize"] == "28px" and all(sec[f"body_{i}_html"]["fontSize"] == "18px" for i in (1,2,3)), sec)
            await page.locator('[data-testid="live-exit-btn"]').dispatch_event("click"); await page.wait_for_timeout(500)
            ctx2 = await b.new_context(viewport={"width": 1920, "height": 1080}); await isolate(ctx2); p2 = await ctx2.new_page()
            await p2.goto(BASE + "/our-work/rakhigarhi"); await p2.wait_for_selector("#the-ambition"); await p2.wait_for_timeout(1500)
            pub = await p2.evaluate(M); print("fresh public", pub)
            ok("FRESH public geometry == editor (w/h/padding)", abs(pub["ww"] - ed["ww"]) <= 2 and abs(pub["wh"] - ed["wh"]) <= 2 and pub["pb"] == ed["pb"] and pub["pt"] == ed["pt"], ((pub["ww"], pub["wh"], pub["pt"], pub["pb"]), (ed["ww"], ed["wh"], ed["pt"], ed["pb"])))
            ok("FRESH public centered + footer gap 0", abs(pub["parL"] - pub["parR"]) <= 2 and abs(pub["footGap"]) <= 1 and not pub["clip"], (pub["parL"], pub["parR"], pub["footGap"], pub["fx"], pub["wx"]))
            ok("FRESH footer edges vs custom-width section (info)", True, f"footer {pub['fx']}-{pub['fxr']} section {pub['wx']}-{pub['wr']}")
            await p2.set_viewport_size({"width": 390, "height": 844}); await p2.evaluate("document.querySelector('#the-ambition').scrollIntoView({block:'end'})"); await p2.wait_for_timeout(1800); mm = await p2.evaluate(M)
            ok("FRESH 390 no overflow + no clip", mm["ww"] <= 390 and not mm["clip"] and await p2.evaluate("document.documentElement.scrollWidth") <= 390, mm)
            await p2.screenshot(path="/app/.screenshots/iter19_amb_390.jpg", quality=40); await ctx2.close(); await b.close()
    except Exception as e:
        ok("EXCEPTION", False, repr(e)[:400])
    finally:
        db.pages.delete_many({"key": KEY}); db.revisions.delete_many({"entity_id": KEY})
        ok("REAL rakhigarhi unchanged", fp() == before); print("blocked", BLOCKED)
        print(f"TOTAL {sum(r for _, r in R)}/{len(R)}; FAILS:", [n for n, r in R if not r])
asyncio.run(main())
