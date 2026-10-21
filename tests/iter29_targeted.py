# Iteration 29: targeted retest of iteration-28 failures (read-only, fixture replay, GET only, non-GET aborted).
# Usage in browser_automation: g={}; exec(open('/app/tests/iter29_targeted.py').read(), g); await g['main'](page, ['craft','figs','menu','misc'])
import json, os
_g = {}
exec(open("/app/tests/iter28_sweep.py").read(), _g)
BASE, make_handler = _g["BASE"], _g["make_handler"]
OUT = "/app/test_reports/iter29_targeted.json"

CRAFT_JS = r"""(() => {
  const sec = document.querySelector('#craft-reference #craft-centre'); if (!sec) return {err: 'no craft-centre'};
  const r4 = (r) => [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.right), Math.round(r.bottom + scrollY)];
  const hdr = document.querySelector('#site-header .header-inner'); const foot = document.querySelector('footer .wrap, footer > *');
  const img = sec.querySelector('img'); const ib = img && img.getBoundingClientRect();
  const texts = []; const w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) { if (!r.width) continue; const ov = ib ? Math.max(0, Math.min(r.right, ib.right) - Math.max(r.left, ib.left)) * Math.max(0, Math.min(r.bottom, ib.bottom) - Math.max(r.top, ib.top)) : 0;
      texts.push({t: n.textContent.trim().slice(0, 20), b: r4(r), ov: Math.round(ov)}); } }
  const st = sec.querySelector('.split-text'); const cs = st && getComputedStyle(st);
  const kids = [...sec.querySelectorAll('.split-text [data-edit]')].map((e) => ({tid: e.dataset.testid, tf: getComputedStyle(e).transform, edy: e.style.getPropertyValue('--ed-y'), edt: e.style.getPropertyValue('--ed-t'), fs: getComputedStyle(e).fontSize}));
  const L = Math.min(...texts.map((x) => x.b[0])), R = Math.max(...texts.map((x) => x.b[2]));
  const hb = hdr.getBoundingClientRect(), fb = foot && foot.getBoundingClientRect();
  return {vw: innerWidth, rail: [Math.round(hb.left), Math.round(hb.right)], footRail: fb && [Math.round(fb.left), Math.round(fb.right)], sec: r4(sec.getBoundingClientRect()), img: ib && r4(ib), textL: L, textR: R,
    inside: L >= hb.left - 1 && R <= hb.right + 1, textOnImg: texts.filter((x) => x.ov > 4).length, splitText: st && {box: r4(st.getBoundingClientRect()), js: cs.justifySelf, w: cs.width}, kids, n: texts.length,
    band: (() => { const b = [...document.querySelectorAll('main [data-boxed-band]')].map((e) => ({sec: e.dataset.sec, box: r4(e.getBoundingClientRect()), bg: getComputedStyle(e).backgroundColor})); return b; })()};
})()"""

FIG_JS = r"""(tids) => tids.map((tid) => {
  const el = document.querySelector(`[data-testid="${tid}"]`); if (!el) return {tid, err: 'missing'};
  const fig = el.closest('figure') || el; const img = fig.querySelector('img'); const fr = fig.querySelector('.photo-frame');
  const R = (e) => e && e.getBoundingClientRect(); const fb = R(fig), ib = R(img), rb = R(fr);
  const hits = []; const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { if (!n.textContent.trim() || fig.contains(n)) continue; const rg = document.createRange(); rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) { if (!r.width) continue; for (const b of [ib, fb]) { const ov = Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)) * Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top)); if (ov > 4) { hits.push(n.textContent.trim().slice(0, 30)); break; } } } }
  const cs = getComputedStyle(fig);
  return {tid, figH: Math.round(fb.height), frameH: rb && Math.round(rb.height), imgH: ib && Math.round(ib.height), imgW: ib && Math.round(ib.width), figAR: cs.aspectRatio, imgAR: img && getComputedStyle(img).aspectRatio,
    contained: !ib || (ib.bottom <= fb.bottom + 1.5 && ib.top >= fb.top - 1.5), overlaps: [...new Set(hits)]};
})"""

FIGS = {"/our-work/workshops-learning": ["block-3-image", "block-4-collage-0"], "/our-work/rakhigarhi": ["block-2-detail-0"]}


async def _goto(p, path):
    await p.goto(BASE + path, wait_until="networkidle", timeout=45000)
    await p.wait_for_timeout(900)


async def engine_ctx(page, pw, eng, touch=False, w=1440, h=900):
    br = page.context.browser if eng == "chromium" else await pw.webkit.launch()
    ctx = await br.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=False, reduced_motion="reduce")
    p = await ctx.new_page()
    await p.route("**/api/**", make_handler("prod"))
    return br, ctx, p


async def craft(page, pw, out):
    for eng in ("chromium", "webkit"):
        br, ctx, p = await engine_ctx(page, pw, eng)
        for w in (1440, 1920):
            await p.set_viewport_size({"width": w, "height": 1000})
            await _goto(p, "/our-work/craft-livelihood")
            d = await p.evaluate(CRAFT_JS); out[f"craft/{eng}/{w}"] = d
            print("CRAFT", eng, w, "rail", d.get("rail"), "text", d.get("textL"), d.get("textR"), "inside", d.get("inside"), "txtOnImg", d.get("textOnImg"), "img", d.get("img"), "split", d.get("splitText"))
            print("   kids", [(k["tid"], k["tf"], k["edy"], k["fs"]) for k in d.get("kids", [])][:4])
            print("   bands", d.get("band"))
            el = await p.query_selector("#craft-centre")
            if el:
                await el.scroll_into_view_if_needed(); await p.screenshot(path=f"/app/test_reports/iter29_craft_{eng}_{w}.jpg", quality=40)
        await ctx.close()
        if eng == "webkit": await br.close()


