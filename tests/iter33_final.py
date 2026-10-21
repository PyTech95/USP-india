# Iteration 33: final retest of shipped responsive.css (BASE variants only, no injected CSS).
# GET fixtures replayed; every non-GET aborted (no real POST). Usage:
# g={}; exec(open('/app/tests/iter33_final.py').read(), g); await g['run'](page)
import json
g32 = {}
exec(open('/app/tests/iter32_contact_scroll.py').read(), g32)
OUT33 = "/app/test_reports/iter33_final.json"

EXTRA = """() => {
  const b = document.querySelector('[data-testid=contact-submit]');
  const o = {};
  if (b) { b.scrollIntoView({block: 'center'}); const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    o.sendHit = !!hit && (hit === b || b.contains(hit)); o.sendH = Math.round(r.height); o.scrollY = Math.round(scrollY); }
  const c = document.querySelector('.pcc-card'); if (c) { o.cardScrollTop = c.scrollTop; const r = c.getBoundingClientRect(); o.cardX = Math.round(r.left); }
  const t = document.querySelector('[data-testid=mobile-menu-toggle]');
  o.menuToggleVisible = !!t && getComputedStyle(t).display !== 'none' && t.getBoundingClientRect().width > 0;
  const links = [...document.querySelectorAll('header a.nav-link, header nav a')].filter(a => a.getBoundingClientRect().width > 0);
  o.navTops = [...new Set(links.map(a => Math.round(a.getBoundingClientRect().top)))];
  const hh = document.querySelector('.hfn-head');
  if (hh) { o.hfnHeadCols = getComputedStyle(hh).gridTemplateColumns; const i = hh.querySelector('.hfn-intro'), f = hh.querySelector('.hfn-feature');
    if (i && f) { const a = i.getBoundingClientRect(), d = f.getBoundingClientRect(); o.hfnHeadSideBySide = d.left >= a.right - 1 && d.top < a.bottom; } }
  return o;
}"""


async def run(page):
    log, out = [], {}
    cases = [("prod", "/connect", [1024, 1280, 1920, 390]), ("preview", "/connect", [1280, 390]), ("preview", "/", [1024, 1080, 1280])]
    for mode, route, widths in cases:
        await page.unroute("**/api/**")
        await page.route("**/api/**", g32['handler_for'](mode, log))
        for w in widths:
            k = f"{mode}{route}@{w}/base"
            try:
                d = await g32['measure'](page, mode, w, route)
                d.update(await page.evaluate(EXTRA))
                if route == "/connect":
                    # real click via page scroll only (no POST: empty form -> client validation; non-GET aborted anyway)
                    await page.evaluate("() => { const c=document.querySelector('.pcc-card'); if(c) c.scrollTop=0; }")
                    btn = page.locator('[data-testid=contact-submit]')
                    await btn.scroll_into_view_if_needed()
                    h0 = (await page.evaluate("() => document.querySelector('.pcc-card').getBoundingClientRect().height"))
                    await btn.click(timeout=5000, trial=False)
                    await page.wait_for_timeout(400)
                    d["errorsShown"] = await page.locator('.field-error').count()
                    d["after"] = await page.evaluate(g32['PROBE'])
                    d["cardGrowPx"] = round(d["after"]["card"]["clientH"] - h0) if d["after"].get("card") else None
                    d["cardScrollTopAfter"] = await page.evaluate("() => document.querySelector('.pcc-card').scrollTop")
                    if w == 1280:
                        await page.screenshot(path=f"/app/test_reports/iter33_{mode}_connect_{w}_errors.jpg", quality=40, type="jpeg")
                if mode == "preview" and route == "/" and w == 1024:
                    await page.locator('.hfn').first.scroll_into_view_if_needed()
                    await page.screenshot(path="/app/test_reports/iter33_preview_home_1024_hfn.jpg", quality=40, type="jpeg")
                out[k] = d
                keys = ["docH", "docW", "card", "formBottom", "footerTop", "cardOverFooter", "gridCols", "sendHit", "cardX", "errorsShown", "cardGrowPx", "cardScrollTopAfter", "menuToggleVisible", "navTops"] if route == "/connect" else \
                       ["docW", "hfnTextOverlapPx2", "hfnCols", "hfnCards", "hfnHeadCols", "hfnHeadSideBySide", "menuToggleVisible", "navTops"]
                s = {x: d.get(x) for x in keys}
                if "card" in s and s["card"]: s["card"] = {x: s["card"][x] for x in ["clientH", "scrollH", "ovY", "h", "minH", "mb", "tf", "top", "bottom", "w", "nestedScroll"]}
                if d.get("after", {}).get("card"): s["afterCard"] = {x: d["after"]["card"][x] for x in ["clientH", "scrollH", "nestedScroll", "bottom"]}; s["afterOverFooter"] = d["after"].get("cardOverFooter"); s["afterDocH"] = d["after"]["docH"]
                print(k, json.dumps(s))
            except Exception as e:
                out[k] = {"error": str(e)[:300]}; print(k, "ERROR", str(e)[:300])
    out["_blocked_non_get"] = sorted(set(log))
    out["_post_contact_attempted"] = [l for l in log if "contact" in l or "enquir" in l]
    print("blocked:", out["_blocked_non_get"], "contactPOST:", out["_post_contact_attempted"])
    json.dump(out, open(OUT33, "w"), indent=0)
    return out
