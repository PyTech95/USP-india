# Playwright check: live-editor move/resize persists on public site after closing editor (desktop widths)
import asyncio, sys, json
from playwright.async_api import async_playwright
BASE = "https://launch-pad-462.preview.emergentagent.com"
W, H = int(sys.argv[1]), int(sys.argv[2])
PATH = sys.argv[3] if len(sys.argv) > 3 else "/"
FIELD = sys.argv[4] if len(sys.argv) > 4 else "tagline"
MODE = sys.argv[5] if len(sys.argv) > 5 else "move"

JS_BOX = """(f) => { const els = Array.from(document.querySelectorAll('main [data-edit="'+f+'"]')); const e = els[0]; if(!e) return null; const r = e.getBoundingClientRect(); return {x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), style: e.getAttribute('style'), sw: document.documentElement.scrollWidth}; }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": W, "height": H})
        page = await ctx.new_page()
        await page.goto(BASE + "/admin/login")
        await page.fill('[data-testid="login-email"]', "admin@uspindia.org")
        await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
        await page.click('[data-testid="login-submit"]')
        await page.wait_for_url("**/admin**", timeout=15000)
        await page.wait_for_timeout(1500)
        await page.goto(BASE + PATH + "?edit=1")
        await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000)
        await page.wait_for_timeout(1500)
        print("narrow note:", await page.locator('[data-testid="live-narrow-note"]').count())
        el = page.locator(f'main [data-edit="{FIELD}"]').first
        await el.scroll_into_view_if_needed()
        await el.click()
        await page.wait_for_selector('[data-testid="live-selection-box"]', timeout=5000)
        await page.wait_for_timeout(400)
        before = await page.evaluate(JS_BOX, FIELD)
        print("editor before:", before)
        if MODE == "move":
            g = await page.locator('[data-testid="live-move-grip"]').bounding_box()
            sx, sy = g["x"] + g["width"] / 2, g["y"] + g["height"] / 2
            await page.mouse.move(sx, sy); await page.mouse.down()
            for i in range(1, 11):
                await page.mouse.move(sx + 25 * i, sy + 3 * i)
                await page.wait_for_timeout(30)
            await page.mouse.up()
        else:
            g = await page.locator('[data-testid="live-resize-e"]').bounding_box()
            sx, sy = g["x"] + g["width"] / 2, g["y"] + g["height"] / 2
            await page.mouse.move(sx, sy); await page.mouse.down()
            for i in range(1, 11):
                await page.mouse.move(sx + 15 * i, sy)
                await page.wait_for_timeout(30)
            await page.mouse.up()
        await page.wait_for_timeout(500)
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(300)
        await page.click('[data-testid="live-save-btn"]')
        await page.wait_for_function("() => document.querySelector('[data-testid=live-status]')?.textContent.includes('Everything is saved')", timeout=15000)
        await page.wait_for_timeout(800)
        ed = await page.evaluate(JS_BOX, FIELD)
        print("editor after save:", ed)
        await page.screenshot(path=f"/tmp/ed_{W}_{FIELD}.jpeg", quality=40)
        await page.click('[data-testid="live-exit-btn"]')
        await page.wait_for_timeout(1500)
        closed = await page.evaluate(JS_BOX, FIELD)
        print("after close (same tab):", closed, "url", page.url)
        await page.reload(); await page.wait_for_timeout(2500)
        rel = await page.evaluate(JS_BOX, FIELD)
        print("after reload logged in:", rel)
        ctx2 = await b.new_context(viewport={"width": W, "height": H})
        p2 = await ctx2.new_page()
        await p2.goto(BASE + PATH); await p2.wait_for_timeout(3000)
        pub = await p2.evaluate(JS_BOX, FIELD)
        print("public logged out:", pub)
        await p2.screenshot(path=f"/tmp/pub_{W}_{FIELD}.jpeg", quality=40)
        moved = abs(ed["x"] - before["x"]) + abs(ed["w"] - before["w"])
        ok = all(abs(ed[k] - o[k]) <= 2 for o in (closed, rel, pub) for k in ("x", "y", "w"))
        print(f"RESULT {W}x{H} {PATH} {FIELD} {MODE}: changed_in_editor={moved} persisted={'PASS' if ok and moved > 20 else 'FAIL'}")
        await b.close()
asyncio.run(main())
