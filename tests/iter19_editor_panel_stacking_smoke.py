# Iter19 NO-WRITE editor smoke: LiveEditor / Header editor / Site text panel pinning + stacking on every public page (all non-GET blocked)
import asyncio, os, json
from playwright.async_api import async_playwright
from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
PATHS = ["/", "/about", "/our-work", "/our-work/rakhigarhi", "/our-work/theatre", "/our-work/craft-livelihood", "/our-work/workshops-learning", "/field-notes", "/connect", "/blog"]
RES, BLOCKED = [], []
def ok(n, c, info=""): RES.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n, info)
HIT = """(sel) => { const el=document.querySelector(sel); if(!el) return null; const r=el.getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2, r.top+Math.min(r.height/2,12));
  return {top:Math.round(r.top), h:Math.round(r.height), hit: !!e && el.contains(e), by: e && (e.id||e.dataset.testid||String(e.className).slice(0,40))} }"""
PANEL_OK = "[data-testid=live-editor-panel]"
async def chk(page, tag):
    if os.environ.get("INJECT") and not await page.evaluate("!!document.getElementById('t1-inject')"):
        await page.add_style_tag(content=os.environ["INJECT"]); await page.evaluate("document.querySelector('style:last-of-type').id='t1-inject'"); await page.wait_for_timeout(200)
    p = await page.evaluate(HIT, PANEL_OK); s = await page.evaluate(HIT, "[data-testid=live-save-btn]"); x = await page.evaluate(HIT, "[data-testid=live-exit-btn]")
    ok(f"{tag} panel top12, save+close hit", p and p["top"] == 12 and s["hit"] and x["hit"], (p, s and s["by"], x and x["by"]))
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(); ctx = await b.new_context(viewport={"width": 1920, "height": 1080})
        async def block(route):
            if route.request.method != "GET" and "/auth/" not in route.request.url: BLOCKED.append(route.request.url); return await route.abort()
            await route.continue_()
        await ctx.route("**/api/**", block)
        page = await ctx.new_page(); page.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await page.goto(BASE + "/admin/login"); await page.fill('[data-testid="login-email"]', "admin@uspindia.org"); await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
        await page.click('[data-testid="login-submit"]'); await page.wait_for_url(lambda u: "/admin" in u and "/login" not in u, timeout=20000)
        for path in PATHS:
            try:
                await page.goto(BASE + path + "?edit=1"); await page.wait_for_selector(PANEL_OK, timeout=25000); await page.wait_for_timeout(1500)
                await chk(page, f"{path} load")
                img = page.locator("main [data-edit$='image'], main [data-edit*='image'] img, main .photo[data-edit]").first
                if await img.count():
                    await img.scroll_into_view_if_needed(); await img.click(force=True); await page.wait_for_timeout(700)
                    await chk(page, f"{path} image selected")
                    crop = await page.evaluate("()=>{const c=document.querySelector('[data-testid=live-crop-pan]'); return c?getComputedStyle(c).zIndex:null}")
                    print("  crop z", crop)
                await page.evaluate("scrollTo(0, document.body.scrollHeight/2)"); await page.wait_for_timeout(400); await chk(page, f"{path} mid-scroll")
                await page.evaluate("()=>{const p=document.querySelector('[data-testid=live-editor-panel]'); p.scrollTop=p.scrollHeight}"); await page.wait_for_timeout(300); await chk(page, f"{path} inspector scrolled")
            except Exception as e:
                ok(f"{path} exception", False, repr(e)[:300])
        # Home: header editor, site text, add-section menu, media picker, mobile
        await page.goto(BASE + "/?edit=1"); await page.wait_for_selector(PANEL_OK, timeout=25000); await page.wait_for_timeout(1500)
        try:
            await page.locator('[data-testid="live-header-toggle"]').dispatch_event("click"); await page.wait_for_timeout(800)
            h = await page.evaluate(HIT, "[data-testid=live-header-panel]"); c = await page.evaluate(HIT, "[data-testid=header-editor-close]"); sv = await page.evaluate(HIT, "[data-testid=header-editor-save]")
            ok("Header editor panel top & close/save hit", h and h["top"] <= 12 and c["hit"] and (sv is None or sv["hit"]), (h, c, sv))
            await page.locator('[data-testid="header-editor-close"]').dispatch_event("click"); await page.wait_for_timeout(500)
            await page.locator('[data-testid="live-site-toggle"]').dispatch_event("click"); await page.wait_for_timeout(800)
            s = await page.evaluate(HIT, "[data-testid=live-site-panel]"); sc = await page.evaluate(HIT, "[data-testid=live-site-close]")
            ok("Site text panel top & close hit", s and s["top"] <= 12 and sc["hit"], (s, sc))
            await page.locator('[data-testid="live-site-close"]').dispatch_event("click"); await page.wait_for_timeout(400)
            await page.locator('[data-testid="live-add-section"]').first.dispatch_event("click"); await page.wait_for_timeout(600)
            m = await page.evaluate(HIT, "[data-testid=live-add-menu]"); ok("Add-section menu above panel", m and m["hit"], m)
            if await page.locator('[data-testid="live-add-close"]').count(): await page.locator('[data-testid="live-add-close"]').dispatch_event("click"); await page.wait_for_timeout(300)
            img = page.locator("main [data-edit$='image']").first; await img.scroll_into_view_if_needed(); await img.click(force=True); await page.wait_for_timeout(600)
            await page.locator('[data-testid="live-choose-image"]').dispatch_event("click"); await page.wait_for_timeout(1200)
            d = await page.evaluate(HIT, "[data-testid=media-picker-dialog]"); ok("Image picker dialog above panel", d and d["hit"], d)
            await page.keyboard.press("Escape"); await page.wait_for_timeout(400)
            for vw, vh in ((768, 1024), (390, 844)):
                await page.set_viewport_size({"width": vw, "height": vh}); await page.wait_for_timeout(700); await chk(page, f"/ mobile {vw}")
            await page.screenshot(path="/app/.screenshots/iter19_panel_390.jpg", quality=40)
        except Exception as e:
            ok("home extras exception", False, repr(e)[:300])
        print("blocked writes:", BLOCKED); await b.close()
    print(f"TOTAL {sum(r for _, r in RES)}/{len(RES)}; FAILS:", [n for n, r in RES if not r])
asyncio.run(main())
