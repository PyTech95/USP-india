# Iteration 31: laptop layout fidelity - current page vs SAME page with responsive.css @layer responsive disabled in-browser (transient, no source change).
# Read-only: fixture replay (preview/prod), GET only, all non-GET aborted.
# Usage in browser_automation: g={}; exec(open('/app/tests/iter31_laptop_fidelity.py').read(), g); await g['run'](page, ['preview'], [1280], None)
import json, os
_g = {}
exec(open("/app/tests/iter28_sweep.py").read(), _g)
BASE, make_handler, ROUTES = _g["BASE"], _g["make_handler"], _g["ROUTES"]
OUT = "/app/test_reports/iter31_fidelity.json"

TOGGLE_JS = r"""(off) => {
  const hits = [];
  for (const s of document.styleSheets) {
    let rules; try { rules = s.cssRules; } catch (e) { continue; }
    if ([...rules].some((r) => r.constructor.name === 'CSSLayerBlockRule' && r.name === 'responsive')) { s.disabled = !!off; hits.push(s.ownerNode && s.ownerNode.tagName); }
  }
  return hits;
}"""

FP_JS = r"""() => {
  const root = document.querySelector('#public-site') || document.body;
  const els = [...root.querySelectorAll('*')].filter((e) => !e.closest('.live-ui') && !['SCRIPT','STYLE','SOURCE','PATH','svg'].includes(e.tagName));
  const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)]; };
  return els.map((e) => { const cs = getComputedStyle(e);
    return {k: e.dataset.testid || (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')),
      b: r(e), d: cs.display, g: cs.gridTemplateColumns, fs: cs.fontSize, m: cs.margin, p: cs.padding, pos: cs.position,
      band: !!e.closest('main [data-boxed-band]'), vis: cs.display !== 'none' && cs.visibility !== 'hidden' && e.getClientRects().length > 0}; });
}"""

KEY_JS = r"""() => {
  const q = (s) => document.querySelector(s); const R = (e) => e && (() => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)]; })();
  const cs = (s, p) => { const e = q(s); return e ? getComputedStyle(e)[p] : null; };
  return {mq: {hover: matchMedia('(hover: hover)').matches, fine: matchMedia('(pointer: fine)').matches, desk961: matchMedia('(min-width: 961px) and (hover: hover) and (pointer: fine)').matches},
    toggle: cs('#site-header .menu-toggle', 'display'), navList: cs('#site-header .nav-list', 'display'), navListBox: R(q('#site-header .nav-list')),
    hfnHead: R(q('.hfn .hfn-head')), hfnHeadCols: cs('.hfn .hfn-head', 'gridTemplateColumns'), hfnFeature: R(q('.hfn .hfn-feature')), hfnFeatM: cs('.hfn .hfn-feature', 'margin'),
    hfnCards: cs('.hfn .hfn-cards', 'gridTemplateColumns'), fnInner: cs('[data-testid="page-field-notes"] .ps-plain-inner', 'gridTemplateColumns'),
    craftCopyPos: cs('#craft-reference .craft-hero-copy', 'position'), theatreFig: cs('#theatre-reference .theatre-split figure.theatre-split-art', 'position'),
    pcc: cs('.pcc-grid', 'gridTemplateColumns'), docW: document.documentElement.scrollWidth, vw: innerWidth, dock: !!q('.live-ui')};
}"""


def diff(a, b):
    out, band = [], 0
    if len(a) != len(b):
        return {"lenMismatch": [len(a), len(b)]}
    for x, y in zip(a, b):
        if not (x["vis"] or y["vis"]): continue
        ch = [f for f in ("b", "d", "g", "fs", "m", "p", "pos") if x[f] != y[f]]
        if f"vis" and x["vis"] != y["vis"]: ch.append("vis")
        if ch:
            if x["band"] or y["band"]: band += 1; continue
            out.append({"k": x["k"], "ch": ch, "cur": {f: x[f] for f in ch if f != "vis"}, "ref": {f: y[f] for f in ch if f != "vis"}})
    return {"nonBandDiffN": len(out), "bandDiffN": band, "sample": out[:12]}


async def run(page, modes, widths, routes=None, height=900):
    out = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for mode in modes:
        await page.unroute("**/api/**")
        await page.route("**/api/**", make_handler(mode))
        for w in widths:
            await page.set_viewport_size({"width": w, "height": height})
            for r in routes or ROUTES:
                k = f"{mode}/{w}{r}"
                try:
                    await page.goto(BASE + r, wait_until="networkidle", timeout=45000)
                    await page.wait_for_timeout(800)
                    cur_key = await page.evaluate(KEY_JS); cur = await page.evaluate(FP_JS)
                    hits = await page.evaluate(TOGGLE_JS, True); await page.wait_for_timeout(250)
                    ref_key = await page.evaluate(KEY_JS); ref = await page.evaluate(FP_JS)
                    await page.evaluate(TOGGLE_JS, False)
                    d = diff(cur, ref)
                    kd = {kk: [cur_key[kk], ref_key[kk]] for kk in cur_key if cur_key[kk] != ref_key[kk]}
                    out[k] = {"sheets": hits, "key": cur_key, "keyDiff": kd, **d}
                    print(k, "sheets", hits, "mq", cur_key["mq"], "toggle", cur_key["toggle"], "hfnCols", cur_key["hfnHeadCols"], "fn", cur_key["fnInner"],
                          "| keyDiff", kd, "| nonBand", d.get("nonBandDiffN"), "band", d.get("bandDiffN"), d.get("lenMismatch", ""))
                    for s in d.get("sample", [])[:5]: print("    ", s)
                except Exception as e:
                    out[k] = {"error": str(e)[:300]}; print(k, "ERROR", str(e)[:200])
    json.dump(out, open(OUT, "w"), indent=0)
    return out
