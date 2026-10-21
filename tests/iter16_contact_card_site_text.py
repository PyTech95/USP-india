# Iter16 ISOLATED Playwright: Contact page (connect) site-text editing + white card (_contact_card) layout resize.
# - Page writes rerouted to a TEST_ clone of the "connect" page.
# - PUT /api/admin/site-live is bridged to the REAL in-process routes_admin.site_live_patch with db proxied to TEST_settings/TEST_revisions.
# - GET /api/public/site responses get contact/ui_text/text_styles overlaid from the TEST settings clone.
# - Real settings + real connect page fingerprinted before/after; only fixtures cleaned.
import asyncio, os, json, uuid, copy, hashlib, sys
from playwright.async_api import async_playwright
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env"); load_dotenv("/app/frontend/.env")
sys.path.insert(0, "/app/backend")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
SUF = uuid.uuid4().hex[:8]
PKEY = f"TEST_cn_{SUF}"; SET_COLL, REV_COLL = f"TEST_settings_{SUF}", f"TEST_revisions_{SUF}"
USER = {"id": "TEST_user", "email": "admin@uspindia.org", "name": "TEST", "role": "admin"}
RES, BLOCKED, SITE_PUTS = [], [], []
def ok(name, cond, info=""): RES.append((name, bool(cond))); print(("PASS " if cond else "FAIL ") + name, info)
def fp_page(): return hashlib.sha256(json.dumps(db.pages.find_one({"key": "connect"}, {"_id": 0}), sort_keys=True, default=str).encode()).hexdigest()
def fp_set(): return hashlib.sha256(json.dumps(db.settings.find_one({"key": "site"}, {"_id": 0}), sort_keys=True, default=str).encode()).hexdigest()
def tset(): return db[SET_COLL].find_one({"key": "site"}, {"_id": 0})

import routes_admin
REAL_DB = routes_admin.db
class Proxy:
    def __getattr__(self, n):
        if n == "settings": return REAL_DB[SET_COLL]
        if n == "revisions": return REAL_DB[REV_COLL]
        return getattr(REAL_DB, n)
    def __getitem__(self, n): return self.__getattr__(n)

async def isolate(ctx):
    async def handler(route):
        req = route.request; url = req.url
        if f"/pages/connect/live" in url or url.split("?")[0].endswith("/public/pages/connect"):
            return await route.continue_(url=url.replace("/pages/connect", f"/pages/{PKEY}"))
        if url.split("?")[0].endswith("/api/admin/site-live") and req.method == "PUT":
            body = json.loads(req.post_data or "{}"); SITE_PUTS.append(body)
            try:
                r = await routes_admin.site_live_patch(routes_admin.SiteLivePatch(**body), USER)
                return await route.fulfill(status=200, content_type="application/json", body=json.dumps(r))
            except Exception as e:
                return await route.fulfill(status=getattr(e, "status_code", 500), content_type="application/json", body=json.dumps({"detail": str(getattr(e, "detail", e))}))
        if url.split("?")[0].endswith("/api/public/site") and req.method == "GET":
            resp = await route.fetch(); data = await resp.json(); t = tset()
            for k in ("contact", "ui_text", "text_styles"):
                if k in t: data[k] = t[k]
            return await route.fulfill(response=resp, body=json.dumps(data), content_type="application/json")
        if req.method != "GET" and "/auth/" not in url:
            BLOCKED.append((req.method, url)); return await route.abort()
        await route.continue_()
    await ctx.route("**/api/**", handler)

async def login(ctx):
    page = await ctx.new_page()
    await page.goto(BASE + "/admin/login")
    await page.fill('[data-testid="login-email"]', "admin@uspindia.org"); await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
    await page.click('[data-testid="login-submit"]'); await page.wait_for_url("**/admin**", timeout=15000); await page.wait_for_timeout(800)
    return page

async def open_editor(page):
    await page.goto(BASE + "/connect?edit=1")
    await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(1500)

CARD = """() => { const c=document.querySelector('[data-testid=contact-white-card]'); if(!c) return null; const r=c.getBoundingClientRect(); const cs=getComputedStyle(c);
  const box=document.querySelector('[data-testid=live-selection-box]'); const br=box&&box.getBoundingClientRect();
  return {w:Math.round(r.width), h:Math.round(r.height), x:Math.round(r.left), ce:c.isContentEditable, anyCE:!!c.querySelector('[contenteditable=true]')&&[...c.querySelectorAll('[contenteditable=true]')].map(e=>e.dataset.edit||e.className).join(','),
    ov:cs.overflowY, sh:c.scrollHeight, ch:c.clientHeight, style:c.getAttribute('style'), vw:innerWidth, docW:document.documentElement.scrollWidth,
    box: br?{w:Math.round(br.width),h:Math.round(br.height),x:Math.round(br.left)}:null,
    form: !!c.querySelector('[data-testid=contact-form]'), addr: (c.querySelector('[data-testid=contact-address-value]')||{}).innerText, email:(c.querySelector('[data-testid=contact-email-value]')||{}).innerText } }"""

