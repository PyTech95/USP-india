# Playwright check: homepage Our Work card parts (number row, category, title, text, explore label) movable in live editor + persist
import asyncio, sys
from playwright.async_api import async_playwright
BASE = "https://launch-pad-462.preview.emergentagent.com"
W = int(sys.argv[1]) if len(sys.argv) > 1 else 1440
SAVE = (sys.argv[2] if len(sys.argv) > 2 else "save") == "save"
PARTS = ["number-row", "category", "title", "description", "explore-label"]
CARDS = [0, 1]

JS = """(ids) => { const o = {}; for (const id of ids) { const e = document.querySelector('[data-testid="'+id+'"]'); if (!e) { o[id] = null; continue; } const r = e.getBoundingClientRect(); o[id] = {x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width)}; }
 for (const k of [0,1]) { const a = document.querySelector('[data-testid="work-item-'+k+'-explore"] svg'); if (a) { const r = a.getBoundingClientRect(); o['arrow-'+k] = {x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width)}; } }
 o.h3tr = Array.from(document.querySelectorAll('.hb-related_work .work-card .h3')).slice(0,2).map(h => getComputedStyle(h).transform + '|' + h.className).join(' ; ');
 o.sw = document.documentElement.scrollWidth; o.cw = document.documentElement.clientWidth; return o; }"""
IDS = [f"work-item-{k}-{p}" for k in CARDS for p in PARTS]

async def settle(pg):
    # wait for scroll-reveal transforms on cards/titles to finish before measuring
    await pg.locator('[data-testid="work-item-0"]').evaluate("e => e.scrollIntoView({block:'center'})")
    try:
        await pg.wait_for_function("() => Array.from(document.querySelectorAll('.hb-related_work .work-card, .hb-related_work .work-card .h3')).every(e => getComputedStyle(e).transform === 'none')", timeout=10000)
    except Exception as ex:
        print("settle timeout", ex)
    await pg.wait_for_timeout(300)

async def drag_grip(page, dx, dy):
    g = await page.locator('[data-testid="live-move-grip"]').bounding_box()
    sx, sy = g["x"] + g["width"] / 2, g["y"] + g["height"] / 2
    await page.mouse.move(sx, sy); await page.mouse.down()
    for i in range(1, 11):
        await page.mouse.move(sx + dx * i / 10, sy + dy * i / 10); await page.wait_for_timeout(25)
    await page.mouse.up(); await page.wait_for_timeout(400)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": W, "height": 1000})
        page = await ctx.new_page()
        await page.goto(BASE + "/admin/login")
        await page.fill('[data-testid="login-email"]', "admin@uspindia.org")
        await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
        await page.click('[data-testid="login-submit"]')
        await page.wait_for_url("**/admin**", timeout=15000); await page.wait_for_timeout(1200)
        await page.goto(BASE + "/?edit=1")
        await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(1500)
        start_url = page.url
        await settle(page); before = await page.evaluate(JS, IDS)
        results = {}
        for k in CARDS:
            for part in PARTS:
                tid = f"work-item-{k}-{part}"
                el = page.locator(f'[data-testid="{tid}"]')
                await el.evaluate("e => e.scrollIntoView({block:'center'})"); await page.wait_for_timeout(250)
                await el.click(); await page.wait_for_timeout(500)
                nav_ok = page.url == start_url
                sel = await page.locator('[data-testid="live-selection-box"]').count()
                label = await page.locator('[data-testid="live-selected-label"]').text_content() if await page.locator('[data-testid="live-selected-label"]').count() else None
                b0 = await page.evaluate(JS, IDS)
                if sel:
                    await drag_grip(page, 60, 20)
                b1 = await page.evaluate(JS, IDS)
                dx = b1[tid]["x"] - b0[tid]["x"]; dy = b1[tid]["y"] - b0[tid]["y"]
                extra = ""
                if part == "explore-label":
                    ax = b1[f"arrow-{k}"]["x"] - b0[f"arrow-{k}"]["x"]; ay = b1[f"arrow-{k}"]["y"] - b0[f"arrow-{k}"]["y"]
                    extra = f" arrow d=({ax},{ay})"
                # did siblings move unexpectedly?
                others = [i for i in IDS if i != tid and (abs(b1[i]["x"] - b0[i]["x"]) > 2 or abs(b1[i]["y"] - b0[i]["y"]) > 2)]
                results[tid] = (dx, dy)
                print(f"{tid}: url_ok={nav_ok} selected={bool(sel)} label={label!r} moved=({dx},{dy}){extra} others_moved={others}")
                await page.keyboard.press("Escape"); await page.wait_for_timeout(200)
        # number text editing (then undo)
        nr = page.locator('[data-testid="work-item-0-number"]')
        await nr.click(); await page.wait_for_timeout(400)
        await page.keyboard.press("End"); await page.keyboard.type("9"); await page.wait_for_timeout(400)
        print("number after typing:", await nr.text_content(), "status:", await page.locator('[data-testid="live-status"]').text_content())
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        await page.click('[data-testid="live-undo"]'); await page.wait_for_timeout(500)
        print("number after undo:", await nr.text_content())
        await page.screenshot(path=f"/tmp/wc_ed_{W}.jpeg", quality=40)
        if SAVE:
            # put typed number back if undo didn't
            ed = await page.evaluate(JS, IDS)
            await page.click('[data-testid="live-save-btn"]')
            await page.wait_for_function("() => document.querySelector('[data-testid=live-status]')?.textContent.includes('Everything is saved')", timeout=15000)
            await page.wait_for_timeout(800)
            await settle(page); ed = await page.evaluate(JS, IDS)
            await page.click('[data-testid="live-exit-btn"]'); await page.wait_for_timeout(1800)
            await settle(page); closed = await page.evaluate(JS, IDS)
            await page.reload(); await page.wait_for_timeout(2500)
            await settle(page); rel = await page.evaluate(JS, IDS)
            ctx2 = await b.new_context(viewport={"width": W, "height": 1000})
            p2 = await ctx2.new_page(); await p2.goto(BASE + "/"); await p2.wait_for_timeout(3000)
            await settle(p2); pub = await p2.evaluate(JS, IDS)
            await p2.locator('[data-testid="work-item-0"]').scroll_into_view_if_needed(); await p2.wait_for_timeout(800)
            await p2.screenshot(path=f"/tmp/wc_pub_{W}.jpeg", quality=40)
            print("number text public:", await p2.locator('[data-testid="work-item-0-number"]').text_content())
            for tid in IDS + ["arrow-0", "arrow-1"]:
                diffs = [(n, s[tid]["x"] - ed[tid]["x"], s[tid]["y"] - ed[tid]["y"]) for n, s in (("closed", closed), ("reload", rel), ("public", pub))]
                bad = [d for d in diffs if abs(d[1]) > 2 or abs(d[2]) > 2]
                moved = (ed[tid]["x"] - before[tid]["x"], ed[tid]["y"] - before[tid]["y"])
                print(f"PERSIST {tid}: moved_vs_orig={moved} {'PASS' if not bad else 'FAIL ' + str(bad)}")
            print("scroll public", pub["sw"], pub["cw"])
            for n, st in (("ed", ed), ("closed", closed), ("reload", rel), ("public", pub)): print("h3", n, st["h3tr"])
        await b.close()
asyncio.run(main())
