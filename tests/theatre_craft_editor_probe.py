# Playwright (ISOLATED, read-only repro): Theatre #past-work delete + Craft Centre move/selection probe.
# Clones theatre & craft-livelihood to TEST_ keys; browser /api/.../pages/<key> requests are re-routed to clones,
# other non-GET writes are aborted. Never saves; real docs fingerprinted before/after.
import asyncio, os, json, uuid, copy, hashlib
from playwright.async_api import async_playwright
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env"); load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEYS = {"theatre": f"TEST_th_{uuid.uuid4().hex[:8]}", "craft-livelihood": f"TEST_cr_{uuid.uuid4().hex[:8]}"}
BLOCKED = []
def fp(k): return hashlib.sha256(json.dumps(db.pages.find_one({"key": k}, {"_id": 0}), sort_keys=True, default=str).encode()).hexdigest()

async def isolate(ctx):
    async def handler(route):
        url = route.request.url
        for real, test in KEYS.items():
            if f"/pages/{real}/live" in url or url.split("?")[0].endswith(f"/public/pages/{real}"):
                return await route.continue_(url=url.replace(f"/pages/{real}", f"/pages/{test}"))
        if route.request.method != "GET" and ("/auth/" not in url):
            BLOCKED.append((route.request.method, url)); return await route.abort()
        await route.continue_()
    await ctx.route("**/api/**", handler)

GEO = """(a) => { const sec=document.querySelector(a.sel); if(!sec) return null; const q=f=>{const e=sec.querySelector('[data-edit="'+f+'"]'); if(!e) return null; const r=e.getBoundingClientRect(); return {x:Math.round(r.left+scrollX),y:Math.round(r.top+scrollY),w:Math.round(r.width),h:Math.round(r.height),tf:getComputedStyle(e).transform}};
 const box=document.querySelector('[data-testid=live-selection-box]'); const br=box&&box.getBoundingClientRect();
 const order=[...document.querySelectorAll('main [data-sec]')].map(e=>e.dataset.sec);
 const out={exists:true, secIdx: order.indexOf(sec.closest('[data-sec]')?.dataset.sec), nSecs: order.length, secY: Math.round(sec.getBoundingClientRect().top+scrollY),
   box: br?{x:Math.round(br.left+scrollX),y:Math.round(br.top+scrollY),w:Math.round(br.width),h:Math.round(br.height),isSec:box.classList.contains('live-box-sec')}:null};
 for (const f of a.fields) out[f]=q(f); return out; }"""

async def login(ctx):
    page = await ctx.new_page()
    await page.goto(BASE + "/admin/login")
    await page.fill('[data-testid="login-email"]', "admin@uspindia.org")
    await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
    await page.click('[data-testid="login-submit"]')
    await page.wait_for_url("**/admin**", timeout=15000); await page.wait_for_timeout(800)
    return page

async def open_editor(page, path):
    await page.goto(BASE + path + "?edit=1")
    await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(1500)

def which(g, fields):
    b = g["box"]
    if not b: return None
    if b["isSec"]: return "_section"
    for f in fields:
        e = g.get(f)
        if e and abs(e["x"] - b["x"]) < 4 and abs(e["y"] - b["y"]) < 4 and abs(e["w"] - b["w"]) < 6: return f
    return f"?{b}"

async def select(page, sel, f):
    el = page.locator(f'{sel} [data-edit="{f}"]').first
    await el.scroll_into_view_if_needed(); await el.click()
    await page.wait_for_selector('[data-testid="live-selection-box"]', timeout=5000); await page.wait_for_timeout(300)

async def undo_all(page):
    for _ in range(10):
        if await page.locator('[data-testid="live-undo"]').is_disabled(): break
        await page.click('[data-testid="live-undo"]'); await page.wait_for_timeout(250)