async def site_field(page): return await page.locator('[data-testid="live-site-field"]').input_value()

async def site_text(page):
    # email click -> site panel
    await page.locator('[data-testid="contact-email-value"]').scroll_into_view_if_needed()
    await page.click('[data-testid="contact-email-value"]'); await page.wait_for_timeout(600)
    ok("CT email click opens Site text panel", await page.locator('[data-testid="live-site-panel"]').is_visible())
    ok("CT email -> field contact.email", await site_field(page) == "contact.email", await site_field(page))
    # address click
    await page.click('[data-testid="contact-address-value"]'); await page.wait_for_timeout(500)
    ok("CT address -> field contact.address", await site_field(page) == "contact.address", await site_field(page))
    val = "TEST House\nLine 2, Lane\nGurgaon 122009"
    await page.fill('[data-testid="live-site-value"]', val)
    await page.click('[data-testid="live-site-save"]'); await page.wait_for_timeout(1500)
    ok("CT address saved via real site_live_patch to TEST settings", tset()["contact"].get("address") == val, repr(tset()["contact"].get("address")))
    shown = await page.locator('[data-testid="contact-address-value"]').inner_text()
    ok("CT editor address shows 3 lines", [l.strip() for l in shown.split("\n") if l.strip()] == val.split("\n"), repr(shown))
    err = await page.locator('[data-testid="live-site-error"]').count(); ok("CT no site-save error", err == 0)
    # phone slot only in editor when empty
    ph = page.locator('[data-testid="contact-phone-value"]')
    ok("CT editor shows 'Add phone number' slot", await ph.count() == 1 and "Add phone number" in await ph.inner_text())
    await ph.click(); await page.wait_for_timeout(500)
    ok("CT phone -> field contact.phone", await site_field(page) == "contact.phone", await site_field(page))
    await page.fill('[data-testid="live-site-value"]', "+91 98100 12345"); await page.click('[data-testid="live-site-save"]'); await page.wait_for_timeout(1500)
    ok("CT phone saved to TEST settings", tset()["contact"].get("phone") == "+91 98100 12345")
    # email multiline-free edit
    await page.click('[data-testid="contact-email-value"]'); await page.wait_for_timeout(400)
    await page.fill('[data-testid="live-site-value"]', "test_info@example.org"); await page.click('[data-testid="live-site-save"]'); await page.wait_for_timeout(1500)
    ok("CT email saved + href", tset()["contact"].get("email") == "test_info@example.org" and await page.locator('[data-testid="contact-email-value"]').get_attribute("href") == "mailto:test_info@example.org")
    # compact form label editable
    lab = page.locator('[data-testid="contact-form"] label [data-site-edit]').first
    labf = await lab.get_attribute("data-site-edit"); await lab.click(); await page.wait_for_timeout(400)
    ok("CT form label -> site field", await site_field(page) == labf, (labf, await site_field(page)))
    await page.fill('[data-testid="live-site-value"]', "TEST Your Name"); await page.click('[data-testid="live-site-save"]'); await page.wait_for_timeout(1500)
    ok("CT form label saved + rendered", (tset().get("ui_text") or {}).get(labf.replace("ui_text.", "")) == "TEST Your Name" and "TEST Your Name" in await lab.inner_text(), labf)
    await page.click('[data-testid="live-site-close"]'); await page.wait_for_timeout(300)
    # public: phone visible + tel href, address lines
    await page.click('[data-testid="live-exit-btn"]'); await page.wait_for_timeout(400)
    await page.goto(BASE + "/connect"); await page.wait_for_selector('[data-testid="contact-white-card"]'); await page.wait_for_timeout(1500)
    href = await page.locator('[data-testid="contact-phone-value"]').get_attribute("href") if await page.locator('[data-testid="contact-phone-value"]').count() else None
    ok("CT public phone visible w/ tel href", href == "tel:+919810012345", href)
    pa = await page.locator('[data-testid="contact-address-value"]').inner_text()
    ok("CT public address multiline", [l.strip() for l in pa.split("\n") if l.strip()] == val.split("\n"), repr(pa))
    # validation (no real submit: POSTs are aborted by isolation and must not even be attempted)
    nb = len(BLOCKED)
    await page.click('[data-testid="contact-submit"]'); await page.wait_for_timeout(800)
    errs = await page.evaluate("()=>[...document.querySelectorAll('[data-testid$=-error]')].map(e=>e.dataset.testid+':'+e.innerText)")
    ok("CT empty submit shows validation errors, no POST", len(errs) >= 2 and len(BLOCKED) == nb, (errs, BLOCKED[nb:]))
    await page.fill('[data-testid="contact-email"]', "not-an-email"); await page.click('[data-testid="contact-submit"]'); await page.wait_for_timeout(500)
    ok("CT invalid email error", await page.locator('[data-testid="contact-email-error"]').count() == 1 and len(BLOCKED) == nb)
    # blank phone -> hidden publicly
    await routes_admin.site_live_patch(routes_admin.SiteLivePatch(path="contact.phone", value=""), USER)
    await page.reload(); await page.wait_for_timeout(1500)
    ok("CT public: blank phone hides phone row", await page.locator('[data-testid="contact-detail-phone"]').count() == 0)

