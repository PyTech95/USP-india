# Iteration 32: read-only RCA of the Connect white-card internal scrollbar + temporary CSS candidate check.
# GET fixtures only (no production calls: non-fixture /api GETs go to preview, every non-GET aborted).
# Usage in browser_automation: g={}; exec(open('/app/tests/iter32_contact_scroll.py').read(), g); await g['run'](page)
import json, os, re

FIX = "/app/test_reports/responsive_fixtures"
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].rstrip("/")
OUT = "/app/test_reports/iter32_contact_scroll.json"

CONTACT_CSS = """@layer responsive {
  body:not(.live-editing) #public-site .pcc-card[style*="--ed-h"] {
    height: auto !important; min-height: var(--ed-h) !important; overflow: visible !important;
    margin-bottom: max(0px, var(--ed-y, 0px)) !important;
  }
}"""
# Same candidate but the desktop-only parts scoped so phone/tablet/touch keep the existing reflow.
CONTACT_CSS_SCOPED = """@layer responsive {
  body:not(.live-editing) #public-site .pcc-card[style*="--ed-h"] { height: auto !important; overflow: visible !important; }
  @media (min-width: 961px) and (hover: hover) and (pointer: fine) {
    body:not(.live-editing) #public-site .pcc-card[style*="--ed-h"] { min-height: var(--ed-h) !important; margin-bottom: max(0px, var(--ed-y, 0px)) !important; }
  }
}"""
FN_CSS = """@layer responsive {
  body:not(.live-editing) #public-site .hfn .hfn-card :is(.hfn-card-text, .hfn-card-title)[style*="--ed-w"] { max-width: 100% !important; }
}"""

PROBE = """() => {
  const c = document.querySelector('.pcc-card');
  const f = document.querySelector('#site-footer');
  const out = {docH: document.documentElement.scrollHeight, docW: document.documentElement.scrollWidth, vw: innerWidth,
               live: document.body.classList.contains('live-editing')};
  if (c) {
    const cs = getComputedStyle(c), r = c.getBoundingClientRect();
    out.card = {style: c.getAttribute('style'), clientH: c.clientHeight, scrollH: c.scrollHeight, ovY: cs.overflowY, h: cs.height,
                minH: cs.minHeight, mb: cs.marginBottom, tf: cs.transform, top: r.top + scrollY, bottom: r.bottom + scrollY, w: r.width,
                nestedScroll: c.scrollHeight > c.clientHeight + 1 && /auto|scroll/.test(cs.overflowY)};
    const form = c.querySelector('form'); if (form) { const fr = form.getBoundingClientRect(); out.formBottom = fr.bottom + scrollY; }
    const cols = c.querySelector('.pcc-grid'); if (cols) out.gridCols = getComputedStyle(cols).gridTemplateColumns;
    out.anc = []; let p = c.parentElement;
    while (p && p !== document.body) { const s = getComputedStyle(p);
      if (s.height !== 'auto' && (p.getAttribute('style') || '').includes('--ed-h') || /auto|scroll|hidden/.test(s.overflowY))
        out.anc.push({cls: (p.className || '').toString().slice(0, 60), h: s.height, ovY: s.overflowY, edh: (p.getAttribute('style') || '').includes('--ed-h')});
      p = p.parentElement; }
  }
  if (f) out.footerTop = f.getBoundingClientRect().top + scrollY;
  if (c && f) out.cardOverFooter = Math.round(out.card.bottom - out.footerTop);
  const ct = [...document.querySelectorAll('.hfn .hfn-card-text, .hfn .hfn-card-title')].map(e => e.getBoundingClientRect());
  let ov = 0; for (let i = 0; i < ct.length; i++) for (let j = i + 1; j < ct.length; j++) { const a = ct[i], b = ct[j];
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (x > 0 && y > 0) ov += x * y; }
  out.hfnTextOverlapPx2 = Math.round(ov);
  const cards = [...document.querySelectorAll('.hfn .hfn-card')];
  out.hfnCards = cards.map(cd => { const r = cd.getBoundingClientRect(), t = cd.querySelector('.hfn-card-text');
    const tr = t && t.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), tr ? Math.round(tr.width) : null, tr ? Math.round(tr.height) : null]; });
  const hc = document.querySelector('.hfn .hfn-cards'); if (hc) out.hfnCols = getComputedStyle(hc).gridTemplateColumns;
  return out;
}"""


def handler_for(mode, log):
    fx = f"{FIX}/{mode}"

    async def handler(route, request):
        if request.method != "GET":
            log.append(request.method + " " + request.url)
            return await route.abort()
        p = re.sub(r"^https?://[^/]+", "", request.url).split("?")[0]
        m = re.match(r"^/api/public/pages/([\w-]+)$", p)
        f = None
        if p == "/api/public/site": f = f"{fx}/site.json"
        elif m: f = f"{fx}/page_{m.group(1)}.json"
        elif p == "/api/public/notes": f = f"{fx}/notes.json"
        if f and os.path.exists(f):
            return await route.fulfill(status=200, content_type="application/json", body=open(f).read())
        return await route.continue_()
    return handler


async def measure(page, mode, w, route, css=None, h=900):
    await page.set_viewport_size({"width": w, "height": h})
    await page.goto(BASE + route, wait_until="networkidle", timeout=45000)
    await page.wait_for_timeout(600)
    if css: await page.add_style_tag(content=css)
    await page.wait_for_timeout(200)
    return await page.evaluate(PROBE)


async def run(page, cases=None):
    log, out = [], {}
    cases = cases or [("prod", "/connect", [1280, 1920, 1024, 390], [("base", None), ("cand", CONTACT_CSS), ("scoped", CONTACT_CSS_SCOPED)]),
                      ("preview", "/connect", [1280, 390], [("base", None), ("scoped", CONTACT_CSS_SCOPED)]),
                      ("preview", "/", [1024, 1080, 1280], [("base", None), ("fn", FN_CSS)])]
    for mode, route, widths, variants in cases:
        await page.unroute("**/api/**")
        await page.route("**/api/**", handler_for(mode, log))
        for w in widths:
            for name, css in variants:
                k = f"{mode}{route}@{w}/{name}"
                try:
                    out[k] = await measure(page, mode, w, route, css)
                    d = out[k]
                    print(k, json.dumps({x: d.get(x) for x in ["docH", "docW", "card", "formBottom", "footerTop", "cardOverFooter", "gridCols", "anc"] if route == "/connect"} or
                                        {x: d.get(x) for x in ["docW", "hfnTextOverlapPx2", "hfnCols", "hfnCards"]}))
                except Exception as e:
                    out[k] = {"error": str(e)[:300]}; print(k, "ERROR", str(e)[:200])
    out["_blocked_non_get"] = log
    json.dump(out, open(OUT, "w"), indent=0)
    return out
