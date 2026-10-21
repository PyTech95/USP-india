# Iteration 28: read-only responsive sweep with fixture replay (prod/preview). GET only, every non-GET aborted (QA-only routing, app has no mocks).
# Usage in browser_automation: g={}; exec(open('/app/tests/iter28_sweep.py').read(), g); await g['run'](page, ['prod'], [390], None)
import json, os, re

FIX = "/app/test_reports/responsive_fixtures"
PROD = "https://launch-pad-462.emergent.host"
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].rstrip("/")
PROBE = open("/app/tests/iter28_probe.js").read()
OUT = "/app/test_reports/iter28_sweep.json"
ROUTES = ["/", "/about", "/our-work/rakhigarhi", "/our-work/theatre", "/our-work/craft-livelihood",
          "/our-work/workshops-learning", "/field-notes", "/connect", "/field-notes/what-the-haveli-reveals"]


def make_handler(mode, log=None):
    fx = f"{FIX}/{mode}"

    async def handler(route, request):
        if request.method != "GET":
            if log is not None: log.append(request.method + " " + request.url)
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
    return handler


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
                    await page.wait_for_timeout(700)
                    d = await page.evaluate(PROBE)
                    out[k] = d
                    print(k, "docW", d["docW"], "off", d["textOffN"], "clip", d["textClipN"], "tOv", d["textOvN"], "imgOff", d["imgOffN"],
                          "txtImg", d["textOnImgN"], "secOv", d["secOvN"], "esc", d["escapeN"], "foot", len(d["footHit"]), d["mainBelowFooter"], "dock", d["editorDock"])
                except Exception as e:
                    out[k] = {"error": str(e)[:300]}
                    print(k, "ERROR", str(e)[:200])
    json.dump(out, open(OUT, "w"), indent=0)
    return out