async def card(page):
    await open_editor(page)
    c0 = await page.evaluate(CARD); print("card0", c0)
    ok("CT card not contenteditable", c0 and not c0["ce"])
    addr0, email0 = c0["addr"], c0["email"]
    # click blank padding area of card
    bb = await page.locator('[data-testid="contact-white-card"]').bounding_box()
    await page.mouse.click(bb["x"] + 12, bb["y"] + 12); await page.wait_for_timeout(500)
    c1 = await page.evaluate(CARD)
    ok("CT blank-card click selects card box", c1["box"] and abs(c1["box"]["w"] - c1["w"]) < 6 and abs(c1["box"]["h"] - c1["h"]) < 6, (c1["box"], c1["w"], c1["h"]))
    ok("CT card selection: no element became contenteditable inside card", not c1["anyCE"], c1["anyCE"])
    grp_open = await page.evaluate("()=>document.querySelector('[data-testid=live-group-layout]')?.open")
    print("INFO Size & position group open by default for card:", grp_open)
    if not grp_open: await page.click('[data-testid="live-group-layout"] summary'); await page.wait_for_timeout(300)
    ok("CT width/height inputs visible", await page.locator('[data-testid="live-width"]').is_visible() and await page.locator('[data-testid="live-height"]').is_visible())
    print("INFO card toolbar delete count:", await page.locator('[data-testid="live-sec-delete"]').count(), "title:", await page.locator('[data-testid="live-sec-delete"]').first.get_attribute("title") if await page.locator('[data-testid="live-sec-delete"]').count() else None)
    sel_val = await page.locator('[data-testid="live-field-selector"]').input_value() if await page.locator('[data-testid="live-field-selector"]').count() else None
    ok("CT All page fields shows _contact_card selected", sel_val and sel_val.endswith("|_contact_card"), sel_val)
    res = {}
    for w in (900, 1100):
        await page.fill('[data-testid="live-width"]', str(w)); await page.wait_for_timeout(500)
        res[w] = await page.evaluate(CARD); ok(f"CT width {w} applied", abs(res[w]["w"] - min(w, res[w]["vw"])) <= 2 or abs(res[w]["w"] - w) <= 2, res[w]["w"])
    for h in (1500, 520):
        await page.fill('[data-testid="live-height"]', str(h)); await page.wait_for_timeout(500)
        res[h] = await page.evaluate(CARD); ok(f"CT height {h} applied", abs(res[h]["h"] - h) <= 2, res[h]["h"])
    ok("CT short height -> inner scroll", res[520]["ov"] in ("auto", "scroll") and res[520]["sh"] > res[520]["ch"], (res[520]["ov"], res[520]["sh"], res[520]["ch"]))
    # handle drag (east)
    await page.wait_for_timeout(300)
    hnd = page.locator('[data-testid="live-resize-e"]')
    if await hnd.count():
        hb = await hnd.bounding_box(); a = await page.evaluate(CARD)
        await page.mouse.move(hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2); await page.mouse.down()
        await page.mouse.move(hb["x"] - 60, hb["y"] + hb["height"] / 2, steps=8); await page.mouse.up(); await page.wait_for_timeout(500)
        b = await page.evaluate(CARD); ok("CT east handle drag resizes card width", abs(b["w"] - a["w"]) >= 30, (a["w"], b["w"]))
        hs = page.locator('[data-testid="live-resize-s"]'); hb = await hs.bounding_box()
        await page.mouse.move(hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2); await page.mouse.down()
        await page.mouse.move(hb["x"] + hb["width"] / 2, hb["y"] + 80, steps=8); await page.mouse.up(); await page.wait_for_timeout(500)
        c = await page.evaluate(CARD); ok("CT south handle drag resizes card height", abs(c["h"] - b["h"]) >= 40, (b["h"], c["h"]))
    else: ok("CT resize handles present", False)
    # final deterministic size then save
    await page.fill('[data-testid="live-width"]', "1000"); await page.fill('[data-testid="live-height"]', "700"); await page.wait_for_timeout(500)
    ed = await page.evaluate(CARD); print("editor final", ed)
    ok("CT card resize keeps form/address/email", ed["form"] and ed["addr"] == addr0 and ed["email"] == email0)
    async with page.expect_response(lambda r: "/live" in r.url and r.request.method == "PUT", timeout=15000) as ri:
        await page.click('[data-testid="live-save-btn"]')
    st = (await ri.value).status; ok("CT card save 200 (clone)", st == 200, st)
    doc = db.pages.find_one({"key": PKEY}); sec = [s for s in doc["published"]["sections"] if s["data"].get("layout") == "connect-form"][0]
    cs = (sec.get("styles") or {}).get("_contact_card") or {}
    ok("CT clone DB styles._contact_card width/height", cs.get("width") == "1000px" and cs.get("height") == "700px", cs)
    ok("CT card data fields unchanged (no text keys added)", "_contact_card" not in sec["data"], list(sec["data"].keys()))
    await page.click('[data-testid="live-exit-btn"]'); await page.wait_for_timeout(400)
    await page.goto(BASE + "/connect"); await page.wait_for_selector('[data-testid="contact-white-card"]'); await page.wait_for_timeout(1500)
    pub = await page.evaluate(CARD); print("public desktop", pub)
    ok("CT public desktop geometry == editor (±3)", abs(pub["w"] - ed["w"]) <= 3 and abs(pub["h"] - ed["h"]) <= 3, ((pub["w"], pub["h"]), (ed["w"], ed["h"])))
    ok("CT public no contenteditable", not pub["ce"] and not pub["anyCE"])
    await page.locator('[data-testid="contact-submit"]').scroll_into_view_if_needed(); await page.wait_for_timeout(300)
    hit = await page.evaluate("""()=>{const b=document.querySelector('[data-testid=contact-submit]'); const r=b.getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); const card=document.querySelector('[data-testid=contact-white-card]').getBoundingClientRect(); return {inside:b.contains(e), hit:e&&(e.dataset.testid||e.tagName+'.'+String(e.className).slice(0,40)), btnBottom:Math.round(r.bottom), cardBottom:Math.round(card.bottom)}}""")
    ok("CT short card (700px): submit button not covered/outside card", hit["inside"] and hit["btnBottom"] <= hit["cardBottom"], hit)
    for vw, vh in ((768, 1024), (390, 844)):
        await page.set_viewport_size({"width": vw, "height": vh}); await page.wait_for_timeout(900)
        m = await page.evaluate(CARD); print(vw, m)
        ok(f"CT {vw}: no horizontal overflow, width constrained", m["docW"] <= vw and m["w"] <= vw - 16, (m["docW"], m["w"]))
        ok(f"CT {vw}: auto height (content fits, no inner scroll)", m["sh"] <= m["ch"] + 2 and m["h"] != 700, (m["h"], m["sh"], m["ch"], m["ov"]))
    await page.set_viewport_size({"width": 1920, "height": 1080})

