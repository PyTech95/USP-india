# Probe: empty note cover caption shows 'Add a caption' placeholder in live editor and can be re-filled
import asyncio, sys
from playwright.async_api import async_playwright
BASE = "https://launch-pad-462.preview.emergentagent.com"
NOTE = "/field-notes/what-the-haveli-reveals"
CAP = '[data-testid="note-cover-caption"]'
TEXT = sys.argv[1] if len(sys.argv) > 1 else None

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
        await page.goto(BASE + NOTE + "?edit=1")
        await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(2500)
        info = await page.evaluate("""() => { const c=document.querySelector('[data-testid=note-cover-caption]'); if(!c) return null; const s=c.querySelector('span');
          return {cls:c.className, disp:getComputedStyle(c).display, rect:c.getBoundingClientRect().height, before:getComputedStyle(s,'::before').content, sdisp:getComputedStyle(s).display, srect:s.getBoundingClientRect().toJSON(), body:document.body.className, text:c.innerText}; }""")
        print("editor caption:", info)
        await page.locator(CAP).first.evaluate("e=>e.scrollIntoView({block:'center'})"); await page.wait_for_timeout(400)
        await page.screenshot(path="/tmp/cap_probe_editor.jpeg", quality=40)
        if TEXT and info:
            span = page.locator(CAP + " span").first
            await span.click(); await page.wait_for_timeout(500)
            print("editable:", await span.evaluate("e=>e.isContentEditable"))
            await page.keyboard.press("Control+A"); await page.keyboard.press("Delete")
            await page.keyboard.type(TEXT); await page.wait_for_timeout(400)
            await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
            await page.click('[data-testid="live-save-btn"]'); await page.wait_for_timeout(2500)
            print("status:", await page.locator('[data-testid="live-status"]').text_content())
        await b.close()

asyncio.run(main())
