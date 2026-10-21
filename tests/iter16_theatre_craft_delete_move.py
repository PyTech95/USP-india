# Iter16 ISOLATED Playwright: Theatre past-work field delete (seeded link on clone), separators, homepage Explore link delete,
# Craft Centre blank-click/nudge/drag independence + save/public reload. All page requests rerouted to TEST_ clones.
# Real docs fingerprinted before/after; only clones + their revisions cleaned.
import asyncio, os, json, uuid, copy, hashlib, sys
from playwright.async_api import async_playwright
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env"); load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEYS = {"theatre": f"TEST_th_{uuid.uuid4().hex[:8]}", "craft-livelihood": f"TEST_cr_{uuid.uuid4().hex[:8]}", "home": f"TEST_hm_{uuid.uuid4().hex[:8]}"}
BLOCKED, RES = [], []
def ok(name, cond, info=""): RES.append((name, bool(cond))); print(("PASS " if cond else "FAIL ") + name, info)
def fp(k): return hashlib.sha256(json.dumps(db.pages.find_one({"key": k}, {"_id": 0}), sort_keys=True, default=str).encode()).hexdigest()
REROUTE = {"on": True}

async def isolate(ctx):
    async def handler(route):
        url = route.request.url
        if REROUTE["on"]:
            for real, test in KEYS.items():
                if f"/pages/{real}/live" in url or url.split("?")[0].endswith(f"/public/pages/{real}"):
                    return await route.continue_(url=url.replace(f"/pages/{real}", f"/pages/{test}"))
        if route.request.method != "GET" and "/auth/" not in url:
            BLOCKED.append((route.request.method, url)); return await route.abort()
        await route.continue_()
    await ctx.route("**/api/**", handler)

GEO = """(a) => { const sec=document.querySelector(a.sel); if(!sec) return null; const q=f=>{const e=sec.querySelector('[data-edit="'+f+'"]'); if(!e) return null; const r=e.getBoundingClientRect(); return {x:Math.round(r.left+scrollX),y:Math.round(r.top+scrollY),w:Math.round(r.width),h:Math.round(r.height),ce:e.isContentEditable}};
 const box=document.querySelector('[data-testid=live-selection-box]'); const br=box&&box.getBoundingClientRect();
 const order=[...document.querySelectorAll('main [data-sec]')].map(e=>e.dataset.sec);
 const out={secIdx: order.indexOf(sec.closest('[data-sec]')?.dataset.sec), nSecs: order.length, secY: Math.round(sec.getBoundingClientRect().top+scrollY), imgs: sec.querySelectorAll('img').length,
   box: br?{x:Math.round(br.left+scrollX),y:Math.round(br.top+scrollY),w:Math.round(br.width),h:Math.round(br.height),isSec:box.classList.contains('live-box-sec')}:null, text: sec.innerText.slice(0,400)};
 for (const f of a.fields) out[f]=q(f); return out; }"""

def which(g, fields):
    b = g and g["box"]
    if not b: return None
    if b["isSec"]: return "_section"
    for f in fields:
        e = g.get(f)
        if e and abs(e["x"] - b["x"]) < 4 and abs(e["y"] - b["y"]) < 4 and abs(e["w"] - b["w"]) < 6: return f
    return f"?{b}"

async def login(ctx):
    page = await ctx.new_page()
    await page.goto(BASE + "/admin/login")
    await page.fill('[data-testid="login-email"]', "admin@uspindia.org"); await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
    await page.click('[data-testid="login-submit"]'); await page.wait_for_url("**/admin**", timeout=15000); await page.wait_for_timeout(800)
    return page

async def open_editor(page, path):
    await page.goto(BASE + path + "?edit=1")
    await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(1500)

async def select(page, sel, f):
    el = page.locator(f'{sel} [data-edit="{f}"]').first
    await el.scroll_into_view_if_needed(); await el.click()
    await page.wait_for_selector('[data-testid="live-selection-box"]', timeout=5000); await page.wait_for_timeout(300)

async def undo_all(page):
    for _ in range(15):
        if await page.locator('[data-testid="live-undo"]').is_disabled(): break
        await page.click('[data-testid="live-undo"]'); await page.wait_for_timeout(200)