async def theatre(page):
    S = "#past-work"; F = ["eyebrow", "heading", "body_html", "image", "link_label"]
    await open_editor(page, "/our-work/theatre")
    g0 = await page.evaluate(GEO, {"sel": S, "fields": F}); print("TH initial", json.dumps(g0))
    await select(page, S, "link_label")
    g1 = await page.evaluate(GEO, {"sel": S, "fields": F}); print("TH selected:", which(g1, F), "sectools visible:", await page.locator('[data-testid=live-section-tools]').is_visible())
    await page.click('[data-testid="live-sec-delete"]', force=True); await page.wait_for_timeout(600)
    g2 = await page.evaluate(GEO, {"sel": S, "fields": F})
    print("TH after trash on link_label: section exists:", bool(g2), "img present:", await page.locator(f"{S} img").count() if g2 else 0,
          "status:", await page.locator('[data-testid=live-status]').inner_text())
    await undo_all(page); g3 = await page.evaluate(GEO, {"sel": S, "fields": F}); print("TH after undo restored:", bool(g3) and bool(g3.get("image")))
    # Keyboard deletion of link text
    await select(page, S, "link_label"); await page.keyboard.press("Control+a"); await page.keyboard.press("Delete"); await page.keyboard.press("Escape"); await page.wait_for_timeout(500)
    g4 = await page.evaluate(GEO, {"sel": S, "fields": F})
    print("TH after keyboard clear link text: section", bool(g4), "image", bool(g4 and g4.get("image")), "link", g4 and g4.get("link_label"))
    await undo_all(page)
    # Click mapping
    for f in ["image", "heading", "body_html", "link_label"]:
        await select(page, S, f); g = await page.evaluate(GEO, {"sel": S, "fields": F}); print(f"TH click {f} -> {which(g, F)}")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(150)
    # Separator inventory (read-only)
    lines = await page.evaluate("""() => { const out=[]; const vw=innerWidth;
      document.querySelectorAll('main *').forEach(el=>{ const cs=getComputedStyle(el); const r=el.getBoundingClientRect(); if(r.width<1) return;
        for (const s of ['Top','Bottom']) { const w=parseFloat(cs['border'+s+'Width']); if(w>0 && cs['border'+s+'Style']!=='none') out.push({kind:'border-'+s.toLowerCase(), cls:el.className.toString().slice(0,60), sec: el.closest('[data-sec]')?.id || el.closest('[data-sec]')?.dataset.sec?.slice(0,8), w:Math.round(r.width), y:Math.round(r.top+scrollY), color:cs['border'+s+'Color'], full: r.width>vw*0.6}); }
        for (const p of ['::before','::after']) { const c=getComputedStyle(el,p); if(c.content==='none'||c.display==='none') continue; const h=parseFloat(c.height), w=parseFloat(c.width)||0, bt=parseFloat(c.borderTopWidth)||0;
          if((h>0&&h<=4)||(bt>0&&bt<=4&&h<=4)) out.push({kind:'pseudo'+p, cls:el.className.toString().slice(0,60), sec: el.closest('[data-sec]')?.id || '', w: c.width, h:c.height, bg:c.backgroundColor, bt:c.borderTopColor, y:Math.round(r.top+scrollY)}); }
        if(el.tagName==='HR' || (r.height>0&&r.height<=4&&r.width>40&&cs.backgroundColor!=='rgba(0, 0, 0, 0)')) out.push({kind:el.tagName==='HR'?'hr':'thin-el', cls:el.className.toString().slice(0,60), sec: el.closest('[data-sec]')?.id||'', w:Math.round(r.width), h:Math.round(r.height), bg:cs.backgroundColor, y:Math.round(r.top+scrollY), full:r.width>vw*0.6});
      }); return out; }""")
    print("TH LINES", len(lines)); [print("  ", json.dumps(l)) for l in lines]
    await page.click('[data-testid="live-exit-btn"]'); await page.wait_for_timeout(500)

