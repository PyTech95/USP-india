# Iter19 ISOLATED Playwright: grouped action editing (text+arrow) on a TEST_ clone of home, seeded with LIVE offsets/fonts,
# plus LiveEditor panel pinning/stacking. All home writes rerouted to clone; real pages fingerprinted; cleanup + capture in finally.
import asyncio, os, json, uuid, copy, hashlib, sys
from playwright.async_api import async_playwright
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env"); load_dotenv("/app/frontend/.env")
sys.path.insert(0, "/app/backend")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
SUF = uuid.uuid4().hex[:8]; PKEY = f"TEST_home_{SUF}"
NF, CI = "67d62a4864a04020805b3373b16c9ff8", "2b482fb1a353455eacb10261d5db8702"
RES, BLOCKED = [], []
def ok(n, c, info=""): RES.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n, info)
def fp(k): return hashlib.sha256(json.dumps(db.pages.find_one({"key": k}, {"_id": 0}), sort_keys=True, default=str).encode()).hexdigest()
def clone_sec(sid): return next(s for s in db.pages.find_one({"key": PKEY})["published"]["sections"] if s["id"] == sid)

async def isolate(ctx):
    async def h(route):
        req = route.request; url = req.url; p = url.split("?")[0]
        if "/admin/pages/home/live" in p or p.endswith("/public/pages/home"):
            return await route.continue_(url=url.replace("/pages/home", f"/pages/{PKEY}"))
        if req.method != "GET" and "/auth/" not in url:
            BLOCKED.append((req.method, url)); return await route.abort()
        await route.continue_()
    await ctx.route("**/api/**", h)

GEOM = """(tid) => { const a=document.querySelector(`[data-testid="${tid}"]`); if(!a) return null; const t=a.querySelector('[data-edit-text]'); const s=a.querySelector('svg');
 const ar=a.getBoundingClientRect(), tr=t.getBoundingClientRect(), sr=s&&s.getBoundingClientRect(); const cs=getComputedStyle(a), ts=getComputedStyle(t);
 return {href:a.getAttribute('href'), group:a.dataset.editGroup, edit:a.dataset.edit||null, txt:t.innerText, font:ts.fontSize, lines:t.getClientRects().length, th:Math.round(tr.height), lh:ts.lineHeight,
  ax:Math.round(ar.left), ay:Math.round(ar.top), aw:Math.round(ar.width), tx:Math.round(tr.left), ty:Math.round(tr.top), sx:sr&&Math.round(sr.left), sy:sr&&Math.round(sr.top),
  gap: sr?Math.round(sr.left-tr.right):null, vc: sr?Math.round(Math.abs((sr.top+sr.height/2)-(tr.top+tr.height/2))):null,
  rootT:cs.transform, textT:ts.transform, svgT:s?getComputedStyle(s).transform:null, rootCE:a.isContentEditable&&a.getAttribute('contenteditable'), textCE:t.getAttribute('contenteditable')} }"""
PANEL = """() => { const p=document.querySelector('[data-testid=live-editor-panel]'); if(!p) return null; const r=p.getBoundingClientRect(); const b=document.querySelector('[data-testid=live-save-btn]').getBoundingClientRect();
 const x=document.querySelector('[data-testid=live-exit-btn]').getBoundingClientRect(); const hs=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2); const hx=document.elementFromPoint(x.left+x.width/2,x.top+x.height/2);
 const box=document.querySelector('[data-testid=live-selection-box]');
 return {top:Math.round(r.top), z:getComputedStyle(p).zIndex, boxZ:box?getComputedStyle(box).zIndex:null, saveHit:!!hs&&!!hs.closest('[data-testid=live-save-btn]'), exitHit:!!hx&&!!hx.closest('[data-testid=live-exit-btn]'), saveTop:Math.round(b.top), hitName: hs&&(hs.dataset.testid||hs.className), scrollY:Math.round(scrollY)} }"""

def aligned(g, font="22px"):
    return g and g["font"] == font and g["lines"] == 1 and g["vc"] is not None and g["vc"] <= 4 and 0 <= g["gap"] <= 16 and g["textT"] == "none" and g["svgT"] == "none"

