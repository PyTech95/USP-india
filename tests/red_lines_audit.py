# Red accent line audit: every red ::before/::after line and red border on key pages; checks 42x2 / 30px gap / 2px vertical
import asyncio, sys, json
from playwright.async_api import async_playwright
BASE = "https://launch-pad-462.preview.emergentagent.com"
PAGES = ["/", "/about", "/our-work/rakhigarhi", "/our-work/theatre", "/our-work/craft-livelihood", "/our-work/workshops-learning", "/connect", "/field-notes", "/field-notes/what-the-haveli-reveals"]
W = int(sys.argv[1]) if len(sys.argv) > 1 else 1920
EXP = {"w": float(sys.argv[2]) if len(sys.argv) > 2 else 42, "h": float(sys.argv[3]) if len(sys.argv) > 3 else 2, "gap": float(sys.argv[4]) if len(sys.argv) > 4 else 30}

JS = """() => {
  const red = c => { const m = (c||'').match(/rgba?\\((\\d+), (\\d+), (\\d+)(?:, ([\\d.]+))?/); if(!m) return false; if(m[4]!==undefined && +m[4]===0) return false; return +m[1]>140 && +m[2]<110 && +m[3]<110; };
  const out = [];
  const desc = e => (e.id ? '#'+e.id : '') + '.' + String(e.className||'').split(' ').filter(Boolean).slice(0,2).join('.') + ' <' + (e.closest('section,[data-testid^=block]')?.id || e.closest('[data-testid^=block]')?.dataset.testid || '') + '>';
  for (const e of document.querySelectorAll('#public-site *')) {
    if (e.closest('#site-header, footer, .live-editor-panel')) continue;
    const r = e.getBoundingClientRect(); if (r.width === 0 && r.height === 0) continue;
    for (const ps of ['::before', '::after']) {
      const s = getComputedStyle(e, ps);
      if (s.content === 'none' || s.display === 'none') continue;
      const bg = s.backgroundColor, bt = s.borderTopColor;
      const isRed = red(bg) || (parseFloat(s.borderTopWidth) > 0 && red(bt)) || (parseFloat(s.borderLeftWidth) > 0 && red(s.borderLeftColor));
      if (!isRed) continue;
      out.push({el: desc(e), ps, w: s.width, h: s.height, mt: s.marginTop, mb: s.marginBottom, pos: s.position, top: s.top, bottom: s.bottom, bl: s.borderLeftWidth, bt: s.borderTopWidth, disp: s.display, text: (e.innerText||'').slice(0,30)});
    }
    const s = getComputedStyle(e);
    for (const side of ['Left', 'Right', 'Top', 'Bottom']) {
      const bw = parseFloat(s['border'+side+'Width']);
      if (bw > 0 && s['border'+side+'Style'] !== 'none' && red(s['border'+side+'Color']) && !e.matches('a,button,input,textarea,select'))
        out.push({el: desc(e), border: side, bw, h: r.height, w: r.width, text: (e.innerText||'').slice(0,30)});
    }
  }
  return out;
}"""

async def main():
    fails = 0
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": W, "height": 1000})
        pg = await ctx.new_page()
        for path in PAGES:
            await pg.goto(BASE + path); await pg.wait_for_selector('#public-site', timeout=20000); await pg.wait_for_timeout(2500)
            await pg.evaluate("async () => { for (let y=0; y<document.body.scrollHeight; y+=700) { window.scrollTo(0,y); await new Promise(r=>setTimeout(r,60)); } window.scrollTo(0,0); }")
            await pg.wait_for_timeout(1500)
            items = await pg.evaluate(JS)
            print(f"== {path} @ {W}: {len(items)} red items")
            for it in items:
                ok = True
                if "ps" in it:
                    w, h = float(it["w"].replace("px","") or 0) if it["w"].endswith("px") else -1, float(it["h"].replace("px","")) if it["h"].endswith("px") else -1
                    vertical = h > w
                    if vertical: ok = abs(w - EXP["h"]) < .6 or abs(float(it["bl"].replace('px','')) - EXP["h"]) < .6
                    else:
                        gap = float(it["mt"].replace("px","")) if it["ps"] == "::after" else float(it["mb"].replace("px",""))
                        ok = abs(w - EXP["w"]) < .6 and abs(h - EXP["h"]) < .6 and (abs(gap - EXP["gap"]) < .6 or it["pos"] == "absolute")
                else:
                    if it["border"] in ("Left", "Right"): ok = abs(it["bw"] - EXP["h"]) < .6
                    else: ok = abs(it["bw"] - EXP["h"]) < .6
                fails += 0 if ok else 1
                print(("  OK  " if ok else "  BAD "), json.dumps(it))
        await b.close()
    print("BAD COUNT", fails)

asyncio.run(main())
