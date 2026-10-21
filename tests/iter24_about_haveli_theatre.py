# Iter24: (1) About Our Approach border/footer gap, (2) Rakhigarhi #haveli-in-use separate section, (3) Theatre #past-work red line above eyebrow.
# Public GET-only checks on preview data and on read-only PRODUCTION content fulfilled into preview /api/public/pages/{key};
# editor mutations only on TEST_ clones (rerouted), other non-GET aborted; real docs/settings fingerprinted; clones deleted in finally.
import asyncio, os, json, uuid, copy, hashlib, urllib.request
from playwright.async_api import async_playwright
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env"); load_dotenv("/app/frontend/.env"); load_dotenv("/root/production.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
PROD_URL = os.environ["PRODUCTION_SITE_URL"].rstrip("/")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KR, KT = f"TEST_rak_{uuid.uuid4().hex[:8]}", f"TEST_th_{uuid.uuid4().hex[:8]}"
USE, REST, ARCH = "4cd0518474cb4b04bd8e51afcb362d9d", "b81e831b8677408e8ee1afcf2ff2ce05", "50af8d23713b4ada8587344dfeef6dde"
USE_TEXT = "The haveli and chaupal have been reimagined as places that can once again be part of everyday life in Rakhigarhi—somewhere to make, gather, learn, welcome visitors and simply spend time."
R, BLOCKED, ERRS = [], [], []
def ok(n, c, i=""): R.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n, i)
def fp(): return hashlib.sha256(json.dumps(list(db.pages.find({"key": {"$not": {"$regex": "^TEST_"}}}, {"_id": 0})), sort_keys=True, default=str).encode()).hexdigest()
def fps(): return hashlib.sha256(json.dumps(list(db.settings.find({}, {"_id": 0})), sort_keys=True, default=str).encode()).hexdigest()
PROD = {k: urllib.request.urlopen(f"{PROD_URL}/api/public/pages/{k}", timeout=30).read() for k in ("about", "rakhigarhi", "theatre")}
GEO = """() => window.__r = e => { if(!e) return null; const b=e.getBoundingClientRect(); return {l:+b.left.toFixed(2), t:+(b.top+scrollY).toFixed(2), w:+b.width.toFixed(2), h:+b.height.toFixed(2), b:+(b.bottom+scrollY).toFixed(2), r:+b.right.toFixed(2)} }"""
VIS = """window.__vis = root => { let t=1e9,b=-1e9; root.querySelectorAll('*').forEach(e=>{const s=getComputedStyle(e); if(s.display==='none'||s.visibility==='hidden') return; if(!(e.children.length===0 || e.matches('img,p,h1,h2,h3,span'))) return; const x=e.getBoundingClientRect(); if(x.height<1||x.width<1) return; t=Math.min(t,x.top+scrollY); b=Math.max(b,x.bottom+scrollY)}); return {t:+t.toFixed(2), b:+b.toFixed(2)} };"""
M_ABOUT = """() => { const r=window.__r; const ap=document.querySelector('#our-approach > .about-approach'), wr=document.querySelector('#our-approach'), ft=document.querySelector('footer'), ar=document.querySelector('#about-reference');
 const s=getComputedStyle(ap), ws=getComputedStyle(wr), as=getComputedStyle(ar); const apr=r(ap), fr=r(ft);
 const lines=[]; document.querySelectorAll('body *').forEach(e=>{ if(ft.contains(e)) return; const x=r(e); if(!x||x.w<100) return; const cs=getComputedStyle(e);
   const bt=parseFloat(cs.borderTopWidth), bb=parseFloat(cs.borderBottomWidth); const thin = x.h>0 && x.h<=3 && cs.backgroundColor!=='rgba(0, 0, 0, 0)';
   if(((bt>0&&cs.borderTopStyle!=='none') && x.t>=apr.t-2) || ((bb>0&&cs.borderBottomStyle!=='none') && x.b>=apr.t-2 && x.b<=fr.t+2) || (thin && x.t>=apr.t-2 && x.t<=fr.t+2)) lines.push([e.tagName, e.className, x.t, x.h, cs.borderTop, cs.borderBottom, cs.backgroundColor]); });
 const kids=[...ap.querySelectorAll('*')].map(r).filter(x=>x&&x.h>0); const inb=kids.every(k=>k.t>=apr.t-1&&k.b<=apr.b+1&&k.l>=apr.l-1&&k.r<=apr.r+1);
 const h2=ap.querySelector('.h2'); const hs=getComputedStyle(h2);
 return {ap:apr, wr:r(wr), ft:fr, gap:+(fr.t-apr.b).toFixed(2), wgap:+(fr.t-r(wr).b).toFixed(2), apB:[s.borderTopWidth,s.borderTopStyle,s.borderBottomWidth,s.borderBottomStyle], wrB:[ws.borderTopWidth,ws.borderBottomWidth], arPB:as.paddingBottom, arB:as.borderBottomWidth,
  lines, inb, nSec:document.querySelectorAll('#about-reference [data-sec]').length, secIds:[...document.querySelectorAll('[data-sec]')].map(e=>e.dataset.sec), h2:[h2.textContent, hs.fontSize, hs.fontFamily, hs.fontWeight], txt:ap.innerText.replace(/\\s+/g,' ').trim(), ftSep:[...ft.querySelectorAll('*')].filter(e=>{const c=getComputedStyle(e), x=getComputedStyle(e,'::before'); return (parseFloat(c.borderTopWidth)>0&&c.borderTopStyle!=='none') || (x.content!=='none' && parseFloat(x.height)>0 && parseFloat(x.height)<=3)}).length, sw:document.documentElement.scrollWidth, vw:innerWidth} }"""