async def figs(page, pw, out):
    for eng in ("chromium", "webkit"):
        br, ctx, p = await engine_ctx(page, pw, eng)
        for w in (390, 768, 1366):
            await p.set_viewport_size({"width": w, "height": 900})
            for path, tids in FIGS.items():
                await _goto(p, path)
                res = await p.evaluate(FIG_JS, tids); out[f"figs/{eng}/{w}{path}"] = res
                for r in res: print("FIG", eng, w, r)
        await ctx.close()
        if eng == "webkit": await br.close()


async def menu(page, pw, out):
    for eng in ("chromium", "webkit"):
        for touch in (False, True):
            br, ctx, p = await engine_ctx(page, pw, eng, touch=touch)
            for w in (390, 1024):
                await p.set_viewport_size({"width": w, "height": 844})
                act = (lambda loc: loc.tap()) if touch else (lambda loc: loc.click())
                for target, exp in (("nav-m-notes", "/field-notes"), ("nav-m-connect", "/connect")):
                    k = f"menu/{eng}/{'touch' if touch else 'mouse'}/{w}/{target}"
                    try:
                        await _goto(p, "/our-work/theatre")
                        await act(p.get_by_test_id("mobile-menu-toggle")); await p.wait_for_timeout(300)
                        await act(p.get_by_test_id("nav-m-work-toggle")); await p.wait_for_timeout(300)
                        sub = await p.get_by_test_id("nav-m-work-menu").is_visible()
                        await act(p.get_by_test_id(target)); await p.wait_for_timeout(900)
                        url = p.url.replace(BASE, "")
                        ok = url.startswith(exp)
                        out[k] = {"submenuOpen": sub, "url": url, "pass": ok}; print("MENU", k, sub, url, "PASS" if ok else "FAIL")
                    except Exception as e:
                        out[k] = {"error": str(e)[:200]}; print("MENU", k, "ERR", str(e)[:200])
                # Escape + outside dismiss
                try:
                    await _goto(p, "/our-work/theatre")
                    await act(p.get_by_test_id("mobile-menu-toggle")); await p.wait_for_timeout(250)
                    await act(p.get_by_test_id("nav-m-work-toggle")); await p.wait_for_timeout(250)
                    await p.keyboard.press("Escape"); await p.wait_for_timeout(250)
                    esc_sub = await p.get_by_test_id("nav-m-work-menu").count()
                    esc_menu = await p.evaluate("document.querySelector('#main-menu').classList.contains('open')")
                    await act(p.get_by_test_id("mobile-menu-toggle")); await p.wait_for_timeout(250)
                    await act(p.get_by_test_id("nav-m-work-toggle")); await p.wait_for_timeout(250)
                    if touch: await p.touchscreen.tap(w // 2, 800)
                    else: await p.mouse.click(w // 2, 800)
                    await p.wait_for_timeout(300)
                    out_menu = await p.evaluate("document.querySelector('#main-menu').classList.contains('open')")
                    out_sub = await p.get_by_test_id("nav-m-work-menu").count()
                    k = f"menu/{eng}/{'touch' if touch else 'mouse'}/{w}/dismiss"
                    out[k] = {"escSubmenuCount": esc_sub, "escMenuOpen": esc_menu, "outsideMenuOpen": out_menu, "outsideSubCount": out_sub, "url": p.url.replace(BASE, "")}
                    print("DISMISS", k, out[k])
                except Exception as e:
                    print("DISMISS ERR", eng, touch, w, str(e)[:200])
            await ctx.close()
            if eng == "webkit": await br.close()


async def misc(page, pw, out):
    br, ctx, p = await engine_ctx(page, pw, "chromium")
    for w in (1024, 1280, 1440):
        await p.set_viewport_size({"width": w, "height": 900})
        await _goto(p, "/about")
        d = await p.evaluate(r"""(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; };
          return {hero: r('.page-about > .hb-hero'), header: r('#site-header .header-inner'), footer: r('footer .wrap'), bands: [...document.querySelectorAll('main [data-boxed-band]')].map((e) => { const b = e.getBoundingClientRect(); return [e.dataset.sec, Math.round(b.left), Math.round(b.right)]; })}; })()""")
        out[f"about/{w}"] = d; print("ABOUT", w, d)
    for w in (390, 768, 1024, 1100, 1101, 1280):
        await p.set_viewport_size({"width": w, "height": 900})
        await _goto(p, "/connect")
        fs = await p.evaluate("[...document.querySelectorAll('#public-site form input, #public-site form textarea, #public-site form select')].map(e => getComputedStyle(e).fontSize)")
        out[f"inputs/{w}"] = fs; print("INPUT fs", w, sorted(set(fs)))
    await ctx.close()


async def main(page, parts):
    from playwright.async_api import async_playwright
    out = json.load(open(OUT)) if os.path.exists(OUT) else {}
    async with async_playwright() as pw:
        for part in parts:
            await globals()[part](page, pw, out)
            json.dump(out, open(OUT, "w"), indent=1)
    return out
