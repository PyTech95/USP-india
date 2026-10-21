# Probe: logged-in admin on a note without ?edit=1 — is the live editor open (body.live-editing)?
import asyncio
from playwright.async_api import async_playwright
BASE = "https://launch-pad-462.preview.emergentagent.com"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()
        await page.goto(BASE + "/admin/login")
        await page.fill('[data-testid="login-email"]', "admin@uspindia.org")
        await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
        await page.click('[data-testid="login-submit"]')
        await page.wait_for_url("**/admin**", timeout=15000); await page.wait_for_timeout(1200)
        for url in ["/field-notes/when-acceptance-comes-home", "/field-notes/what-the-haveli-reveals?edit=1", "/field-notes/when-acceptance-comes-home"]:
            await page.goto(BASE + url); await page.wait_for_timeout(3000)
            r = await page.evaluate("() => ({body: document.body.className, panel: !!document.querySelector('[data-testid=live-editor-panel]'), empties: Array.from(document.querySelectorAll('.photo-caption-empty')).map(e=>getComputedStyle(e).display), ss: JSON.stringify(Object.keys(sessionStorage)), ls: JSON.stringify(Object.keys(localStorage))})")
            print(url, r)
        await page.click('[data-testid="live-close-btn"]', timeout=5000) if await page.locator('[data-testid="live-close-btn"]').count() else None
        await page.wait_for_timeout(1000)
        print("after close:", await page.evaluate("() => ({body: document.body.className, empties: Array.from(document.querySelectorAll('.photo-caption-empty')).map(e=>getComputedStyle(e).display)})"))
        await b.close()

asyncio.run(main())