M_RAK = """() => { const r=window.__r, q=s=>document.querySelector(s); const u=q('#haveli-in-use'), hc=q('#haveli-chaupal'), cc=q('#craft-centre'); const grid=cc&&cc.closest('.rak-use-grid');
 const eb=u&&u.querySelector('.eyebrow'), bd=u&&u.querySelector('.prose'), p=bd&&bd.querySelector('p'); const es=eb&&getComputedStyle(eb), ps=p&&getComputedStyle(p);
 const order=[...document.querySelectorAll('[data-sec]')].map(e=>e.id||e.dataset.sec);
 const ur=r(u); const kids=u?[...u.querySelectorAll('*')].map(r).filter(x=>x&&x.h>0):[];
 return {n:document.querySelectorAll('#haveli-in-use').length, nSec:document.querySelectorAll('[data-sec=\"4cd0518474cb4b04bd8e51afcb362d9d\"]').length, order, next:u&&u.nextElementSibling&&(u.nextElementSibling.id||u.nextElementSibling.className), prev:u&&u.previousElementSibling&&u.previousElementSibling.id,
  gridAfter: !!(grid && u && (u.compareDocumentPosition(grid) & 4)), eb:r(eb), bd:r(bd), u:ur, hcVis:hc&&window.__vis(hc), gridVis:grid&&window.__vis(grid), uVis:u&&window.__vis(u),
  inb:kids.every(k=>k.t>=ur.t-1&&k.b<=ur.b+1&&k.l>=ur.l-1&&k.r<=ur.r+1), ebTxt:eb&&eb.textContent.trim(), ebTT:es&&es.textContent, ebFont:es&&[es.fontSize,es.fontWeight,es.fontFamily,es.textTransform], bodyTxt:bd&&bd.innerText.trim(), pFont:ps&&[ps.fontSize,ps.fontWeight,ps.fontFamily], bdFontInline:bd&&bd.style.fontSize,
  restP:[...hc.querySelectorAll('.prose p')].map(x=>x.textContent.trim()), sw:document.documentElement.scrollWidth, vw:innerWidth} }"""
