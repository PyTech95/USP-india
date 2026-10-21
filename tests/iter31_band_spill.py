# Iteration 31: text/images spilling outside boxed coloured bands at laptop widths (current vs responsive layer disabled). Read-only fixture replay.
# Usage: g={}; exec(open('/app/tests/iter31_band_spill.py').read(), g); await g['run'](page, ['prod'], [1024], None)
_g = {}
exec(open("/app/tests/iter31_laptop_fidelity.py").read(), _g)
BASE, make_handler, ROUTES, TOGGLE_JS = _g["BASE"], _g["make_handler"], _g["ROUTES"], _g["TOGGLE_JS"]

SPILL_JS = r"""() => {
  const res = [];
  for (const band of document.querySelectorAll('main [data-boxed-band]')) {
    const bb = band.getBoundingClientRect(); const bg = getComputedStyle(band).backgroundColor;
    let maxOut = 0, sample = '';
    const w = document.createTreeWalker(band, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) { if (!r.width) continue; const o = Math.max(bb.left - r.left, r.right - bb.right); if (o > maxOut) { maxOut = o; sample = n.textContent.trim().slice(0, 30); } } }
    let imgOut = 0; for (const im of band.querySelectorAll('img')) { const r = im.getBoundingClientRect(); if (!r.width) continue; imgOut = Math.max(imgOut, bb.left - r.left, r.right - bb.right); }
    res.push({sec: band.dataset.sec, band: [Math.round(bb.left), Math.round(bb.right)], bg, textOut: Math.round(maxOut), sample, imgOut: Math.round(imgOut)});
  }
  return {vw: innerWidth, docW: document.documentElement.scrollWidth, res};
}"""


async def settle(p):
    h = await p.evaluate("document.documentElement.scrollHeight")
    for y in range(0, h, 700):
        await p.evaluate(f"window.scrollTo(0,{y})"); await p.wait_for_timeout(120)
    await p.evaluate("window.scrollTo(0,0)"); await p.wait_for_timeout(600)


async def run(page, modes, widths, routes=None):
    for mode in modes:
        await page.unroute("**/api/**"); await page.route("**/api/**", make_handler(mode))
        for w in widths:
            await page.set_viewport_size({"width": w, "height": 900})
            for r in routes or ROUTES:
                await page.goto(BASE + r, wait_until="networkidle", timeout=45000); await settle(page)
                cur = await page.evaluate(SPILL_JS)
                await page.evaluate(TOGGLE_JS, True); await page.wait_for_timeout(300)
                ref = await page.evaluate(SPILL_JS); await page.evaluate(TOGGLE_JS, False)
                bad = [(c["sec"][:8] if c["sec"] else None, c["band"], c["textOut"], c["sample"], c["imgOut"], "ref", f["band"], f["textOut"], f["imgOut"])
                       for c, f in zip(cur["res"], ref["res"]) if c["textOut"] > 2 or c["imgOut"] > 2]
                print(mode, w, r, "docW", cur["docW"], ref["docW"], "bands", len(cur["res"]), "SPILL" if bad else "ok", bad)
