# Iter19 read-only probe: Ambition mobile (390) overflow chain on REAL public rakhigarhi page (no writes)
import asyncio, os, json
from playwright.async_api import async_playwright
from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
JS = """() => { const w=document.querySelector('#the-ambition'); const wb=w.getBoundingClientRect().bottom; const ps=[...w.querySelectorAll('p')]; const last=ps[ps.length-1];
 const chain=[]; for(let e=last;e&&e!==w.parentElement;e=e.parentElement){const r=e.getBoundingClientRect(), c=getComputedStyle(e); chain.push([e.tagName+'.'+String(e.className).slice(0,30)+'[' + (e.dataset.edit||'')+']', Math.round(r.top), Math.round(r.bottom), Math.round(r.height), c.height, c.minHeight, c.maxHeight, c.overflow, c.transform.slice(0,30), c.paddingBottom, e.getAttribute('style')]);}
 return {wb:Math.round(wb), chain} }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for vw in (390, 768):
            pg = await b.new_page(viewport={"width": vw, "height": 844}); await pg.goto(BASE + "/our-work/rakhigarhi"); await pg.wait_for_selector("#the-ambition"); await pg.wait_for_timeout(1500)
            print(vw, json.dumps(await pg.evaluate(JS)))
        await b.close()
asyncio.run(main())
