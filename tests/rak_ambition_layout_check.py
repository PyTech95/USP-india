# Rakhigarhi 'The Ambition': p1+p2 stacked left, light 1px centre line, p3 right; single column + no h-scroll on mobile
import asyncio
from playwright.async_api import async_playwright
BASE = "https://launch-pad-462.preview.emergentagent.com"

JS = """() => { const pr = document.querySelector('#rakhigarhi-reference #the-ambition .prose'); if (!pr) return null;
  const ps = [...pr.children].filter(e => e.tagName === 'P');
  return {cols: getComputedStyle(pr).gridTemplateColumns, n: ps.length, prose: pr.getBoundingClientRect().toJSON(),
    ps: ps.map(p => { const r = p.getBoundingClientRect(), s = getComputedStyle(p); return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bl: s.borderLeftWidth + ' ' + s.borderLeftColor, bt: s.borderTopWidth + ' ' + s.borderTopColor, txt: p.innerText.slice(0, 40)}; }),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth}; }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w in (1920, 1280, 768, 390):
            ctx = await b.new_context(viewport={"width": w, "height": 1000}); pg = await ctx.new_page()
            await pg.goto(BASE + "/our-work/rakhigarhi"); await pg.wait_for_timeout(2500)
            await pg.locator("#the-ambition").scroll_into_view_if_needed(); await pg.wait_for_timeout(1500)
            d = await pg.evaluate(JS)
            print(f"== {w}: cols={d['cols']} n={d['n']} scrollW={d['sw']} clientW={d['cw']}")
            for x in d["ps"]: print("   ", x)
            ps = d["ps"]
            if w >= 1024 and len(ps) == 3:
                ok = ps[0]["x"] == ps[1]["x"] and ps[1]["y"] > ps[0]["y"] and ps[2]["x"] > ps[0]["x"] + ps[0]["w"] - 5 and abs(ps[2]["y"] - ps[0]["y"]) < 3 and ps[2]["bl"].startswith("1px")
                print("  2-col layout", "PASS" if ok else "FAIL")
            if w == 390:
                ok = len(set(x["x"] for x in ps)) == 1 and d["sw"] <= d["cw"]
                print("  mobile single col / no h-scroll", "PASS" if ok else "FAIL")
            await pg.locator("#the-ambition").screenshot(path=f"/tmp/ambition_{w}.jpeg", quality=40)
            await ctx.close()
        await b.close()

asyncio.run(main())