M_TH = """() => { const r=window.__r, q=s=>document.querySelector(s); const sec=q('#past-work'), eb=q('[data-testid=block-2-eyebrow]'), a=q('[data-testid=block-2-accent-line]'), h=q('[data-testid=block-2-heading]'), bd=q('[data-testid=block-2-body]'), im=q('[data-testid=block-2-image]');
 const es=getComputedStyle(eb), hs=getComputedStyle(h); const pb=s=>{const x=getComputedStyle(eb,s); return x.content!=='none'&&x.display!=='none'&&(parseFloat(x.height)>0||parseFloat(x.width)>0)};
 const prev=sec.previousElementSibling; const ar=r(a);
 return {eb:r(eb), a:ar, h:r(h), bd:r(bd), im:r(im), abg:a&&getComputedStyle(a).backgroundColor, nAcc:document.querySelectorAll('.theatre-label-accent').length, nAccLbl:document.querySelectorAll('.theatre-accent-label').length,
  pseudo:[pb('::before'), pb('::after')], ebFont:[es.fontSize,es.fontFamily,es.fontWeight,es.textTransform,es.letterSpacing], hFont:[hs.fontSize,hs.fontFamily,hs.fontWeight], label:eb.querySelector('[data-edit-text]')?.textContent, ebCE:eb.getAttribute('contenteditable'), innerCE:eb.querySelector('[data-edit-text]')?.getAttribute('contenteditable'),
  heading:h.textContent, body:bd.innerText.trim(), imgSrc:(im.querySelector('img')||im).getAttribute('src'), explore:document.body.innerText.includes('Explore Past Productions'), prevVis:prev&&window.__vis(prev), prevId:prev&&prev.id,
  vars:['--accent-line-w','--accent-line','--accent-line-gap'].map(v=>getComputedStyle(eb).getPropertyValue(v).trim()), sw:document.documentElement.scrollWidth, vw:innerWidth} }"""

async def isolate(ctx, prod=None, clones=None):
    clones = clones or {}
    async def h(route):
        url = route.request.url; path = url.split("?")[0]
        for k, ck in clones.items():
            if f"/api/admin/pages/{k}/live" in url or path.endswith(f"/api/public/pages/{k}"):
                return await route.continue_(url=url.replace(f"/pages/{k}", f"/pages/{ck}"))
        if prod and route.request.method == "GET":
            for k, body in PROD.items():
                if path.endswith(f"/api/public/pages/{k}"): return await route.fulfill(status=200, body=body, content_type="application/json")
        if route.request.method != "GET" and "/auth/" not in url and not any(ck in url for ck in clones.values()): BLOCKED.append(url); return await route.abort()
        await route.continue_()
    await ctx.route("**/api/**", h)

async def load(page, url, vw, sel, M, vh=1000, wait=2200):
    await page.set_viewport_size({"width": vw, "height": vh}); await page.goto(url); await page.wait_for_selector(sel, state="attached", timeout=30000)
    await page.evaluate("async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y); await new Promise(r=>setTimeout(r,40))} scrollTo(0,0)}"); await page.wait_for_timeout(wait)
    await page.evaluate(GEO); await page.evaluate("()=>{" + VIS + "}")
    return await page.evaluate(M)

def errs(page):
    page.on("pageerror", lambda e: ERRS.append(str(e))); page.on("console", lambda m: ERRS.append(m.text) if m.type == "error" and ("React" in m.text or "Warning" in m.text) else None)

def th_line(tag, m, w=42, th=2, gap=30):
    a, e = m["a"], m["eb"]
    ok(f"{tag} line {w}x{th} gap {gap} above eyebrow, left aligned, ruby", a and abs(a["w"] - w) <= .6 and abs(a["h"] - th) <= .6 and abs(e["t"] - a["b"] - gap) <= .6 and abs(a["l"] - e["l"]) <= .6 and m["abg"] == "rgb(212, 20, 69)", (a, e["t"], e["l"], m["abg"]))
    ok(f"{tag} exactly one new accent, no eyebrow ::before/::after line", m["nAcc"] == 1 and m["nAccLbl"] == 1 and m["pseudo"] == [False, False], (m["nAcc"], m["nAccLbl"], m["pseudo"]))

