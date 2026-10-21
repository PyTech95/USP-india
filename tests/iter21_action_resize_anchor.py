# Iter21 NO-WRITE: grouped action (Explore Field Notes) resize anchoring: east keeps LEFT fixed, west keeps RIGHT fixed;
# gap/centre kept; undo/redo; panel top12 + handle hit; no ResizeObserver loop / React errors. All non-GET /api blocked; nothing saved.
import asyncio, os
from playwright.async_api import async_playwright
from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
RES, BLOCKED, CONS = [], [], []
def ok(n, c, info=""): RES.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n, info)
GEOM = """(tid) => { const a=document.querySelector(`[data-testid="${tid}"]`); const t=a.querySelector('[data-edit-text]'), s=a.querySelector('svg'); const ar=a.getBoundingClientRect(), tr=t.getBoundingClientRect(), sr=s.getBoundingClientRect();
 return {l:+ar.left.toFixed(1), r:+ar.right.toFixed(1), w:+ar.width.toFixed(1), gap:Math.round(sr.left-tr.right), vc:Math.round(Math.abs((sr.top+sr.height/2)-(tr.top+tr.height/2))), lines:t.getClientRects().length,
  cx:+((tr.left+sr.right)/2-(ar.left+ar.right)/2).toFixed(1), jc:getComputedStyle(a).justifyContent, tr:a.style.transform||getComputedStyle(a).transform} }"""
HIT = """(t) => { const h=document.querySelector(`[data-testid=${t}]`); if(!h) return null; const r=h.getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return !!e && (e===h||h.contains(e)) }"""
PTOP = "()=>Math.round(document.querySelector('[data-testid=live-editor-panel]').getBoundingClientRect().top)"

async def drag(page, htid, dx):
    hb = await page.locator(f'[data-testid="{htid}"]').bounding_box()
    x, y = hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y, steps=10); await page.mouse.up(); await page.wait_for_timeout(700)