async def save(page):
    async with page.expect_response(lambda r: "/live" in r.url and r.request.method == "PUT", timeout=15000) as ri:
        await page.click('[data-testid="live-save-btn"]')
    r = await ri.value; await page.wait_for_timeout(800); return r.status

LINES = """() => { const vw=innerWidth; const res={};
  const bw=(sel)=>{const e=document.querySelector(sel); if(!e) return null; const c=getComputedStyle(e); return {t:c.borderTopWidth+' '+c.borderTopStyle, b:c.borderBottomWidth+' '+c.borderBottomStyle, w:Math.round(e.getBoundingClientRect().width)}};
  res.archive=bw('#past-work .theatre-archive')||bw('#past-work'); res.band=bw('#theatre-ambition .hb-text.band')||bw('#theatre-ambition .band'); res.invite=bw('#theatre-connect .invite');
  const ps=(sel,p)=>{const e=document.querySelector(sel); if(!e) return null; const c=getComputedStyle(e,p); return {content:c.content, w:c.width, h:c.height, bg:c.backgroundColor}};
  const sr=document.querySelector('.theatre-split-rule'); res.split=sr?{w:sr.getBoundingClientRect().width,h:sr.getBoundingClientRect().height,bg:getComputedStyle(sr).backgroundColor}:null;
  res.prayer=ps('#prayer-meeting h2','::after'); res.aside=ps('#theatre-ambition .aside-statement','::after');
  const full=[]; document.querySelectorAll('main *').forEach(el=>{const cs=getComputedStyle(el); const r=el.getBoundingClientRect(); if(r.width<vw*0.6) return; for(const s of ['Top','Bottom']){ if(parseFloat(cs['border'+s+'Width'])>0 && cs['border'+s+'Style']!=='none') full.push((el.closest('[data-sec]')?.id||'')+':'+el.className.toString().slice(0,40)+':'+s);} if(el.tagName==='HR') full.push('hr');});
  res.full=full; return res; }"""