async def login(page):
    await page.goto(BASE + "/admin/login"); await page.fill('[data-testid="login-email"]', "admin@uspindia.org"); await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
    await page.click('[data-testid="login-submit"]'); await page.wait_for_url(lambda u: "/admin" in u and "/login" not in u, timeout=20000)

async def drag(page, dx=43, dy=27):
    g = await page.locator('[data-testid=live-move-grip]').bounding_box(); x, y = g["x"] + g["width"] / 2, g["y"] + g["height"] / 2
    await page.mouse.move(x, y); await page.mouse.down()
    for i in range(1, 11): await page.mouse.move(x + dx * i / 10, y + dy * i / 10); await page.wait_for_timeout(30)
    await page.mouse.up(); await page.wait_for_timeout(700)

async def save(page):
    async with page.expect_response(lambda rr: "/live" in rr.url and rr.request.method == "PUT", timeout=15000) as ri:
        await page.locator('[data-testid="live-save-btn"]').dispatch_event("click")
    return (await ri.value).status

def clone(key, ck, mut=None):
    d = copy.deepcopy(db.pages.find_one({"key": key}, {"_id": 0})); d.update({"key": ck, "id": uuid.uuid4().hex, "path": f"/{ck}"})
    if mut:
        for part in ("published", "draft"):
            for s in (d.get(part) or {}).get("sections", []): mut(s)
    db.pages.insert_one(d)

