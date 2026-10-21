# Iteration 27: read-only desktop baseline (1440/1920) of all 8 public routes, fixture replay (prod/preview).
# Body is executed by browser_automation (has `page`); MODES env picks fixture sets. GET only, non-GET aborted.
import json, os, re

FIX = "/app/test_reports/responsive_fixtures"
PROD = "https://launch-pad-462.emergent.host"
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].rstrip("/")
PROBE = open("/app/tests/responsive_baseline_probe.js").read()
ROUTES = {"/": "home", "/about": "about", "/our-work/rakhigarhi": "rakhigarhi", "/our-work/theatre": "theatre",
          "/our-work/craft-livelihood": "craft-livelihood", "/our-work/workshops-learning": "workshops-learning",
          "/field-notes": "field-notes", "/connect": "connect"}
EXTRA_JS = r"""(() => {
  const vw = document.documentElement.clientWidth, sy = window.scrollY;
  const r4 = (r) => [Math.round(r.left), Math.round(r.top + sy), Math.round(r.width), Math.round(r.height)];
  const oob = [];
  document.querySelectorAll('#public-site *, body *').forEach((el) => {
    if (el.closest('.live-ui')) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.left < -5000) return;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (r.right > vw + 1 || r.left < -1) {
      let p = el.parentElement, clipped = false;
      while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'clip') { clipped = true; break; } p = p.parentElement; }
      oob.push({ el: el.tagName.toLowerCase() + (el.getAttribute('data-testid') ? '[' + el.getAttribute('data-testid') + ']' : '.' + (el.className || '').toString().split(/\s+/)[0]), box: r4(r), over: Math.round(Math.max(r.right - vw, -r.left)), clipped, tf: cs.transform });
    }
  });
  let band = null;
  const hit = [...document.querySelectorAll('main *')].find((e) => /Knowledge Carried/i.test(e.textContent || '') && e.children.length === 0);
  if (hit) {
    let s = hit; const bg = (x) => getComputedStyle(x).backgroundColor;
    let banded = null; for (let p = hit; p && p.tagName !== 'MAIN'; p = p.parentElement) { if (bg(p) !== 'rgba(0, 0, 0, 0)' && !banded) banded = p; s = p; }
    const hdr = document.querySelector('header#site-header, header');
    const hero = document.querySelector('main [data-sec], main > section, main > div > section');
    const inner = (x) => x && x.firstElementChild ? r4(x.firstElementChild.getBoundingClientRect()) : null;
    band = { text: hit.textContent.trim().slice(0, 60), bandEl: banded ? banded.tagName.toLowerCase() + '.' + (banded.className || '').toString().split(/\s+/).slice(0, 2).join('.') : null,
      bandBox: banded ? r4(banded.getBoundingClientRect()) : null, bandBg: banded ? bg(banded) : null, bandTf: banded ? getComputedStyle(banded).transform : null,
      sectionBox: r4(s.getBoundingClientRect()), headerBox: hdr ? r4(hdr.getBoundingClientRect()) : null, headerInner: inner(hdr),
      heroBox: hero ? r4(hero.getBoundingClientRect()) : null, heroInner: inner(hero), vw };
  }
  return { oob: oob.slice(0, 40), oobN: oob.length, oobUnclippedN: oob.filter((o) => !o.clipped).length, band };
})()"""


async def run(page, modes):
    out = {}
    for mode in modes:
        fx = f"{FIX}/{mode}"

        async def handler(route, request, fx=fx, mode=mode):
            if request.method != "GET":
                return await route.abort()
            u = request.url
            path = u.split(BASE, 1)[-1] if u.startswith(BASE) else re.sub(r"^https?://[^/]+", "", u)
            p = path.split("?")[0]
            m = re.match(r"^/api/public/pages/([\w-]+)$", p)
            f = None
            if p == "/api/public/site": f = f"{fx}/site.json"
            elif m: f = f"{fx}/page_{m.group(1)}.json"
            elif p == "/api/public/notes": f = f"{fx}/notes.json"
            if f and os.path.exists(f):
                return await route.fulfill(status=200, content_type="application/json", body=open(f).read())
            if mode == "prod" and p.startswith("/api/"):
                return await route.continue_(url=PROD + path)
            return await route.continue_()

        await page.unroute("**/api/**")
        await page.route("**/api/**", handler)
        for w in (1440, 1920):
            await page.set_viewport_size({"width": w, "height": 1000})
            for r in ROUTES:
                k = f"{mode}/{w}{r}"
                try:
                    await page.goto(BASE + r, wait_until="networkidle", timeout=45000)
                    await page.wait_for_timeout(1200)
                    d = await page.evaluate(PROBE)
                    d.update(await page.evaluate(EXTRA_JS))
                    out[k] = d
                    print(k, "docW", d["docW"], "vw", d["vw"], "secs", len(d["sections"]), "texts", len(d["texts"]), "oob", d["oobN"], "unclipped", d["oobUnclippedN"], "band", bool(d["band"]))
                    if r == "/our-work/craft-livelihood":
                        await page.screenshot(path=f"/app/test_reports/iter27_{mode}_{w}_craft.jpg", quality=40, full_page=False)
                except Exception as e:
                    out[k] = {"error": str(e)[:300]}
                    print(k, "ERROR", e)
    return out
