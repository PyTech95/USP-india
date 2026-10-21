# Playwright (ISOLATED): Rakhigarhi Ambition LiveEditor on a disposable clone TEST_rak_<uuid>.
# Requests to /api/admin/pages/rakhigarhi/live and /api/public/pages/rakhigarhi are re-routed to the clone;
# any other write mentioning rakhigarhi is aborted. The real rakhigarhi doc is never written or restored.
# Covers: 18px typography normalisation, independent font size, clear box -> "" + re-fill, stale-editor 409,
# conflict message + unsaved content retained, fresh editor saves, repeated saves, group width/translate preserved.
import asyncio, os, json, uuid, copy, hashlib
from playwright.async_api import async_playwright
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env"); load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
SID = "1017b7e20a8648a0b3f8c546ed6f89d6"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = f"TEST_rak_{uuid.uuid4().hex[:10]}"
SEL = "#the-ambition"
R = []; BLOCKED = []
def ok(n, c, i=""): R.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n, i)
def fp(): return hashlib.sha256(json.dumps(db.pages.find_one({"key": "rakhigarhi"}, {"_id": 0}), sort_keys=True, default=str).encode()).hexdigest()
def amb(): return next(s for s in db.pages.find_one({"key": KEY})["published"]["sections"] if s["id"] == SID)

GEO = """() => { const sec=document.querySelector('#the-ambition'); const body=sec.querySelector('.ambition-body');
 const g=f=>{const e=sec.querySelector('[data-edit='+f+']'); if(!e) return null; const r=e.getBoundingClientRect(); return {h:Math.round(r.height),txt:e.innerText,fs:getComputedStyle(e.querySelector('p')||e).fontSize}};
 return {groupStyle: body.getAttribute('style')||'', groupFs: body.style.fontSize, b1:g('body_1_html'), b2:g('body_2_html'), b3:g('body_3_html')}; }"""

async def isolate(ctx):
    async def handler(route):
        url = route.request.url
        if "/api/admin/pages/rakhigarhi/live" in url or "/api/public/pages/rakhigarhi" in url:
            await route.continue_(url=url.replace("/pages/rakhigarhi", f"/pages/{KEY}"))
        elif route.request.method != "GET":
            BLOCKED.append((route.request.method, url)); await route.abort()
        else:
            await route.continue_()
    await ctx.route("**/api/**rakhigarhi**", handler)

async def login(ctx):
    page = await ctx.new_page()
    await page.goto(BASE + "/admin/login")
    await page.fill('[data-testid="login-email"]', "admin@uspindia.org")
    await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
    await page.click('[data-testid="login-submit"]')
    await page.wait_for_url("**/admin**", timeout=15000); await page.wait_for_timeout(800)
    return page

async def open_editor(page):
    await page.goto(BASE + "/our-work/rakhigarhi?edit=1")
    await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(1500)

async def select(page, f):
    el = page.locator(f'{SEL} [data-edit="{f}"]').first
    await el.scroll_into_view_if_needed(); await el.click()
    await page.wait_for_selector('[data-testid="live-selection-box"]', timeout=5000); await page.wait_for_timeout(300)
    return el

async def save(page, expect_ok=True):
    await page.click('[data-testid="live-save-btn"]')
    if expect_ok:
        await page.wait_for_function("() => document.querySelector('[data-testid=live-status]')?.textContent.includes('Everything is saved')", timeout=15000)
    await page.wait_for_timeout(1200)