async def main():
    before, sbefore = fp(), fps()
    real_rak = db.pages.find_one({"key": "rakhigarhi"})["published"]["sections"]; real_th = db.pages.find_one({"key": "theatre"})["published"]["sections"]
    rest_db = next(s for s in real_rak if s["id"] == REST); arch_db = next(s for s in real_th if s["id"] == ARCH)
    prod_rak = json.loads(PROD["rakhigarhi"])["content"]["sections"]; prod_use = next(s for s in prod_rak if s["id"] == USE)
    def use_prod_styles(s):
        if s["id"] == USE: s["styles"] = copy.deepcopy(prod_use["styles"])
    def th_prod(s):
        if s["id"] == ARCH: s["styles"] = copy.deepcopy(next(x for x in json.loads(PROD["theatre"])["content"]["sections"] if x["id"] == ARCH)["styles"])
    clone("rakhigarhi", KR, use_prod_styles); clone("theatre", KT, th_prod)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            for src in ("PREV", "PROD"):
                ctx = await b.new_context(); await isolate(ctx, prod=(src == "PROD")); page = await ctx.new_page(); errs(page)
                # ---------- ABOUT
                for vw in (1920, 1280, 768, 390):
                    m = await load(page, BASE + "/about", vw, "#our-approach > .about-approach", M_ABOUT)
                    exp = 24 if vw <= 700 else 48
                    ok(f"ABOUT {src} {vw} no grey top/bottom border on approach/wrapper", m["apB"][0] in ("0px",) and m["apB"][2] == "0px" and m["wrB"] == ["0px", "0px"], (m["apB"], m["wrB"]))
                    ok(f"ABOUT {src} {vw} footer gap == {exp}", abs(m["gap"] - exp) <= 1 and abs(m["wgap"] - exp) <= 1, (m["gap"], m["wgap"], m["arPB"], m["wr"]["h"], m["ap"]["h"]))
                    ok(f"ABOUT {src} {vw} no stray lines between approach and footer", not m["lines"], m["lines"][:4])
                    ok(f"ABOUT {src} {vw} content in bounds, no overflow", m["inb"] and m["sw"] <= vw, (m["inb"], m["sw"]))
                    ok(f"ABOUT {src} {vw} 5 visible sections only (hidden omitted)", m["nSec"] == 5, m["secIds"])
                    ok(f"ABOUT {src} {vw} footer internal separator retained", m["ftSep"] >= 1, m["ftSep"])
                    if vw == 1920: print(f"about {src} 1920 h2", m["h2"], m["txt"][:120])
                # ---------- RAKHIGARHI
                for vw in (1920, 1280, 768, 390):
                    m = await load(page, BASE + "/our-work/rakhigarhi", vw, "#haveli-in-use", M_RAK)
                    ok(f"RAK {src} {vw} #haveli-in-use exactly once", m["n"] == 1 and m["nSec"] == 1, (m["n"], m["nSec"]))
                    i = m["order"].index("haveli-in-use")
                    ok(f"RAK {src} {vw} order: after haveli-chaupal, before craft grid", m["order"][i - 1] == "haveli-chaupal" and m["gridAfter"] and m["order"][i + 1] == "craft-centre", (m["order"][i-1:i+2], m["next"]))
                    ok(f"RAK {src} {vw} exact heading + paragraph", m["ebTxt"].upper() == "A HAVELI BROUGHT BACK INTO USE" and m["ebFont"][3] == "uppercase" and m["bodyTxt"] == USE_TEXT, (m["ebTxt"], m["bodyTxt"][:60]))
                    ok(f"RAK {src} {vw} restoration 4 paragraphs unchanged", len(m["restP"]) == 4 and m["restP"][0].startswith("Its architecture, materials") and USE_TEXT not in " ".join(m["restP"]), [x[:30] for x in m["restP"]])
                    ok(f"RAK {src} {vw} haveli-in-use content in bounds", m["inb"], m["u"])
                    ok(f"RAK {src} {vw} no overlap with restoration above / craft below", m["uVis"]["t"] >= m["hcVis"]["b"] - 1 and m["uVis"]["b"] <= m["gridVis"]["t"] + 1, (m["hcVis"], m["uVis"], m["gridVis"]))
                    ok(f"RAK {src} {vw} no horizontal overflow", m["sw"] <= vw, m["sw"])
                    if src == "PROD": ok(f"RAK PROD {vw} live typography eyebrow14/body16 w400", m["ebFont"][0] == "14px" and m["pFont"][0] == "16px" and m["pFont"][1] == "400", (m["ebFont"], m["pFont"], m["bdFontInline"]))
                    if vw == 1920: print(f"rak {src} 1920", {k: m[k] for k in ("eb", "bd", "u", "ebFont", "pFont", "hcVis", "uVis", "gridVis")})
                # ---------- THEATRE
                for vw in (1920, 1280, 768, 390):
                    m = await load(page, BASE + "/our-work/theatre", vw, "[data-testid=block-2-accent-line]", M_TH)
                    th_line(f"TH {src} {vw}", m)
                    ok(f"TH {src} {vw} line does not overlap previous section content", m["a"]["t"] >= m["prevVis"]["b"] - 1, (m["a"]["t"], m["prevId"], m["prevVis"]))
                    ok(f"TH {src} {vw} heading/body/image unchanged, Explore absent, no overflow", m["heading"] == arch_db["data"]["heading"] and m["body"].replace("\n\n", "\n") .split("\n")[0] in arch_db["data"]["body_html"] and m["imgSrc"] and not m["explore"] and m["sw"] <= vw, (m["heading"], m["explore"], m["sw"]))
                    await page.evaluate("()=>document.querySelector('[data-testid=block-2-accent-line]').style.display='none'"); await page.wait_for_timeout(150)
                    n = await page.evaluate(M_TH)
                    ok(f"TH {src} {vw} line is out of flow (eyebrow/heading/body/image unmoved without it)", all(abs(n[k][f] - m[k][f]) <= .6 for k in ("eb", "h", "bd", "im") for f in ("l", "t", "w", "h")), "")
                    await page.evaluate("()=>document.querySelector('[data-testid=block-2-accent-line]').style.display=''")
                    if vw == 1920: print(f"th {src} 1920", {k: m[k] for k in ("eb", "a", "h", "ebFont", "hFont", "vars", "prevVis")}); t1920 = m
                await page.add_style_tag(content="html body #public-site { --accent-line-w: 80px !important; --accent-line: 5px !important; --accent-line-gap: 12px !important; }"); await page.wait_for_timeout(300)
                g = await page.evaluate(M_TH); th_line(f"TH {src} VARS 80/5/12", g, 80, 5, 12)
                ok(f"TH {src} default vars same as global site values", t1920["vars"] == ["42px", "2px", "30px"], t1920["vars"])
                await ctx.close()
            # ---------- RAK editor on clone (live styles)
            ctx = await b.new_context(viewport={"width": 1920, "height": 1080}); await isolate(ctx, clones={"rakhigarhi": KR}); page = await ctx.new_page(); errs(page)
            page.on("dialog", lambda dd: asyncio.ensure_future(dd.accept()))
            await login(page); await page.goto(BASE + "/our-work/rakhigarhi?edit=1"); await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=50000); await page.wait_for_timeout(2000)
            await page.evaluate(GEO); await page.evaluate("()=>{" + VIS + "}")
            EB, BD = "#haveli-in-use .eyebrow", "#haveli-in-use .prose"
            await page.locator(EB).scroll_into_view_if_needed(); await page.locator(EB).click(); await page.wait_for_timeout(600)
            lbl = await page.locator('[data-testid="live-selected-label"]').inner_text()
            p0 = await page.evaluate(M_RAK); ok("RAK ED click eyebrow selects label", "label" in lbl.lower() or "eyebrow" in lbl.lower(), lbl)
            await drag(page); p1 = await page.evaluate(M_RAK)
            ok("RAK ED eyebrow drag moves eyebrow only", abs(p1["eb"]["l"] - p0["eb"]["l"]) > 5 and abs(p1["bd"]["l"] - p0["bd"]["l"]) <= .6 and abs(p1["bd"]["t"] - p0["bd"]["t"]) <= .6, (p0["eb"]["l"], p1["eb"]["l"], p0["bd"], p1["bd"]))
            await page.keyboard.press("Escape"); await page.locator(BD).click(); await page.wait_for_timeout(600)
            lbl2 = await page.locator('[data-testid="live-selected-label"]').inner_text()
            await drag(page, -31, 19); p2 = await page.evaluate(M_RAK)
            ok("RAK ED body drag moves body only", ("body" in lbl2.lower() or "text" in lbl2.lower()) and abs(p2["bd"]["l"] - p1["bd"]["l"]) > 5 and abs(p2["eb"]["l"] - p1["eb"]["l"]) <= .6 and abs(p2["eb"]["t"] - p1["eb"]["t"]) <= .6, (lbl2, p1["bd"]["l"], p2["bd"]["l"]))
            ok("RAK ED restoration unaffected", p2["restP"] == p0["restP"] and abs(p2["hcVis"]["t"] - p0["hcVis"]["t"]) <= .6, "")
            # inline edit eyebrow text
            await page.keyboard.press("Escape"); await page.locator(EB).click(); await page.wait_for_timeout(500)
            await page.keyboard.press("End"); await page.keyboard.type(" Z"); await page.wait_for_timeout(200); await page.mouse.click(1850, 1040); await page.wait_for_timeout(600)
            p3 = await page.evaluate(M_RAK); ok("RAK ED eyebrow rename", p3["ebTxt"].endswith(" Z") or p3["ebTxt"].upper().endswith(" Z"), p3["ebTxt"])
            st = await save(page); ok("RAK ED save 200 (clone)", st == 200, st); await page.wait_for_timeout(1200)
            cs = {s["id"]: s for s in db.pages.find_one({"key": KR})["published"]["sections"]}
            u = cs[USE]; print("saved use", u["styles"], u["data"]["eyebrow"])
            ok("RAK DB clone: eyebrow + body offsets saved independently, fonts kept", u["styles"].get("eyebrow", {}).get("translateX") and u["styles"].get("body_html", {}).get("translateX") and u["styles"]["eyebrow"].get("fontSize") == "14px" and u["styles"]["body_html"].get("fontSize") == "16px" and u["data"]["eyebrow"].rstrip().endswith("Z"), u["styles"])
            ok("RAK DB clone: restoration section unchanged", cs[REST]["data"] == rest_db["data"] and cs[REST].get("styles") == rest_db.get("styles"), "")
            ok("RAK DB clone: body text unchanged", u["data"]["body_html"] == next(s for s in real_rak if s["id"] == USE)["data"]["body_html"], "")
            await ctx.close()
            ctx = await b.new_context(); await isolate(ctx, clones={"rakhigarhi": KR}); page = await ctx.new_page(); errs(page)
            f = await load(page, BASE + "/our-work/rakhigarhi", 1920, "#haveli-in-use", M_RAK, 1080)
            ok("RAK FRESH geometry == editor", all(abs(f[k][x] - p3[k][x]) <= 1.5 for k in ("eb", "bd") for x in ("l", "t")), {k: (f[k], p3[k]) for k in ("eb", "bd")})
            ok("RAK FRESH no overlap / in-bounds after moves", f["uVis"]["t"] >= f["hcVis"]["b"] - 1 and f["uVis"]["b"] <= f["gridVis"]["t"] + 1, (f["hcVis"], f["uVis"], f["gridVis"]))
            await ctx.close()
            # ---------- THEATRE editor on clone (prod-style offsets)
            ctx = await b.new_context(viewport={"width": 1920, "height": 1080}); await isolate(ctx, clones={"theatre": KT}); page = await ctx.new_page(); errs(page)
            page.on("dialog", lambda dd: asyncio.ensure_future(dd.accept()))
            await login(page); await page.goto(BASE + "/our-work/theatre?edit=1"); await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=50000); await page.wait_for_timeout(2000)
            await page.evaluate(GEO); await page.evaluate("()=>{" + VIS + "}")
            await page.locator('[data-testid=block-2-eyebrow]').scroll_into_view_if_needed(); await page.wait_for_timeout(400)
            e0 = await page.evaluate(M_TH); th_line("TH ED init", e0)
            ab = await page.locator('[data-testid=block-2-accent-line]').bounding_box()
            await page.mouse.click(ab["x"] + 20, ab["y"] + 1); await page.wait_for_timeout(700)
            lbl = await page.locator('[data-testid="live-selected-label"]').inner_text() if await page.locator('[data-testid="live-selected-label"]').count() else None
            s1 = await page.evaluate(M_TH)
            ok("TH ED click line selects eyebrow", lbl and ("label" in lbl.lower() or "eyebrow" in lbl.lower()), lbl)
            ok("TH ED only inner text contenteditable + focused", s1["innerCE"] == "true" and s1["ebCE"] != "true" and await page.evaluate("()=>document.activeElement.hasAttribute('data-edit-text')"), (s1["ebCE"], s1["innerCE"]))
            await page.keyboard.press("End"); await page.keyboard.type(" X"); await page.wait_for_timeout(200); await page.mouse.click(1850, 1040); await page.wait_for_timeout(600)
            r1 = await page.evaluate(M_TH); ok("TH ED rename keeps line, label 'Theatre Over Time X'", (r1["label"] or "").strip() == "Theatre Over Time X" and r1["nAcc"] == 1, r1["label"]); th_line("TH ED after rename", r1)
            await page.locator('[data-testid=block-2-eyebrow] [data-edit-text]').click(); await page.wait_for_timeout(500)
            pre = await page.evaluate(M_TH); await drag(page); dm = await page.evaluate(M_TH)
            dx, dy = dm["eb"]["l"] - pre["eb"]["l"], dm["eb"]["t"] - pre["eb"]["t"]
            ok("TH ED drag moves eyebrow + line together", (abs(dx) > 5 or abs(dy) > 5) and abs(dm["a"]["l"] - pre["a"]["l"] - dx) <= .6 and abs(dm["a"]["t"] - pre["a"]["t"] - dy) <= .6, (dx, dy))
            ok("TH ED drag: heading/body/image not moved", all(abs(dm[k][f] - pre[k][f]) <= .6 for k in ("h", "bd", "im") for f in ("l", "t")), "")
            await page.evaluate("()=>{const i=document.querySelector('[data-testid=live-move-x]'); let d=i&&i.closest('details'); while(d){d.open=true; d=d.parentElement&&d.parentElement.closest('details')}}"); await page.wait_for_timeout(300)
            mx = page.locator('[data-testid=live-move-x]'); cur = float(await mx.input_value() or 0); await mx.fill(str(int(cur) + 15)); await page.wait_for_timeout(1200); nm = await page.evaluate(M_TH)
            ok("TH ED Move X moves line+text", abs(nm["eb"]["l"] - dm["eb"]["l"] - (int(cur) + 15 - cur)) <= 1 and abs(nm["a"]["l"] - nm["eb"]["l"]) <= .6, (nm["eb"]["l"], dm["eb"]["l"]))
            await page.locator('[data-testid=live-undo]').click(); await page.wait_for_timeout(1200); u1 = await page.evaluate(M_TH)
            ok("TH ED undo", abs(u1["eb"]["l"] - dm["eb"]["l"]) <= 1 and abs(u1["a"]["l"] - u1["eb"]["l"]) <= .6, (u1["eb"]["l"], dm["eb"]["l"]))
            await page.locator('[data-testid=live-redo]').click(); await page.wait_for_timeout(1200); r2 = await page.evaluate(M_TH)
            ok("TH ED redo", abs(r2["eb"]["l"] - nm["eb"]["l"]) <= 1 and r2["nAcc"] == 1, (r2["eb"]["l"], nm["eb"]["l"]))
            await page.keyboard.press("Escape"); await page.wait_for_timeout(300); ed = await page.evaluate(M_TH)
            ok("TH ED Save/Close buttons clickable (topmost)", await page.evaluate("()=>['live-save-btn','live-close-btn','live-editor-close'].map(t=>document.querySelector(`[data-testid=${t}]`)).filter(Boolean).every(e=>{const b=e.getBoundingClientRect(); const x=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2); return e===x||e.contains(x)})"), "")
            st = await save(page); ok("TH ED save 200 (clone)", st == 200, st); await page.wait_for_timeout(1200)
            sec = next(s for s in db.pages.find_one({"key": KT})["published"]["sections"] if s["id"] == ARCH); print("saved th", sec["styles"].get("eyebrow"), sec["data"].get("eyebrow"))
            ok("TH DB clone label + offsets saved, heading/body/image untouched", sec["data"]["eyebrow"] == "Theatre Over Time X" and sec["styles"]["eyebrow"].get("translateX") and {k: v for k, v in sec["data"].items() if k != "eyebrow"} == {k: v for k, v in arch_db["data"].items() if k != "eyebrow"}, sec["styles"].get("eyebrow"))
            await ctx.close()
            ctx = await b.new_context(); await isolate(ctx, clones={"theatre": KT}); page = await ctx.new_page(); errs(page)
            f = await load(page, BASE + "/our-work/theatre", 1920, "[data-testid=block-2-accent-line]", M_TH, 1080)
            th_line("TH FRESH", f); ok("TH FRESH geometry == editor", all(abs(f[k][x] - ed[k][x]) <= 1 for k in ("eb", "a", "h") for x in ("l", "t", "w")), {k: (f[k], ed[k]) for k in ("eb", "a")})
            ok("TH FRESH label + fonts", (f["label"] or "").strip() == "Theatre Over Time X" and f["ebFont"] == ed["ebFont"] and f["hFont"] == ed["hFont"], (f["label"], f["ebFont"]))
            for vw in (768, 390):
                mm = await load(page, BASE + "/our-work/theatre", vw, "[data-testid=block-2-accent-line]", M_TH); th_line(f"TH FRESH {vw}", mm); ok(f"TH FRESH {vw} no overflow", mm["sw"] <= vw, mm["sw"])
            await ctx.close(); await b.close()
    except Exception as e:
        import traceback; traceback.print_exc(); ok("EXCEPTION", False, repr(e)[:500])
    finally:
        for k in (KR, KT): db.pages.delete_many({"key": k}); db.revisions.delete_many({"entity_id": k})
        ok("REAL pages unchanged", fp() == before); ok("settings unchanged", fps() == sbefore)
        ok("no React errors/pageerrors", not ERRS, ERRS[:5]); print("blocked", BLOCKED)
        print(f"TOTAL {sum(r for _, r in R)}/{len(R)}; FAILS:", [n for n, r in R if not r])
asyncio.run(main())