def aligned(g): return g["lines"] == 1 and g["vc"] <= 4 and 0 <= g["gap"] <= 16

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(); ctx = await b.new_context(viewport={"width": 1920, "height": 1080})
        async def block(route):
            if route.request.method != "GET" and "/auth/" not in route.request.url: BLOCKED.append(route.request.url); return await route.abort()
            await route.continue_()
        await ctx.route("**/api/**", block)
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: CONS.append(m.text) if m.type in ("error", "warning") else None)
        page.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await page.goto(BASE + "/admin/login"); await page.fill('[data-testid="login-email"]', "admin@uspindia.org"); await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
        await page.click('[data-testid="login-submit"]'); await page.wait_for_url(lambda u: "/admin" in u and "/login" not in u, timeout=20000)
        try:
            await page.goto(BASE + "/?edit=1"); await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(2000)
            tid = await page.evaluate("()=>{const e=[...document.querySelectorAll('[data-edit-group=action]')].find(e=>/Field Notes/i.test(e.innerText)); return e&&e.dataset.testid}")
            loc = page.locator(f'[data-testid="{tid}"] svg'); await loc.scroll_into_view_if_needed(); await page.wait_for_timeout(300); await loc.click(force=True); await page.wait_for_timeout(800)
            g0 = await page.evaluate(GEOM, tid); print("g0", g0)
            ok("panel top12, east+west handles hit", await page.evaluate(PTOP) == 12 and await page.evaluate(HIT, "live-resize-e") and await page.evaluate(HIT, "live-resize-w"))
            # EAST +50
            await drag(page, "live-resize-e", 50); g1 = await page.evaluate(GEOM, tid); print("east", g1)
            ok("EAST +50: left edge fixed (<=2px)", abs(g1["l"] - g0["l"]) <= 2, (g0["l"], g1["l"]))
            ok("EAST +50: right edge +50 (+-2px)", abs((g1["r"] - g0["r"]) - 50) <= 2, g1["r"] - g0["r"])
            ok("EAST: text/arrow gap+centre single line", aligned(g1), (g1["gap"], g1["vc"], g1["lines"], g1["cx"], g1["jc"]))
            ok("EAST: panel top12 + e handle still hit", await page.evaluate(PTOP) == 12 and await page.evaluate(HIT, "live-resize-e"))
            # undo/redo
            await page.locator('[data-testid="live-undo"]').click(timeout=5000); await page.wait_for_timeout(500); gu = await page.evaluate(GEOM, tid)
            ok("undo restores original l/r", abs(gu["l"] - g0["l"]) <= 2 and abs(gu["r"] - g0["r"]) <= 2, (gu["l"], gu["r"]))
            await page.locator('[data-testid="live-redo"]').click(timeout=5000); await page.wait_for_timeout(500); gr = await page.evaluate(GEOM, tid)
            ok("redo restores east result", abs(gr["l"] - g1["l"]) <= 2 and abs(gr["r"] - g1["r"]) <= 2 and aligned(gr), (gr["l"], gr["r"]))
            await page.locator('[data-testid="live-undo"]').click(timeout=5000); await page.wait_for_timeout(500)
            # WEST -50
            gw0 = await page.evaluate(GEOM, tid)
            ok("west handle hit before west drag", await page.evaluate(HIT, "live-resize-w"))
            await drag(page, "live-resize-w", -50); g2 = await page.evaluate(GEOM, tid); print("west", g2)
            ok("WEST -50: right edge fixed (<=2px)", abs(g2["r"] - gw0["r"]) <= 2, (gw0["r"], g2["r"]))
            ok("WEST -50: left edge -50 (+-2px)", abs((g2["l"] - gw0["l"]) + 50) <= 2, g2["l"] - gw0["l"])
            ok("WEST: text/arrow gap+centre single line", aligned(g2), (g2["gap"], g2["vc"], g2["lines"], g2["cx"]))
            await page.locator('[data-testid="live-undo"]').click(timeout=5000); await page.wait_for_timeout(500); gu2 = await page.evaluate(GEOM, tid)
            ok("undo after west restores", abs(gu2["l"] - g0["l"]) <= 2 and abs(gu2["r"] - g0["r"]) <= 2, (gu2["l"], gu2["r"]))
            await page.locator('[data-testid="live-redo"]').click(timeout=5000); await page.wait_for_timeout(500); gr2 = await page.evaluate(GEOM, tid)
            ok("redo after west", abs(gr2["r"] - g2["r"]) <= 2 and abs(gr2["l"] - g2["l"]) <= 2, (gr2["l"], gr2["r"]))
            ok("panel top12 at end", await page.evaluate(PTOP) == 12)
            # SectionStyle effect: open Ambition section to exercise ResizeObserver, wait
            await page.goto(BASE + "/our-work/rakhigarhi?edit=1"); await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=50000); await page.wait_for_timeout(1500)
            await page.evaluate("document.querySelector('#the-ambition .stacked').scrollIntoView({block:'end'})"); await page.wait_for_timeout(800)
            bb = await page.locator("#the-ambition .stacked").first.bounding_box(); await page.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] - 60); await page.wait_for_timeout(800)
            for vw in (1280, 390, 1920): await page.set_viewport_size({"width": vw, "height": 1000}); await page.wait_for_timeout(700)
            ok("sec pad inputs present", await page.locator('[data-testid="live-sec-pad-top"]').count() == 1)
        except Exception as e:
            ok("EXCEPTION", False, repr(e)[:400])
        bad = [c for c in CONS if "ResizeObserver" in c or "React" in c or "Warning:" in c or "Maximum update" in c]
        ok("no ResizeObserver loop / React errors / pageerrors", not bad and not errs, (bad[:5], errs[:5]))
        print("console err/warn sample:", CONS[:8]); print("blocked writes:", BLOCKED); await b.close()
    print(f"TOTAL {sum(r for _, r in RES)}/{len(RES)}; FAILS:", [n for n, r in RES if not r])
asyncio.run(main())
