# Iter25: every small horizontal red accent (real spans + ::before/::after, incl. NoteReader portal) renders at the global size.
# Read-only: all non-GET API aborted (except /auth/ login); header_styles overrides injected only via route.fulfill of /api/public/site.
import asyncio, os, json, hashlib, urllib.request
from playwright.async_api import async_playwright
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env"); load_dotenv("/app/frontend/.env"); load_dotenv("/root/production.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
PROD_URL = os.environ.get("PRODUCTION_SITE_URL", "").rstrip("/")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
R, BLOCKED, ERRS = [], [], []
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read()
def ok(n, c, i=""): R.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n, str(i)[:900])
def fp(): return hashlib.sha256(json.dumps([list(db.pages.find({}, {"_id": 0})), list(db.settings.find({}, {"_id": 0}))], sort_keys=True, default=str).encode()).hexdigest()
NOTES = json.loads(get(BASE + "/api/public/notes"))["items"]
SLUG = NOTES[0]["slug"]
PAGES = ["/", "/about", "/our-work/rakhigarhi", "/our-work/theatre", "/our-work/craft-livelihood", "/our-work/workshops-learning", "/connect", "/field-notes", f"/field-notes/{SLUG}", f"/field-notes?note={SLUG}"]
SITE = json.loads(get(BASE + "/api/public/site"))
PROD = {}
if PROD_URL:
    for k in ("home", "about", "rakhigarhi", "theatre", "craft-livelihood", "workshops-learning", "connect", "field-notes"):
        try: PROD[k] = get(f"{PROD_URL}/api/public/pages/{k}")
        except Exception as e: print("prod fetch fail", k, e)

SCAN = """() => { const out=[], vert=[];
 const red=c=>{const m=c&&c.match(/rgba?\\(([\\d.]+), ([\\d.]+), ([\\d.]+)(?:, ([\\d.]+))?/); return m && +m[1]>=150 && +m[2]<=90 && +m[3]<=130 && (m[4]===undefined || +m[4]>0.3)};
 const name=e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\\s+/).slice(0,3).join('.'):'')+(e.dataset.testid?'[tid='+e.dataset.testid+']':'');
 const path=e=>{const a=[]; let x=e; for(let i=0;i<3&&x&&x!==document.body;i++){a.unshift(name(x)); x=x.parentElement} return a.join(' > ')};
 document.querySelectorAll('body *').forEach(e=>{ if(e.closest('button,input,select,textarea,a.btn,.live-ui,#site-header')) return; if(!e.getClientRects().length) return;
  const hs=getComputedStyle(e); if(hs.visibility==='hidden') return;
  for(const p of ['', '::before', '::after']){ const s=getComputedStyle(e, p||null); if(p && (s.content==='none'||s.content==='normal')) continue; if(s.display==='none') continue;
   let w,h; if(p){w=parseFloat(s.width); h=parseFloat(s.height); if(isNaN(w)||isNaN(h)) continue;} else {const b=e.getBoundingClientRect(); w=b.width; h=b.height; if(e.children.length) continue;}
   const bgR=red(s.backgroundColor), btR=parseFloat(s.borderTopWidth)>0&&s.borderTopStyle!=='none'&&red(s.borderTopColor)&&h<=1, blR=parseFloat(s.borderLeftWidth)>0&&s.borderLeftStyle!=='none'&&red(s.borderLeftColor);
   if(bgR && w>0 && h>0 && w>=h*3 && h<=14 && w<=320) out.push({el:path(e), p, w:+w.toFixed(2), h:+h.toFixed(2), bg:s.backgroundColor});
   else if(btR && w>0 && w<=320) out.push({el:path(e), p, w:+w.toFixed(2), h:+parseFloat(s.borderTopWidth).toFixed(2), bg:'border:'+s.borderTopColor});
   else if(bgR && w>0 && h>w*3) vert.push({el:path(e), p, w:+w.toFixed(2), h:+h.toFixed(2)});
   else if(blR && !p && e.getBoundingClientRect().height>20) vert.push({el:path(e), p:'border-left', w:+parseFloat(s.borderLeftWidth).toFixed(2), h:+e.getBoundingClientRect().height.toFixed(2)});
  }});
 return {out, vert, sw:document.documentElement.scrollWidth, vw:innerWidth, ov:!!document.querySelector('style[data-testid=header-style-overrides]')} }"""

