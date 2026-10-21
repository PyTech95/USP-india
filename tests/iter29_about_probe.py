# Iteration 29: About hero rail probe at 1024/1280/1440 vs home hero / footer inner (prod fixtures, read-only).
_g = {}
exec(open("/app/tests/iter28_sweep.py").read(), _g)
JS = r"""(() => { const b = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; };
  const hero = document.querySelector('.page-about > .hb-hero') || document.querySelector('main .hb-hero');
  const f = document.querySelector('footer'); const fi = f && [...f.querySelectorAll('*')].find((e) => getComputedStyle(e).maxWidth !== 'none');
  const rules = []; if (hero) for (const sh of document.styleSheets) { try { const walk = (rs) => { for (const r of rs) { if (r.cssRules) walk(r.cssRules); if (r.selectorText && hero.matches(r.selectorText) && /width|margin/.test(r.style.cssText)) rules.push(r.selectorText.slice(0, 120) + ' {' + r.style.cssText.slice(0, 160)); } }; walk(sh.cssRules); } catch (e) {} }
  return {hero: b(hero), heroChild: b(hero && hero.firstElementChild), parent: b(hero && hero.parentElement), boxW: hero && getComputedStyle(hero).getPropertyValue('--box-w'), heroCS: hero && [getComputedStyle(hero).width, getComputedStyle(hero).marginLeft],
    headerWrap: b(document.querySelector('#site-header .wrap')), footerInner: b(fi), footerInnerCls: fi && fi.className, rules: rules.slice(-8)}; })()"""


async def run(page):
    await page.route("**/api/**", _g["make_handler"]("prod"))
    for path in ("/about", "/"):
        for w in (1024, 1280, 1440):
            await page.set_viewport_size({"width": w, "height": 900})
            await page.goto(_g["BASE"] + path, wait_until="networkidle", timeout=45000)
            await page.wait_for_timeout(700)
            d = await page.evaluate(JS)
            print(path, w, {k: v for k, v in d.items() if k != "rules"})
            if path == "/about": print("   rules", d["rules"])