async def theatre(page):
    S = "#past-work"; F = ["eyebrow", "heading", "body_html", "image", "link_label"]
    # Public REAL (no reroute): link absent, image present, prayer link intact, lines
    REROUTE["on"] = False
    await page.goto(BASE + "/our-work/theatre"); await page.wait_for_selector(S, timeout=20000); await page.wait_for_timeout(1500)
    pw = await page.evaluate("(s)=>{const e=document.querySelector(s); return {img:e.querySelectorAll('img').length, txt:e.innerText, links:[...e.querySelectorAll('a,button')].map(a=>a.innerText.trim())}}", S)
    ok("TH real public past-work image present", pw["img"] >= 1, pw["img"])
    ok("TH real public Explore Past Productions absent", "Explore Past Productions" not in pw["txt"] and not pw["links"], pw["links"])
    pm = await page.evaluate("()=>[...document.querySelectorAll('#prayer-meeting a, #prayer-meeting button')].map(a=>a.innerText.trim())")
    ok("TH Current Production link intact", any(t for t in pm), pm)
    ln = await page.evaluate(LINES); print("TH lines", json.dumps(ln))
    ok("TH grey full-width separators removed", not ln["full"], ln["full"])
    ok("TH red split rule kept", ln["split"] and ln["split"]["w"] > 10, ln["split"])
    ok("TH red prayer h2::after kept", ln["prayer"] and ln["prayer"]["content"] not in ("none", "normal"), ln["prayer"])
    ok("TH red aside::after kept", ln["aside"] and ln["aside"]["content"] not in ("none", "normal"), ln["aside"])
    REROUTE["on"] = True
    # Clone public shows seeded link (proves reroute)
    await page.goto(BASE + "/our-work/theatre"); await page.wait_for_selector(S); await page.wait_for_timeout(1500)
    ok("TH clone public shows seeded link (reroute works)", "TEST Explore" in await page.locator(S).inner_text())
    await open_editor(page, "/our-work/theatre")
    g0 = await page.evaluate(GEO, {"sel": S, "fields": F}); ok("TH editor clone has link", g0["link_label"] is not None)
    # arrow click selects link
    arrow = page.locator(f"{S} a svg, {S} button svg").first
    if await arrow.count():
        await arrow.scroll_into_view_if_needed(); await arrow.click(force=True); await page.wait_for_timeout(400)
        ok("TH click link arrow selects link_label", which(await page.evaluate(GEO, {"sel": S, "fields": F}), F) == "link_label", which(await page.evaluate(GEO, {"sel": S, "fields": F}), F))
    else: ok("TH link arrow found", False)
    await page.keyboard.press("Escape")
    await select(page, S, "link_label")
    title = await page.locator('[data-testid=live-sec-delete]').get_attribute("title"); print("delete title:", title)
    ok("TH no section-only tools for field (dup/hide hidden)", await page.locator('[data-testid=live-sec-duplicate]').count() == 0)
    await page.click('[data-testid="live-sec-delete"]', force=True); await page.wait_for_timeout(600)
    g1 = await page.evaluate(GEO, {"sel": S, "fields": F})
    ok("TH trash on link: only link gone", g1 and g1["link_label"] is None and g1["image"] and g1["heading"] and g1["body_html"] and g1["secIdx"] == g0["secIdx"] and g1["nSecs"] == g0["nSecs"], {k: bool(g1 and g1.get(k)) for k in F})
    ok("TH no orphan arrow after link delete", await page.locator(f"{S} a svg, {S} button svg").count() == 0)
    await page.click('[data-testid="live-undo"]'); await page.wait_for_timeout(500)
    g2 = await page.evaluate(GEO, {"sel": S, "fields": F}); ok("TH undo restores link", g2["link_label"] is not None)
    await page.click('[data-testid="live-redo"]'); await page.wait_for_timeout(500)
    g3 = await page.evaluate(GEO, {"sel": S, "fields": F}); ok("TH redo removes link again", g3["link_label"] is None and g3["image"])
    st = await save(page); ok("TH save status 200", st == 200, st)
    doc = db.pages.find_one({"key": KEYS["theatre"]}); d = [s for s in doc["published"]["sections"] if s["data"].get("anchor") == "past-work"][0]["data"]
    ok("TH clone DB link_label blank, image kept", d.get("link_label") == "" and d["image"].get("media_id"), (d.get("link_label"), d["image"].get("media_id")))
    await page.click('[data-testid="live-exit-btn"]'); await page.wait_for_timeout(400)
    await page.goto(BASE + "/our-work/theatre"); await page.wait_for_selector(S); await page.wait_for_timeout(1500)
    pt = await page.locator(S).inner_text(); n = await page.locator(f"{S} img").count()
    ok("TH public reload: link gone, image present", "TEST Explore" not in pt and n >= 1, n)
    # individual delete heading/body/image
    await open_editor(page, "/our-work/theatre")
    for f in ["heading", "body_html", "image", "eyebrow"]:
        a = await page.evaluate(GEO, {"sel": S, "fields": F})
        await select(page, S, f); await page.click('[data-testid="live-sec-delete"]', force=True); await page.wait_for_timeout(600)
        b = await page.evaluate(GEO, {"sel": S, "fields": F})
        others = [k for k in F if k != f and a.get(k)]
        if f == "image": gone = b and b["imgs"] == 0
        else: gone = b and (b.get(f) is None or b[f]["h"] == 0)
        ok(f"TH delete {f} only", b and gone and all(b.get(k) for k in others) and b["nSecs"] == a["nSecs"], {"gone": gone, "others": {k: bool(b and b.get(k)) for k in others}, "imgs": b and b["imgs"]})
        await undo_all(page)
    # whole section via explicit select + confirm cancel/accept
    await select(page, S, "heading"); await page.click('[data-testid="live-select-section"]', force=True); await page.wait_for_timeout(400)
    g = await page.evaluate(GEO, {"sel": S, "fields": F}); ok("TH live-select-section -> _section", which(g, F) == "_section")
    page.once("dialog", lambda dlg: asyncio.ensure_future(dlg.dismiss()))
    await page.click('[data-testid="live-sec-delete"]', force=True); await page.wait_for_timeout(600)
    ok("TH cancel whole delete keeps section", await page.evaluate(GEO, {"sel": S, "fields": F}) is not None)
    page.once("dialog", lambda dlg: asyncio.ensure_future(dlg.accept()))
    await page.click('[data-testid="live-sec-delete"]', force=True); await page.wait_for_timeout(600)
    ok("TH accept whole delete removes section", await page.evaluate(GEO, {"sel": S, "fields": F}) is None)
    await undo_all(page); ok("TH undo restores section", await page.evaluate(GEO, {"sel": S, "fields": F}) is not None)
    await page.click('[data-testid="live-exit-btn"]'); await page.wait_for_timeout(400)