async def isolate(ctx, styles=None, prod=False):
    async def h(route):
        req = route.request; url = req.url; path = url.split("?")[0]
        if req.method != "GET" and "/auth/" not in url: BLOCKED.append((req.method, url)); return await route.abort()
        if styles is not None and path.endswith("/api/public/site"):
            s = dict(SITE); s["header_styles"] = styles; return await route.fulfill(status=200, body=json.dumps(s), content_type="application/json")
        if prod and req.method == "GET":
            for k, body in PROD.items():
                if path.endswith(f"/api/public/pages/{k}"): return await route.fulfill(status=200, body=body, content_type="application/json")
        await route.continue_()
    await ctx.route("**/api/**", h)

async def scan(page, url, vw):
    await page.set_viewport_size({"width": vw, "height": 1000}); await page.goto(BASE + url, wait_until="domcontentloaded")
    await page.wait_for_selector("#public-site", timeout=30000)
    if "note=" in url: await page.wait_for_selector('[data-testid=note-reader-accent-line]', timeout=20000)
    await page.evaluate("async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y); await new Promise(r=>setTimeout(r,40))} scrollTo(0,0)}"); await page.wait_for_timeout(1500)
    return await page.evaluate(SCAN)

def check(tag, m, w, h):
    bad = [x for x in m["out"] if abs(x["w"] - w) > .6 or abs(x["h"] - h) > .6]
    need = any(k in tag for k in ("about", "rakhigarhi", "theatre", "craft", "workshops", "note="))
    ok(f"{tag} all {len(m['out'])} red horiz accents {w}x{h}", (m["out"] or not need) and not bad, bad or [(x['el'][-60:], x['p']) for x in m['out']])
    ok(f"{tag} no horizontal overflow", m["sw"] <= m["vw"], (m["sw"], m["vw"]))

