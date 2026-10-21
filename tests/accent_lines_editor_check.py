# Live editor: Edit Header > Style > Red lines (whole site) fields update lines live, persist on save, reset to defaults
import asyncio, json
from playwright.async_api import async_playwright
BASE = "https://launch-pad-462.preview.emergentagent.com"
R = {}
def rec(k, ok, info=""): R[k] = ok; print(("PASS " if ok else "FAIL ") + k, info)

PROBE = """() => { const q = (s, ps) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e, ps); return [c.width, c.height, ps === '::after' ? c.marginTop : c.marginBottom]; };
  const ab = document.querySelector('#rakhigarhi-reference #the-ambition .eyebrow') || document.querySelector('[data-testid=block-8] .eyebrow');
  const asd = document.querySelector('[data-testid=block-1-aside]') || document.querySelector('#rakhigarhi-reference .aside-statement');
  return {eyebrow: ab ? [getComputedStyle(ab,'::after').width, getComputedStyle(ab,'::after').height, getComputedStyle(ab,'::after').marginTop] : null,
          hero: q('#rakhigarhi-reference .rak-hero-copy', '::before'),
          vertical: asd ? getComputedStyle(asd, '::after').width : null,
          vars: getComputedStyle(document.querySelector('#public-site')).getPropertyValue('--accent-line-w') + '|' + getComputedStyle(document.querySelector('#public-site')).getPropertyValue('--accent-line') + '|' + getComputedStyle(document.querySelector('#public-site')).getPropertyValue('--accent-line-gap')}; }"""

async def set_vals(page, w, t, g):
    for tid, v in (("header-style-accent-line-width", w), ("header-style-accent-line-thickness", t), ("header-style-accent-line-gap", g)):
        el = page.locator(f'[data-testid="{tid}"]')
        await el.scroll_into_view_if_needed(); await el.fill(v); await page.wait_for_timeout(150)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1920, "height": 1080})
        page = await ctx.new_page()
        await page.goto(BASE + "/admin/login")
        await page.fill('[data-testid="login-email"]', "admin@uspindia.org")
        await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
        await page.click('[data-testid="login-submit"]')
        await page.wait_for_url("**/admin**", timeout=15000); await page.wait_for_timeout(1200)
        await page.goto(BASE + "/our-work/rakhigarhi?edit=1")
        await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(2500)
        before = await page.evaluate(PROBE); print("before", before)
        await page.click('[data-testid="live-header-toggle"]'); await page.wait_for_selector('[data-testid="live-header-panel"]', timeout=10000)
        await page.click('[data-testid="header-tab-style"]'); await page.wait_for_timeout(500)
        toggle = page.locator('[data-testid="header-lines-toggle"]')
        rec("red lines group present", await toggle.count() == 1 and "Red lines (whole site)" in (await toggle.inner_text()))
        for tid in ("header-style-accent-line-width", "header-style-accent-line-thickness", "header-style-accent-line-gap"):
            rec(f"{tid} visible", await page.locator(f'[data-testid="{tid}"]').is_visible())
        await toggle.scroll_into_view_if_needed(); await page.screenshot(path="/tmp/lines_panel.jpeg", quality=40)
        await set_vals(page, "80", "4", "50"); await page.wait_for_timeout(600)
        live = await page.evaluate(PROBE); print("live", live)
        rec("live preview eyebrow", live["eyebrow"] == ["80px", "4px", "50px"], live["eyebrow"])
        rec("live preview hero above", live["hero"] == ["80px", "4px", "50px"], live["hero"])
        rec("live preview vertical", live["vertical"] == "4px", live["vertical"])
        resp = None
        async with page.expect_response(lambda r: "/api/admin/header-live" in r.url or "/api/admin/site-styles" in r.url, timeout=15000) as ri:
            await page.click('[data-testid="header-editor-save"]')
        resp = await ri.value
        body = await resp.json(); print("save", resp.status, resp.url, json.dumps(body)[:300])
        await page.wait_for_timeout(1500)
        rec("save 200", resp.status == 200)
        st = await page.locator('[data-testid="header-save-status"]').inner_text(); print("status", st)
        # public persistence in fresh anonymous context
        c2 = await b.new_context(viewport={"width": 1920, "height": 1080}); p2 = await c2.new_page()
        for path in ("/our-work/rakhigarhi", "/our-work/workshops-learning"):
            await p2.goto(BASE + path); await p2.wait_for_timeout(3000)
            v = await p2.evaluate("() => { const e=[...document.querySelectorAll('#public-site *')].find(x=>{const c=getComputedStyle(x,'::after'); return c.content!=='none' && c.height==='4px';}); const c=e&&getComputedStyle(e,'::after'); return c?[c.width,c.height,c.marginTop]:null; }")
            rec(f"public persisted {path}", v == ["80px", "4px", "50px"], v)
        await p2.screenshot(path="/tmp/lines_public_changed.jpeg", quality=40)
        # reset to defaults: clear values & save
        await set_vals(page, "", "", ""); await page.wait_for_timeout(500)
        async with page.expect_response(lambda r: "/api/admin/header-live" in r.url or "/api/admin/site-styles" in r.url, timeout=15000) as ri:
            await page.click('[data-testid="header-editor-save"]')
        resp = await ri.value; body = await resp.json()
        styles = body.get("header_styles") if isinstance(body, dict) else None
        print("reset save", resp.status, styles)
        rec("reset saved without accent keys", resp.status == 200 and not any(k.startswith("accentLine") for k in (styles or body.get("styles", {}) or {})))
        await p2.goto(BASE + "/our-work/rakhigarhi"); await p2.wait_for_timeout(3000)
        after = await p2.evaluate(PROBE); print("after reset public", after)
        rec("defaults restored", after["eyebrow"] == ["42px", "2px", "30px"] and after["vertical"] == "2px", after)
        print("SUMMARY", sum(R.values()), "/", len(R))
        await b.close()

asyncio.run(main())