async def main():
    real_before = fp()
    src = db.pages.find_one({"key": "rakhigarhi"}, {"_id": 0})
    doc = copy.deepcopy(src); doc.update({"key": KEY, "id": uuid.uuid4().hex, "path": f"/{KEY}"})
    db.pages.insert_one(doc); print("clone", KEY, "src styles", next(s for s in src["published"]["sections"] if s["id"] == SID).get("styles"))
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            ctxA = await b.new_context(viewport={"width": 1920, "height": 1080}); await isolate(ctxA)
            A = await login(ctxA); errs = []; A.on("pageerror", lambda e: errs.append(str(e)))
            await open_editor(A)
            g0 = await A.evaluate(GEO); print("initial", json.dumps(g0)[:600])
            ok("boxes render 18px from inherited body typography", all(g0[k]["fs"] == "18px" for k in ("b1", "b2", "b3")), [g0[k]["fs"] for k in ("b1", "b2", "b3")])
            ok("group wrapper has no copied font-size", "font-size" not in g0["groupStyle"], g0["groupStyle"])
            # independent font size
            await select(A, "body_1_html"); await A.fill('[data-testid="live-font-size"]', "24"); await A.wait_for_timeout(500)
            g1 = await A.evaluate(GEO)
            ok("font-size box1 only", g1["b1"]["fs"] == "24px" and g1["b2"]["fs"] == "18px" and g1["b3"]["fs"] == "18px", [g1[k]["fs"] for k in ("b1", "b2", "b3")])
            await A.keyboard.press("Escape"); await A.wait_for_timeout(200)
            # clear box 2 -> ""
            await select(A, "body_2_html"); await A.keyboard.press("Control+a"); await A.keyboard.press("Delete")
            await A.keyboard.press("Escape"); await A.wait_for_timeout(400)
            req = []
            A.on("request", lambda r: req.append(r.post_data) if r.method == "PUT" and "/live" in r.url else None)
            await save(A)
            payload = json.loads(req[-1]) if req else {}
            psec = next((s for s in payload.get("sections", []) if s["id"] == SID), {})
            ok("payload body_2_html is empty string", psec.get("data", {}).get("body_2_html") == "", repr(psec.get("data", {}).get("body_2_html")))
            ok("payload carries base_version", isinstance(payload.get("base_version"), str) and len(payload["base_version"]) == 64)
            d = amb()
            ok("persisted body_2_html == ''", d["data"].get("body_2_html") == "", repr(d["data"].get("body_2_html")))
            ok("persisted styles: body_1 24px, body_2/3 18px, no body_html typography",
               d["styles"].get("body_1_html", {}).get("fontSize") == "24px" and d["styles"].get("body_2_html", {}).get("fontSize") == "18px"
               and d["styles"].get("body_3_html", {}).get("fontSize") == "18px" and "fontSize" not in d["styles"].get("body_html", {}), d["styles"])
            gc = await A.evaluate(GEO)
            ok("cleared box still selectable (h>5)", gc["b2"] and gc["b2"]["h"] > 5, gc["b2"])
            await select(A, "body_2_html"); await A.keyboard.type("TEST_REFILL"); await A.keyboard.press("Escape"); await A.wait_for_timeout(400)
            await save(A)  # repeated save in same editor
            ok("refilled text persisted (2nd save same editor)", "TEST_REFILL" in amb()["data"].get("body_2_html", ""), amb()["data"].get("body_2_html"))
            # ---- concurrency: B loads version V, A saves, B saves stale ----
            ctxB = await b.new_context(viewport={"width": 1920, "height": 1080}); await isolate(ctxB)
            B = await login(ctxB); await open_editor(B)
            await select(A, "body_3_html"); await A.keyboard.press("Control+End"); await A.keyboard.type(" TEST_A_WINS"); await A.keyboard.press("Escape"); await A.wait_for_timeout(300)
            await save(A)
            ok("editor A third save ok", "TEST_A_WINS" in amb()["data"].get("body_3_html", ""))
            snap = amb(); revs = db.revisions.count_documents({"entity_id": KEY})
            await select(B, "body_1_html"); await B.keyboard.press("Control+End"); await B.keyboard.type(" TEST_B_STALE"); await B.keyboard.press("Escape"); await B.wait_for_timeout(300)
            resp = []
            B.on("response", lambda r: resp.append(r.status) if r.request.method == "PUT" and "/live" in r.url else None)
            await save(B, expect_ok=False)
            toast = await B.locator("[data-sonner-toast]").all_inner_texts()
            status = await B.locator('[data-testid="live-status"]').inner_text()
            b1txt = await B.locator(f'{SEL} [data-edit=body_1_html]').inner_text()
            print("B resp", resp, "toast", toast, "status", status)
            ok("stale save -> 409", 409 in resp, resp)
            ok("conflict message shown", any("changed in another editor" in t for t in toast), toast)
            ok("B keeps unsaved content + dirty status", "TEST_B_STALE" in b1txt and "Unsaved" in status, status)
            ok("nothing written by stale save", amb() == snap and db.revisions.count_documents({"entity_id": KEY}) == revs)
            await B.screenshot(path="/tmp/iter14_conflict.jpeg", quality=40, type="jpeg")
            # fresh editor (reload B) saves
            await open_editor(B)
            await select(B, "body_1_html"); await B.keyboard.press("Control+End"); await B.keyboard.type(" TEST_B_FRESH"); await B.keyboard.press("Escape"); await B.wait_for_timeout(300)
            await save(B)
            ok("fresh editor saves", "TEST_B_FRESH" in amb()["data"].get("body_1_html", "") and "TEST_A_WINS" in amb()["data"].get("body_3_html", ""))
            # ---- group width/translate preserved while typography moved to boxes ----
            sec = next(s for s in src["published"]["sections"] if s["id"] == SID)
            old = copy.deepcopy(db.pages.find_one({"key": KEY})["published"])
            for s in old["sections"]:
                if s["id"] == SID:
                    s["data"] = copy.deepcopy(sec["data"]); s["styles"] = {"body_html": {"fontSize": "18px", "width": "720px", "translateX": "6px"}}
            db.pages.update_one({"key": KEY}, {"$set": {"published": old, "draft": old}})
            await open_editor(B)
            g2 = await B.evaluate(GEO); print("group", g2["groupStyle"], [g2[k]["fs"] for k in ("b1", "b2", "b3")])
            ok("group keeps width/translate, boxes 18px", "720px" in g2["groupStyle"] and "6px" in g2["groupStyle"] and "font-size" not in g2["groupStyle"]
               and all(g2[k]["fs"] == "18px" for k in ("b1", "b2", "b3")), g2["groupStyle"])
            await select(B, "body_3_html"); await B.fill('[data-testid="live-font-size"]', "20"); await B.keyboard.press("Escape"); await B.wait_for_timeout(300)
            await save(B)
            st = amb()["styles"]; print("saved styles", st)
            ok("saved group styles = width+translate only", st.get("body_html") == {"width": "720px", "translateX": "6px"}, st.get("body_html"))
            ok("saved box styles independent", st.get("body_3_html", {}).get("fontSize") == "20px" and st.get("body_1_html", {}).get("fontSize") == "18px")
            print("page errors", errs[:5], "blocked", BLOCKED)
            ok("no unexpected writes to real rakhigarhi URLs", not BLOCKED, BLOCKED)
            await b.close()
    except Exception as e:
        print("EXCEPTION", repr(e)); R.append(("exception", False))
    finally:
        db.pages.delete_many({"key": KEY}); db.revisions.delete_many({"entity_id": KEY})
        ok("real rakhigarhi doc unchanged", fp() == real_before)
        print(f"SUMMARY {sum(1 for _, v in R if v)}/{len(R)} passed; failed: {[n for n, v in R if not v]}")

asyncio.run(main())