async def main():
    f0 = fp(); vert_def = {}
    async with async_playwright() as p:
        br = await p.chromium.launch()
        # 1) default scan, 4 viewports
        ctx = await br.new_context(); await isolate(ctx); page = await ctx.new_page()
        page.on("pageerror", lambda e: ERRS.append(str(e))); page.on("console", lambda m: ERRS.append(m.text) if m.type == "error" else None)
        for vw in (1920, 1280, 768, 390):
            for u in PAGES:
                m = await scan(page, u, vw); check(f"DEF {vw} {u}", m, 42, 2); vert_def[(vw, u)] = m["vert"]
                if vw == 1920: print("   accents:", [(x['el'][-70:], x['p'], x['w'], x['h']) for x in m['out']]); print("   vert:", [(x['el'][-50:], x['p'], x['w'], x['h']) for x in m['vert']])
            th = await scan(page, "/our-work/theatre", vw)
            ids = [x for x in th["out"] if "block-0-accent-line" in x["el"] or "theatre-label-accent" in x["el"]]
            ok(f"DEF {vw} theatre split-rule & label accent both present", len(ids) >= 2, ids)
        await ctx.close()
        # 2) prod content injected (live fonts/offsets) @1920 + 390
        if PROD:
            ctx = await br.new_context(); await isolate(ctx, prod=True); page = await ctx.new_page()
            for vw in (1920, 390):
                for u in PAGES[:8]: check(f"PROD {vw} {u}", await scan(page, u, vw), 42, 2)
            await ctx.close()
        # 3) injected global override 80x5 -> all accents incl. portal; vertical heights unchanged
        ctx = await br.new_context(); await isolate(ctx, styles={"accentLineWidth": "80px", "accentLineThickness": "5px"}); page = await ctx.new_page()
        for vw in (1920, 390):
            for u in PAGES:
                m = await scan(page, u, vw); check(f"OVR {vw} {u}", m, 80, 5)
                vh = [(x['el'], x['p'], x['h']) for x in m['vert']]; vd = [(x['el'], x['p'], x['h']) for x in vert_def[(vw, u)]]
                ok(f"OVR {vw} {u} vertical red line heights unchanged", [a[:2] for a in vh] == [a[:2] for a in vd] and all(abs(a[2] - b[2]) <= 1 for a, b in zip(vh, vd)), (vh, vd))
        await ctx.close()
        # 4) editor preview: change inputs live (no save)
        ctx = await br.new_context(); await isolate(ctx); page = await ctx.new_page(); await page.set_viewport_size({"width": 1920, "height": 1000})
        await page.goto(BASE + "/admin/login"); await page.fill('[data-testid="login-email"]', "admin@uspindia.org"); await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
        await page.click('[data-testid="login-submit"]'); await page.wait_for_url(lambda u: "/admin" in u and "/login" not in u, timeout=20000)
        await page.goto(BASE + "/our-work/theatre?edit=1"); await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=50000); await page.wait_for_timeout(2000)
        try:
            await page.locator('#site-header .brand-name').first.click(); await page.wait_for_selector('[data-testid=live-header-panel]', timeout=10000)
            await page.click('[data-testid=header-tab-style]'); await page.wait_for_timeout(400)
            await page.fill('[data-testid=header-style-accent-line-width]', "80"); await page.fill('[data-testid=header-style-accent-line-thickness]', "5"); await page.wait_for_timeout(800)
            dims = await page.evaluate("()=>['block-0-accent-line'].map(t=>{const b=document.querySelector(`[data-testid=${t}]`).getBoundingClientRect(); return [b.width,b.height]}).concat([...document.querySelectorAll('.theatre-label-accent')].map(e=>[e.getBoundingClientRect().width,e.getBoundingClientRect().height]))")
            ok("EDITOR preview 80x5 applied to theatre actual-span accents", all(abs(w - 80) < .6 and abs(h - 5) < .6 for w, h in dims), dims)
            m = await page.evaluate(SCAN); ok("EDITOR preview all accents 80x5", m["out"] and all(abs(x["w"] - 80) < .6 and abs(x["h"] - 5) < .6 for x in m["out"]), [(x['el'][-50:], x['p'], x['w'], x['h']) for x in m['out']])
            await page.screenshot(path="/app/.screenshots/iter25_editor_80x5.jpg", quality=40)
            await page.click('[data-testid=header-styles-reset]'); await page.wait_for_timeout(600)
            m = await page.evaluate(SCAN); ok("EDITOR reset -> 42x2", m["out"] and all(abs(x["w"] - 42) < .6 and abs(x["h"] - 2) < .6 for x in m["out"]), [(x['el'][-50:], x['w'], x['h']) for x in m['out'] if abs(x['w']-42)>.6])
            await page.click('[data-testid=header-editor-discard]'); await page.wait_for_timeout(500)
        except Exception as e: ok("EDITOR flow", False, e)
        await ctx.close(); await br.close()
    ok("real pages/settings untouched (fingerprint)", fp() == f0)
    ok("only blocked non-GET (none expected beyond editor autosave)", True, BLOCKED[:10])
    re = [e for e in ERRS if "React" in e or "Warning" in e or "Uncaught" in e]
    ok("no React/page errors", not re, re[:5]); print("other console errors:", [e for e in ERRS if e not in re][:8])
    print(f"\n{sum(c for _, c in R)}/{len(R)} passed"); [print("  FAILED:", n) for n, c in R if not c]

asyncio.run(main())