async def home(page):
    await open_editor(page, "/")
    lab = page.locator('[data-testid$="-explore-label"]').first
    if not await lab.count(): ok("HM explore label found", False); return
    tid = await lab.get_attribute("data-testid"); base = tid.replace("-label", "")
    await lab.scroll_into_view_if_needed(); await lab.click(); await page.wait_for_timeout(400)
    nsec = await page.locator("main [data-sec]").count()
    await page.click('[data-testid="live-sec-delete"]', force=True); await page.wait_for_timeout(600)
    ok("HM explore link removed, no orphan arrow", await page.locator(f'[data-testid="{base}"]').count() == 0 and await page.locator("main [data-sec]").count() == nsec)
    st = await save(page); ok("HM save 200", st == 200, st)
    await page.click('[data-testid="live-exit-btn"]'); await page.wait_for_timeout(300)
    await page.goto(BASE + "/"); await page.wait_for_timeout(2500)
    ok("HM public: deleted Explore link does not reappear as default", await page.locator(f'[data-testid="{base}"]').count() == 0, base)

async def craft(page):
    S = "#craft-centre"; F = ["eyebrow", "heading", "body_html", "image"]
    await open_editor(page, "/our-work/craft-livelihood")
    pt = await page.evaluate("""() => { const st=document.querySelector('#craft-centre .split-text'); st.scrollIntoView({block:'center'}); const r=st.getBoundingClientRect(); const pts=[];
       for (let y=r.top+2; y<r.bottom; y+=6) for (let x=r.left+2; x<r.right; x+=12) { const e=document.elementFromPoint(x,y); if(e && st.contains(e) && !e.closest('[data-edit]')) pts.push([x,y]); }
       return {n:pts.length, pts:[pts[0], pts[Math.floor(pts.length/2)], pts[pts.length-1]], region: st.dataset.editRegion}; }""")
    print("CR blank pts", pt)
    ok("CR split-text has data-edit-region=text", pt["region"] == "text")
    for p in [x for x in pt["pts"] if x]:
        await page.mouse.click(p[0], p[1]); await page.wait_for_timeout(350)
        w = which(await page.evaluate(GEO, {"sel": S, "fields": F}), F)
        ok(f"CR blank click {p} -> text field not _section", w in ("eyebrow", "heading", "body_html"), w)
        await page.keyboard.press("Escape"); await page.wait_for_timeout(150)
    for btn, dy in [("live-sec-up", -10), ("live-sec-down", 10)]:
        for f in ["heading", "body_html"]:
            await select(page, S, f); a = await page.evaluate(GEO, {"sel": S, "fields": F})
            await page.click(f'[data-testid="{btn}"]', force=True); await page.wait_for_timeout(500)
            b = await page.evaluate(GEO, {"sel": S, "fields": F})
            ok(f"CR {btn} with {f}: field {dy}px only", b[f]["y"] - a[f]["y"] == dy and b["image"]["y"] == a["image"]["y"] and b["secIdx"] == a["secIdx"] and all(b[k]["y"] == a[k]["y"] for k in F if k not in (f, "image")),
               {"dF": b[f]["y"] - a[f]["y"], "dImg": b["image"]["y"] - a["image"]["y"], "sec": (a["secIdx"], b["secIdx"])})
            await undo_all(page); await page.keyboard.press("Escape")
    # drag heading & image independently, save, compare public
    async def drag(f, dx, dy):
        await select(page, S, f)
        grip = await page.locator('[data-testid="live-move-grip"]').bounding_box(); cx, cy = grip["x"] + grip["width"] / 2, grip["y"] + grip["height"] / 2
        await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + dx / 2, cy + dy / 2, steps=5); await page.mouse.move(cx + dx, cy + dy, steps=5); await page.mouse.up(); await page.wait_for_timeout(400)
        await page.keyboard.press("Escape")
    await page.wait_for_timeout(1200); a = await page.evaluate(GEO, {"sel": S, "fields": F})
    await drag("heading", 37, 23); await page.wait_for_timeout(800); b = await page.evaluate(GEO, {"sel": S, "fields": F})
    print("CR drag diag img a/b", a["image"], b["image"], "heading", a["heading"], b["heading"])
    ok("CR drag heading: image unmoved", b["image"]["y"] == a["image"]["y"] and b["image"]["x"] == a["image"]["x"] and b["heading"]["x"] != a["heading"]["x"], (b["heading"]["x"] - a["heading"]["x"], b["image"]["x"] - a["image"]["x"]))
    await drag("image", -31, 17); c = await page.evaluate(GEO, {"sel": S, "fields": F})
    ok("CR drag image: text unmoved", all(c[k]["y"] == b[k]["y"] and c[k]["x"] == b[k]["x"] for k in ["eyebrow", "heading", "body_html"]) and c["image"]["x"] != b["image"]["x"])
    st = await save(page); ok("CR save 200", st == 200, st)
    sty = [s for s in db.pages.find_one({"key": KEYS["craft-livelihood"]})["published"]["sections"] if s["data"].get("anchor") == "craft-centre"][0].get("styles", {})
    ok("CR saved styles field-level only (no _section translate)", "heading" in sty and "image" in sty and not (sty.get("_section") or {}).get("translateX"), json.dumps(sty)[:300])
    await page.click('[data-testid="live-exit-btn"]'); await page.wait_for_timeout(300)
    await page.goto(BASE + "/our-work/craft-livelihood"); await page.wait_for_selector(S); await page.wait_for_timeout(1000)
    # scroll-reveal transforms only settle once the section is in view (test-flaw fix)
    await page.locator(S).scroll_into_view_if_needed(); await page.wait_for_timeout(2500)
    pub = await page.evaluate(GEO, {"sel": S, "fields": F})
    rel = lambda g, k: (g[k]["x"] - g["image"]["x"], g[k]["y"] - g["secY"]) if k != "image" else (g["image"]["x"], g["image"]["y"] - g["secY"])
    diffs = {k: (rel(pub, k), rel(c, k)) for k in ["heading", "image", "body_html"]}
    ok("CR public geometry matches editor (±3px)", all(abs(p[0] - e[0]) <= 3 and abs(p[1] - e[1]) <= 3 for p, e in diffs.values()), diffs)
    # explicit whole section move still works
    await open_editor(page, "/our-work/craft-livelihood")
    await select(page, S, "heading"); await page.click('[data-testid="live-select-section"]', force=True); await page.wait_for_timeout(300)
    a = await page.evaluate(GEO, {"sel": S, "fields": F}); await page.click('[data-testid="live-sec-up"]', force=True); await page.wait_for_timeout(500)
    b = await page.evaluate(GEO, {"sel": S, "fields": F}); ok("CR whole-section up reorders section", b["secIdx"] == a["secIdx"] - 1, (a["secIdx"], b["secIdx"]))
    await undo_all(page); await page.click('[data-testid="live-exit-btn"]'); await page.wait_for_timeout(300)

