# Iter19 read-only probe: why does site header intercept LiveEditor panel clicks? (no writes; editor opened then closed without saving)
import asyncio, os
from playwright.async_api import async_playwright
from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
PATH = os.environ.get("PROBE_PATH", "/")
JS = """() => { const out={}; const p=document.querySelector('[data-testid=live-editor-panel]'); const h=document.getElementById('site-header');
 const chain=(el)=>{const a=[]; for(let e=el;e&&e!==document.documentElement;e=e.parentElement){const c=getComputedStyle(e); if(c.zIndex!=='auto'||c.transform!=='none'||c.filter!=='none'||c.isolation==='isolate'||c.backdropFilter!=='none'&&c.backdropFilter||c.contain!=='none'||c.position==='fixed'||c.position==='sticky') a.push([e.tagName+'#'+e.id+'.'+String(e.className).slice(0,30), c.position, c.zIndex, c.transform.slice(0,20), c.isolation, c.contain]);} return a;};
 out.panel=chain(p); out.header=chain(h); const b=document.querySelector('[data-testid=live-save-btn]').getBoundingClientRect(); out.stack=document.elementsFromPoint(b.left+b.width/2,b.top+b.height/2).slice(0,5).map(e=>e.tagName+'#'+e.id+'.'+String(e.className).slice(0,25));
 out.hr=h.getBoundingClientRect().toJSON(); out.pr=p.getBoundingClientRect().toJSON(); out.bodyClass=document.body.className; out.headerParent=h.parentElement.tagName+'.'+h.parentElement.className; return out; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1920, "height": 1080})
        async def block(route):
            if route.request.method != "GET" and "/auth/" not in route.request.url: return await route.abort()
            await route.continue_()
        await ctx.route("**/api/**", block)
        page = await ctx.new_page()
        await page.goto(BASE + "/admin/login"); await page.fill('[data-testid="login-email"]', "admin@uspindia.org"); await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
        await page.click('[data-testid="login-submit"]'); await page.wait_for_url("**/admin**", timeout=15000)
        await page.goto(BASE + PATH + "?edit=1"); await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(2000)
        import json
        if os.environ.get("INJECT"): await page.add_style_tag(content=os.environ["INJECT"]); await page.wait_for_timeout(300)
        r = await page.evaluate(JS); print(json.dumps({"stack": r["stack"], "panel": r["panel"]}))
        sel = page.locator("main [data-edit$='image']").first; await sel.scroll_into_view_if_needed(); await sel.click(force=True); await page.wait_for_timeout(600)
        print("after image select", (await page.evaluate(JS))["stack"][:2])
        await page.evaluate("scrollTo(0,800)"); await page.wait_for_timeout(300); print("scrolled", (await page.evaluate(JS))["stack"][:2])
        await page.screenshot(path="/app/.screenshots/iter19_panel_header.jpg", quality=40)
        await b.close()
asyncio.run(main())