async def main():
    before = (fp_page(), fp_set())
    d = copy.deepcopy(db.pages.find_one({"key": "connect"}, {"_id": 0})); d.update({"key": PKEY, "id": uuid.uuid4().hex, "path": f"/{PKEY}"}); db.pages.insert_one(d)
    db[SET_COLL].insert_one(copy.deepcopy(db.settings.find_one({"key": "site"}, {"_id": 0})))
    routes_admin.db = Proxy()
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1920, "height": 1080}); await isolate(ctx)
            page = await login(ctx); errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
            for fn in (site_text, card):
                try:
                    if fn is site_text: await open_editor(page)
                    await fn(page)
                except Exception as e:
                    ok(f"{fn.__name__} exception", False, repr(e)[:400]); await page.screenshot(path=f"/app/.screenshots/iter16_contact_{fn.__name__}.jpg", quality=40)
            print("page errors", errs[:5], "blocked", BLOCKED, "site puts", [x.get("path") for x in SITE_PUTS]); await b.close()
    finally:
        routes_admin.db = REAL_DB
        db.pages.delete_many({"key": PKEY}); db.revisions.delete_many({"entity_id": PKEY}); db.drop_collection(SET_COLL); db.drop_collection(REV_COLL)
        print("real connect/settings unchanged:", (fp_page(), fp_set()) == before, "real phone:", repr((db.settings.find_one({"key": "site"}).get("contact") or {}).get("phone")))
        print(f"TOTAL {sum(r for _, r in RES)}/{len(RES)} passed; FAILS:", [n for n, r in RES if not r])

asyncio.run(main())
