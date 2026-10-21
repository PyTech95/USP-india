# Iteration 31: touch devices (390/768/1024/1366) keep responsive menu + no editor UI; desktop hover menu at 961/1024/1080. Read-only preview fixture replay.
# Usage: g={}; exec(open('/app/tests/iter31_touch_menu.py').read(), g); await g['main'](page, playwright)
_g = {}
exec(open("/app/tests/iter28_sweep.py").read(), _g)
BASE, make_handler = _g["BASE"], _g["make_handler"]

HIT = r"""(tid) => { const e = document.querySelector(`[data-testid="${tid}"]`); if (!e) return 'missing'; const b = e.getBoundingClientRect();
  if (!b.width) return 'zero'; const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return h && (e === h || e.contains(h)) ? 'ok' : 'covered:' + (h && (h.dataset.testid || h.className)); }"""
STATE = r"""() => ({coarse: matchMedia('(pointer: coarse)').matches, hoverNone: matchMedia('(hover: none)').matches,
  toggle: getComputedStyle(document.querySelector('[data-testid="mobile-menu-toggle"]')).display, live: document.querySelectorAll('.live-ui').length,
  edit: document.querySelectorAll('[data-testid*="live-editor"], [data-testid*="editor-dock"]').length, docW: document.documentElement.scrollWidth,
  items: [...document.querySelectorAll('[data-testid="main-menu"] > li [data-testid^="nav-"]')].map((e) => e.dataset.testid)})"""


async def touch(pw, browser):
    for (w, h, mob) in [(390, 844, True), (768, 1024, True), (1024, 1366, False), (1366, 1024, False)]:
        ctx = await browser.new_context(viewport={"width": w, "height": h}, has_touch=True, is_mobile=mob)
        p = await ctx.new_page(); await p.route("**/api/**", make_handler("preview"))
        for target in ("nav-m-notes", "nav-m-connect"):
            await p.goto(BASE + "/?edit=1", wait_until="networkidle"); await p.wait_for_timeout(600)
            s = await p.evaluate(STATE)
            await p.tap('[data-testid="mobile-menu-toggle"]'); await p.wait_for_timeout(300)
            work = [i for i in s["items"] if i.endswith("-toggle")]
            if work:
                await p.tap(f'[data-testid="{work[0]}"]'); await p.wait_for_timeout(300)
            sub = await p.evaluate("[...document.querySelectorAll('[data-testid$=\"-menu\"] a')].map(a=>a.dataset.testid)")
            el = p.locator(f'[data-testid="main-menu"] [data-testid="{target}"]').first
            await el.scroll_into_view_if_needed()
            hit = await p.evaluate(HIT, target)
            await el.tap(); await p.wait_for_timeout(700)
            print(f"TOUCH {w} coarse={s['coarse']} hoverNone={s['hoverNone']} toggle={s['toggle']} live={s['live']} edit={s['edit']} docW={s['docW']} sub={sub[:6]} {target} hit={hit} -> {p.url.replace(BASE, '')}")
        if w == 1366:
            await p.goto(BASE + "/", wait_until="networkidle"); await p.tap('[data-testid="mobile-menu-toggle"]'); await p.wait_for_timeout(300)
            await p.screenshot(path="/app/test_reports/iter31_touch1366_menu.jpg", quality=40)
        await ctx.close()


async def desktop(page):
    await page.route("**/api/**", make_handler("preview"))
    for w in (961, 1024, 1080):
        await page.set_viewport_size({"width": w, "height": 900})
        await page.goto(BASE + "/", wait_until="networkidle"); await page.wait_for_timeout(600)
        s = await page.evaluate(STATE)
        tops = [i for i in s["items"] if i.endswith("-toggle")]
        parent = tops[0].replace("-toggle", "") if tops else None
        await page.hover(f'[data-testid="{parent}"]'); await page.wait_for_timeout(400)
        menu_open = await page.locator(f'[data-testid="{parent}-menu"]').is_visible()
        links = await page.evaluate(f"[...document.querySelectorAll('[data-testid=\"{parent}-menu\"] a')].map(a=>a.dataset.testid)")
        first = links[0] if links else None
        hit = await page.evaluate(HIT, first) if first else None
        box = await page.evaluate(f"(()=>{{const b=document.querySelector('[data-testid=\"{parent}-menu\"]')?.getBoundingClientRect(); return b&&[Math.round(b.left),Math.round(b.right)]}})()")
        if first:
            await page.hover(f'[data-testid="{first}"]'); await page.wait_for_timeout(200)
            await page.click(f'[data-testid="{first}"]'); await page.wait_for_timeout(700)
        print(f"DESK {w} toggle={s['toggle']} live={s['live']} hover-open={menu_open} menuBox={box} links={links[:5]} hit={hit} -> {page.url.replace(BASE, '')}")
        await page.mouse.move(5, 500); await page.wait_for_timeout(400)
        print("   closed after leave:", not await page.locator(f'[data-testid="{parent}-menu"]').is_visible())


async def main(page, pw):
    await touch(pw, page.context.browser)
    await desktop(page)