async def public_checks(page, tag):
    await page.goto(BASE + "/"); await page.wait_for_selector(f'[data-testid="block-{NF}-more"], [data-testid*="-more"]', timeout=20000); await page.wait_for_timeout(1500)
    nf = await page.evaluate(GEOM, f"{NF}-more") if await page.locator(f'[data-testid="{NF}-more"]').count() else await page.evaluate("()=>[...document.querySelectorAll('[data-testid$=-more]')].map(e=>e.dataset.testid)")
    return nf

async def main():
    before = {k: fp(k) for k in ("home", "rakhigarhi", "theatre")}
    d = copy.deepcopy(db.pages.find_one({"key": "home"}, {"_id": 0})); d.update({"key": PKEY, "id": uuid.uuid4().hex, "path": f"/{PKEY}"})
    for part in ("published", "draft"):
        for s in d[part]["sections"]:
            if s["id"] == NF: s.setdefault("styles", {})["more_label"] = {"translateX": "6.887px", "translateY": "21.4px", "width": "202px", "fontSize": "22px"}
            if s["id"] == CI: s.setdefault("styles", {})["buttons.0.label"] = {"translateX": "85px", "translateY": "-42px", "width": "143px", "fontSize": "22px"}
    db.pages.insert_one(d)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1920, "height": 1080}); await isolate(ctx)
            page = await ctx.new_page(); errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
            # ---- public (anonymous) checks
            await page.goto(BASE + "/"); await page.wait_for_timeout(3500)
            tids = await page.evaluate("()=>[...document.querySelectorAll('[data-edit-group=action]')].map(e=>e.dataset.testid)")
            print("action groups:", tids)
            nf_tid = next((t for t in tids if t and t.endswith("-more")), None)
            ci_tid = await page.evaluate("()=>{const e=[...document.querySelectorAll('[data-edit-group=action]')].find(e=>e.innerText.includes('Get in Touch')); return e&&e.dataset.testid}")
            rk = await page.evaluate(GEOM, "work-item-0-explore")
            ok("HOME Rakhigarhi explore visible + href", rk and rk["href"] == "/our-work/rakhigarhi" and rk["txt"].strip() == "Explore Rakhigarhi" and rk["aw"] > 20, rk)
            for tid, nm in ((nf_tid, "NotesMore"), (ci_tid, "GetInTouch")):
                g = await page.evaluate(GEOM, tid) if tid else None
                print(nm, tid, g)
                ok(f"PUB {nm} font22 single-line arrow aligned, no doubled transforms", aligned(g), g)
                ok(f"PUB {nm} root has seeded transform", g and g["rootT"] != "none", g and g["rootT"])
            pub0 = {"nf": await page.evaluate(GEOM, nf_tid), "ci": await page.evaluate(GEOM, ci_tid)}
            # other homepage typography unchanged vs real: compare computed font sizes of h1/h2/p against real home (route bypass in new ctx)
            fonts_clone = await page.evaluate("()=>[...document.querySelectorAll('main h1,main h2,main h3,main p')].slice(0,40).map(e=>getComputedStyle(e).fontSize).join(',')")
            ctx2 = await b.new_context(viewport={"width": 1920, "height": 1080}); p2 = await ctx2.new_page(); await p2.goto(BASE + "/"); await p2.wait_for_timeout(3500)
            fonts_real = await p2.evaluate("()=>[...document.querySelectorAll('main h1,main h2,main h3,main p')].slice(0,40).map(e=>getComputedStyle(e).fontSize).join(',')")
            ok("PUB other homepage title/text fonts identical to real home", fonts_clone == fonts_real, (fonts_clone[:200], fonts_real[:200]))
            await ctx2.close()
            # theatre archive link absent
            await page.goto(BASE + "/our-work/theatre"); await page.wait_for_timeout(2500)
            ok("THEATRE deleted archive link absent", await page.locator('[data-testid="block-50af8d23713b4ada8587344dfeef6dde-link"], [data-testid="50af8d23713b4ada8587344dfeef6dde-link"]').count() == 0)
            tl = await page.evaluate("()=>[...document.querySelectorAll('.theatre-link')].map(e=>({t:e.innerText,g:e.dataset.editGroup,svg:!!e.querySelector('svg'),txt:!!e.querySelector('[data-edit-text]')}))")
            ok("THEATRE existing link grouped (text+svg)", len(tl) >= 1 and all(x["g"] == "action" and x["svg"] and x["txt"] for x in tl), tl)
            # ---- login + editor
            await page.goto(BASE + "/admin/login")
            await page.fill('[data-testid="login-email"]', "admin@uspindia.org"); await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
            await page.click('[data-testid="login-submit"]'); await page.wait_for_url(lambda u: "/admin" in u and "/login" not in u, timeout=20000); await page.wait_for_timeout(800)
            await page.goto(BASE + "/?edit=1"); await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(2000)
            pn = await page.evaluate(PANEL); ok("ED panel top 12 at load + buttons hit", pn["top"] == 12 and pn["saveHit"] and pn["exitHit"], pn)
            g0 = await page.evaluate(GEOM, nf_tid); print("editor NF", g0)
            ok("ED NF in editor aligned font22", aligned(g0), g0)
            ok("ED NF root carries data-edit=more_label", g0["edit"] == "more_label", g0["edit"])
            # click arrow selects whole action
            await page.locator(f'[data-testid="{nf_tid}"] svg').scroll_into_view_if_needed(); await page.wait_for_timeout(300)
            await page.locator(f'[data-testid="{nf_tid}"] svg').click(force=True); await page.wait_for_timeout(700)
            lbl = await page.locator('[data-testid="live-selected-label"]').inner_text() if await page.locator('[data-testid="live-selected-label"]').count() else None
            box = await page.evaluate("()=>{const b=document.querySelector('[data-testid=live-selection-box]'); return b&&b.getBoundingClientRect().toJSON()}")
            ar = await page.evaluate(f"()=>document.querySelector('[data-testid=\"{nf_tid}\"]').getBoundingClientRect().toJSON()")
            ok("ED arrow click selects whole action (box ~ root)", box and abs(box["width"] - ar["width"]) < 8 and abs(box["left"] - ar["left"]) < 8, (lbl, box and round(box["width"]), round(ar["width"])))
            g1 = await page.evaluate(GEOM, nf_tid)
            ok("ED only [data-edit-text] contenteditable, root not", g1["textCE"] == "true" and not g1["rootCE"], (g1["textCE"], g1["rootCE"]))
            pn = await page.evaluate(PANEL); ok("ED panel top12 & above selection after select+scroll", pn["top"] == 12 and pn["saveHit"] and (pn["boxZ"] is None or int(pn["z"]) > int(pn["boxZ"])), pn)
            # font size via inspector
            fs = page.locator('[data-testid="live-font-size"]')
            ok("ED inspector font size shows 22", await fs.count() and await fs.input_value() == "22", await fs.input_value() if await fs.count() else None)
            await fs.fill("26"); await page.wait_for_timeout(500)
            g2 = await page.evaluate(GEOM, nf_tid); ok("ED font 26 applied; arrow still aligned/single line", aligned(g2, "26px"), g2)
            # nudge move X
            if not await page.locator('[data-testid="live-move-x"]').is_visible():
                await page.evaluate("()=>{const d=document.querySelector('[data-testid=live-group-layout]'); if(d) d.open=true}"); await page.wait_for_timeout(300)
            mx = page.locator('[data-testid="live-move-x"]'); a = await page.evaluate(GEOM, nf_tid)
            await mx.fill("46.887"); await page.wait_for_timeout(500); c = await page.evaluate(GEOM, nf_tid)
            ok("ED move X +40: text and arrow move together by ~40", abs((c["tx"] - a["tx"]) - 40) <= 2 and abs((c["sx"] - a["sx"]) - 40) <= 2, (c["tx"] - a["tx"], c["sx"] - a["sx"]))
            # drag move grip
            grip = page.locator('[data-testid="live-move-grip"]')
            if await grip.count():
                gb = await grip.bounding_box(); a = await page.evaluate(GEOM, nf_tid)
                await page.mouse.move(gb["x"] + gb["width"] / 2, gb["y"] + gb["height"] / 2); await page.mouse.down()
                await page.mouse.move(gb["x"] + gb["width"] / 2 - 30, gb["y"] + gb["height"] / 2 + 20, steps=8); await page.mouse.up(); await page.wait_for_timeout(500)
                c = await page.evaluate(GEOM, nf_tid); dx, sdx = c["tx"] - a["tx"], c["sx"] - a["sx"]
                ok("ED drag grip: text+arrow same delta, no doubled transform", abs(dx) >= 10 and abs(dx - sdx) <= 2 and c["textT"] == "none" and c["svgT"] == "none", (dx, sdx, c["textT"], c["svgT"]))
            else: ok("ED move grip present", False)
            # resize east handle
            cov = await page.evaluate("()=>{const h=document.querySelector('[data-testid=live-resize-e]'); if(!h) return null; const r=h.getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return e&&(e.closest('[data-testid=live-editor-panel]')?'PANEL':(e.dataset.testid||e.className))}")
            print("INFO east handle hit-test:", cov)
            he = page.locator('[data-testid="live-resize-w"]')
            if await he.count():
                hb = await he.bounding_box(); a = await page.evaluate(GEOM, nf_tid)
                await page.mouse.move(hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2); await page.mouse.down()
                await page.mouse.move(hb["x"] - 40, hb["y"] + hb["height"] / 2, steps=8); await page.mouse.up(); await page.wait_for_timeout(500)
                c = await page.evaluate(GEOM, nf_tid); print("width input after resize", await page.locator('[data-testid="live-width"]').input_value(), "handle", hb)
                ok("ED resize w: width grows; arrow stays adjacent single-line", c["aw"] > a["aw"] and c["lines"] == 1 and c["vc"] <= 4 and c["gap"] <= 16, (a["aw"], c["aw"], c["gap"], c["lines"]))
            pn = await page.evaluate(PANEL); ok("ED panel top12 after drag/resize", pn["top"] == 12 and pn["saveHit"], pn)
            # undo/redo
            await page.locator('[data-testid="live-undo"]').dispatch_event('click'); await page.wait_for_timeout(400)
            u = await page.evaluate(GEOM, nf_tid); print("after undo", u["aw"], u["font"])
            await page.locator('[data-testid="live-redo"]').dispatch_event('click'); await page.wait_for_timeout(400)
            r = await page.evaluate(GEOM, nf_tid); ok("ED undo/redo keep svg + group", r["sx"] is not None and u["sx"] is not None and r["group"] == "action", (u["aw"], r["aw"]))
            # set deterministic geometry, inline rename
            await page.locator(f'[data-testid="{nf_tid}"] [data-edit-text]').click(force=True); await page.wait_for_timeout(400)
            await page.evaluate("()=>{const d=document.querySelector('[data-testid=live-group-layout]'); if(d) d.open=true}")
            await page.fill('[data-testid="live-width"]', "260"); await page.fill('[data-testid="live-move-x"]', "10"); await page.fill('[data-testid="live-move-y"]', "20"); await page.fill('[data-testid="live-font-size"]', "24"); await page.wait_for_timeout(300)
            t = page.locator(f'[data-testid="{nf_tid}"] [data-edit-text]'); await t.click(); await page.wait_for_timeout(300)
            await page.keyboard.press("Control+A"); await page.keyboard.type("TEST Explore Notes"); await page.wait_for_timeout(300)
            ed = await page.evaluate(GEOM, nf_tid); print("editor final", ed)
            ok("ED inline rename keeps svg & group", ed["txt"] == "TEST Explore Notes" and ed["sx"] is not None, ed["txt"])
            async with page.expect_response(lambda rr: "/live" in rr.url and rr.request.method == "PUT", timeout=15000) as ri:
                await page.locator('[data-testid="live-save-btn"]').dispatch_event('click')
            ok("ED save 200 to clone", (await ri.value).status == 200, (await ri.value).status)
            await page.wait_for_timeout(1200)
            s = clone_sec(NF); st = s.get("styles", {}).get("more_label")
            ok("DB clone more_label renamed + styles persisted", s["data"]["more_label"] == "TEST Explore Notes" and st.get("fontSize") == "24px" and st.get("width") == "260px" and st.get("translateX") == "10px", (s["data"]["more_label"], st))
            ok("DB clone GetInTouch seeded styles untouched", clone_sec(CI)["styles"]["buttons.0.label"] == {"translateX": "85px", "translateY": "-42px", "width": "143px", "fontSize": "22px"})
            await page.reload(); await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(2000)
            rl = await page.evaluate(GEOM, nf_tid)
            ok("ED reload: same geometry, svg kept, font24", rl["font"] == "24px" and rl["sx"] is not None and abs(rl["tx"] - ed["tx"]) <= 2 and rl["rootT"] == ed["rootT"] and abs(rl["aw"] - ed["aw"]) <= 2 and rl["lines"] == 1, (rl["tx"], ed["tx"], rl["rootT"], ed["rootT"], rl["aw"], ed["aw"]))
            # panel under scroll / viewports
            for y in (0, 2000, 99999):
                await page.evaluate(f"scrollTo(0,{y})"); await page.wait_for_timeout(300)
                pn = await page.evaluate(PANEL); ok(f"ED panel top12 at scroll {y}", pn["top"] == 12 and pn["saveHit"] and pn["exitHit"], pn)
            # Get in Touch in editor
            await page.locator(f'[data-testid="{ci_tid}"] svg').scroll_into_view_if_needed(); await page.locator(f'[data-testid="{ci_tid}"] svg').click(force=True); await page.wait_for_timeout(600)
            gi = await page.evaluate(GEOM, ci_tid); ok("ED GetInTouch arrow click -> root edit buttons.0.label, only text CE", gi["edit"] == "buttons.0.label" and gi["textCE"] == "true" and not gi["rootCE"], gi)
            ok("ED GetInTouch inspector font 22", await page.locator('[data-testid="live-font-size"]').input_value() == "22")
            # Our Work items.0 link label
            await page.locator('[data-testid="work-item-0-explore"] svg').scroll_into_view_if_needed(); await page.locator('[data-testid="work-item-0-explore"] svg').click(force=True); await page.wait_for_timeout(600)
            w0 = await page.evaluate(GEOM, "work-item-0-explore"); ok("ED OurWork items.0.link_label grouped", w0["edit"] == "items.0.link_label" and w0["textCE"] == "true" and not w0["rootCE"], w0)
            # mobile panel
            for vw, vh in ((768, 1024), (390, 844)):
                await page.set_viewport_size({"width": vw, "height": vh}); await page.wait_for_timeout(700); await page.evaluate("scrollTo(0,1500)"); await page.wait_for_timeout(300)
                pn = await page.evaluate(PANEL); ok(f"ED panel top12 at {vw}", pn["top"] == 12 and pn["saveHit"], pn)
            await page.set_viewport_size({"width": 1920, "height": 1080}); await page.wait_for_timeout(500)
            # delete label -> action removed, section stays
            t = page.locator(f'[data-testid="{nf_tid}"] [data-edit-text]'); await t.scroll_into_view_if_needed(); await t.click(force=True); await page.wait_for_timeout(300); await t.click(); await page.wait_for_timeout(300)
            await page.keyboard.press("Control+A"); await page.keyboard.press("Delete"); await page.wait_for_timeout(300)
            async with page.expect_response(lambda rr: "/live" in rr.url and rr.request.method == "PUT", timeout=15000) as ri:
                await page.locator('[data-testid="live-save-btn"]').dispatch_event('click')
            await page.wait_for_timeout(1500); s = clone_sec(NF)
            ok("DEL label saved empty, section kept", (await ri.value).status == 200 and not s["data"].get("more_label") and s["type"] == "notes_feed", repr(s["data"].get("more_label")))
            ok("DEL action removed from DOM, notes section present", await page.locator(f'[data-testid="{nf_tid}"]').count() == 0 and await page.locator(f'[data-testid="{nf_tid[:-5]}"]').count() == 1)
            await page.screenshot(path="/app/.screenshots/iter19_home_editor.jpg", quality=40)
            print("page errors", errs[:5], "blocked", BLOCKED[:5]); await b.close()
    except Exception as e:
        ok("EXCEPTION", False, repr(e)[:500])
    finally:
        db.pages.delete_many({"key": PKEY}); db.revisions.delete_many({"entity_id": PKEY})
        ok("REAL home/rakhigarhi/theatre unchanged", {k: fp(k) for k in before} == before)
        print(f"TOTAL {sum(r for _, r in RES)}/{len(RES)} passed; FAILS:", [n for n, r in RES if not r])

asyncio.run(main())