async def craft(page):
    S = "#craft-centre"; F = ["eyebrow", "heading", "body_html", "image"]
    await open_editor(page, "/our-work/craft-livelihood")
    g0 = await page.evaluate(GEO, {"sel": S, "fields": F}); print("CR initial", json.dumps(g0))
    for f in ["heading", "body_html", "eyebrow"]:
        await select(page, S, f)
        a = await page.evaluate(GEO, {"sel": S, "fields": F}); sel_as = which(a, F)
        grip = await page.locator('[data-testid="live-move-grip"]').bounding_box()
        cx, cy = grip["x"] + grip["width"] / 2, grip["y"] + grip["height"] / 2
        await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 40, cy + 30, steps=6); await page.mouse.move(cx + 83, cy + 57, steps=6); await page.mouse.up(); await page.wait_for_timeout(400)
        b = await page.evaluate(GEO, {"sel": S, "fields": F})
        d = lambda k: (b[k]["x"] - a[k]["x"], b[k]["y"] - a[k]["y"]) if a.get(k) and b.get(k) else None
        print(f"CR drag grip with {f} selected (as {sel_as}): Δ{f}={d(f)} Δimage={d('image')} Δothers={ {k: d(k) for k in F if k not in (f, 'image')} } secY {a['secY']}->{b['secY']} tf={b[f]['tf']}")
        await undo_all(page); await page.keyboard.press("Escape"); await page.wait_for_timeout(200)
    for btn in ["live-sec-up", "live-sec-down"]:
        await select(page, S, "heading"); a = await page.evaluate(GEO, {"sel": S, "fields": F})
        await page.click(f'[data-testid="{btn}"]', force=True); await page.wait_for_timeout(600)
        b = await page.evaluate(GEO, {"sel": S, "fields": F})
        print(f"CR {btn} with heading selected: secIdx {a['secIdx']}->{b['secIdx']} secY {a['secY']}->{b['secY']} imageY {a['image']['y']}->{b['image']['y']} headingY {a['heading']['y']}->{b['heading']['y']}")
        await undo_all(page); await page.keyboard.press("Escape"); await page.wait_for_timeout(200)
    # Arrow-key nudge with image selected vs text
    for f in ["image"]:
        await select(page, S, f); await page.keyboard.press("Escape"); await page.wait_for_timeout(100)
    # Click mapping, incl. blank split-text padding and figure/caption
    for f in F:
        await select(page, S, f); g = await page.evaluate(GEO, {"sel": S, "fields": F}); print(f"CR click {f} -> {which(g, F)}")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(150)
    pt = await page.evaluate("""() => { const st=document.querySelector('#craft-centre .split-text'); const r=st.getBoundingClientRect(); const pts=[];
       for (let y=r.top+2; y<r.bottom; y+=6) for (let x=r.left+2; x<r.right; x+=12) { const e=document.elementFromPoint(x,y); if(e && st.contains(e) && !e.closest('[data-edit]')) pts.push([x,y,e.className.toString()]); }
       const pad=getComputedStyle(st); return {n:pts.length, first:pts[0], last:pts[pts.length-1], rect:[r.left,r.top,r.width,r.height].map(Math.round), pad:[pad.paddingTop,pad.paddingLeft], vp:innerHeight}; }""")
    print("CR blank split-text points", json.dumps(pt))
    if pt["n"]:
        await page.mouse.click(pt["first"][0], pt["first"][1]); await page.wait_for_timeout(300)
        g = await page.evaluate(GEO, {"sel": S, "fields": F}); print("CR click blank split-text ->", which(g, F))
        await page.keyboard.press("Escape")
    fig = await page.evaluate("""() => { const e=document.querySelector('#craft-centre [data-edit=image]'); return {tag:e.tagName, cls:e.className.toString(), hasCaption: !!e.querySelector('figcaption'), parentEdit: !!e.parentElement.closest('[data-edit]')}; }""")
    print("CR image element", fig)
    await page.click('[data-testid="live-exit-btn"]'); await page.wait_for_timeout(500)

async def main():
    before = {k: fp(k) for k in KEYS}
    for real, test in KEYS.items():
        d = copy.deepcopy(db.pages.find_one({"key": real}, {"_id": 0})); d.update({"key": test, "id": uuid.uuid4().hex, "path": f"/{test}"}); db.pages.insert_one(d)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1920, "height": 1080}); await isolate(ctx)
            page = await login(ctx); errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("dialog", lambda dlg: asyncio.ensure_future(dlg.accept()))
            await theatre(page); await craft(page)
            print("page errors", errs[:5], "blocked", BLOCKED); await b.close()
    except Exception as e:
        print("EXCEPTION", repr(e))
    finally:
        for test in KEYS.values(): db.pages.delete_many({"key": test}); db.revisions.delete_many({"entity_id": test})
        print("real docs unchanged:", {k: fp(k) == before[k] for k in KEYS})

asyncio.run(main())
