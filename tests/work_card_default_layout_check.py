# Default (unmoved) Our Work card layout: left alignment of parts + no horizontal scroll at several widths
import asyncio
from playwright.async_api import async_playwright
BASE = "https://launch-pad-462.preview.emergentagent.com"
JS = """() => { const out = []; for (let k=0;k<4;k++){ const g = (s) => { const e=document.querySelector('[data-testid="work-item-'+k+'-'+s+'"]'); return e ? Math.round(e.getBoundingClientRect().left) : null; };
 const a=document.querySelector('[data-testid="work-item-'+k+'-explore"] svg'), l=document.querySelector('[data-testid="work-item-'+k+'-explore-label"]');
 const ar=a.getBoundingClientRect(), lr=l.getBoundingClientRect();
 out.push({k, num:g('number'), row:g('number-row'), cat:g('category'), title:g('title'), desc:g('description'), exp:g('explore-label'), arrowRightOfLabel: Math.round(ar.left-lr.right), arrowVsLabelMidY: Math.round((ar.top+ar.bottom)/2-(lr.top+lr.bottom)/2), styled: [...document.querySelectorAll('[data-testid^="work-item-'+k+'-"]')].filter(e => (e.getAttribute('style')||'').includes('--ed-')).length}); }
 return {cards: out, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth}; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w in (1920, 1280, 820, 390):
            ctx = await b.new_context(viewport={"width": w, "height": 900}); page = await ctx.new_page()
            await page.goto(BASE + "/"); await page.wait_for_timeout(2500)
            await page.locator('[data-testid="work-item-0"]').evaluate("e => e.scrollIntoView({block:'start'})")
            await page.wait_for_function("() => Array.from(document.querySelectorAll('.hb-related_work .work-card, .hb-related_work .work-card .h3')).every(e => getComputedStyle(e).transform === 'none')", timeout=10000)
            await page.wait_for_timeout(300)
            r = await page.evaluate(JS)
            print(f"W={w} scrollWidth={r['sw']} clientWidth={r['cw']} hscroll={'YES' if r['sw']>r['cw'] else 'no'}")
            for c in r["cards"]:
                xs = {c[k] for k in ("num", "cat", "title", "desc", "exp")}
                print("  ", c, "ALIGNED" if max(xs)-min(xs) <= 4 else "MISALIGNED")
            await page.screenshot(path=f"/tmp/def_{w}.jpeg", quality=40)
            await ctx.close()
        await b.close()
asyncio.run(main())