async def main():
    before = {k: fp(k) for k in KEYS}
    for real, test in KEYS.items():
        d = copy.deepcopy(db.pages.find_one({"key": real}, {"_id": 0})); d.update({"key": test, "id": uuid.uuid4().hex, "path": f"/{test}"})
        if real == "theatre":
            for part in ("published", "draft"):
                for s in d[part]["sections"]:
                    if s["data"].get("anchor") == "past-work": s["data"]["link_label"] = "TEST Explore"; s["data"]["link_href"] = "/our-work"
        db.pages.insert_one(d)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1920, "height": 1080}); await isolate(ctx)
            page = await login(ctx); errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
            for fn in (theatre, home, craft):
                try: await fn(page)
                except Exception as e: ok(f"{fn.__name__} exception", False, repr(e)[:400]); await page.screenshot(path=f"/app/.screenshots/iter16_{fn.__name__}.jpg", quality=40)
            print("page errors", errs[:5], "blocked", BLOCKED); await b.close()
    finally:
        for test in KEYS.values(): db.pages.delete_many({"key": test}); db.revisions.delete_many({"entity_id": test})
        print("real docs unchanged:", {k: fp(k) == before[k] for k in KEYS})
        print(f"TOTAL {sum(r for _, r in RES)}/{len(RES)} passed; FAILS:", [n for n, r in RES if not r])

asyncio.run(main())
