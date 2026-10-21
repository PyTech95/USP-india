# Iteration 28: LiveEditor viewport gating + draft retention. QA-ONLY STUBS: every admin PUT/POST/DELETE is intercepted
# (PUT */live answered by a QA stub echoing payload, others aborted); GET passes through read-only. App code has no mocks.
# Usage in browser_automation: g={}; exec(open('/app/tests/iter28_editor_gate.py').read(), g); await g['run'](page)
import json, re

BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].rstrip("/")
CREDS = open("/app/memory/test_credentials.md").read()
EMAIL = re.search(r"Email:\s*(\S+)", CREDS).group(1)
PWD = re.search(r"Password:\s*(\S+)", CREDS).group(1)
STATE_JS = """() => ({dock: !!document.querySelector('[data-testid=live-editor-dock]'), dockVisible: !!(document.querySelector('[data-testid=live-editor-dock]')?.offsetParent),
  panel: !!document.querySelector('[data-testid=live-editor-panel]'), panelVisible: !!(document.querySelector('[data-testid=live-editor-panel]')?.offsetParent),
  liveUiVisible: [...document.querySelectorAll('.live-ui')].filter(e => e.offsetParent).length,
  ce: document.querySelectorAll('[contenteditable=true]').length, liveEditing: document.body.classList.contains('live-editing'),
  session: sessionStorage.getItem('usp-live-edit'), status: document.querySelector('[data-testid=live-status]')?.textContent || null})"""


def make_route(log):
    async def handler(route, request):
        u, m = request.url, request.method
        if "/api/admin" in u or "-live" in u:
            log.append(f"{m} {u.split('/api', 1)[-1]}")
        if m == "GET" or "/api/auth/" in u:
            return await route.continue_()
        if m == "PUT" and re.search(r"/api/admin/pages/[\w-]+/live$", u):
            body = json.loads(request.post_data or "{}")
            return await route.fulfill(status=200, content_type="application/json",
                                       body=json.dumps({"content": {"title": body.get("title"), "sections": body.get("sections", [])}, "version": f"{body.get('base_version')}-qa-stub"}))
        if m == "PUT" and re.search(r"/api/admin/(header|site)-live$", u):
            return await route.fulfill(status=200, content_type="application/json", body='{"ok": true, "qa_stub": true}')
        return await route.abort()
    return handler


async def chrome_drafts(page):
    """Header + Site text drafts survive desktop->390->desktop resize; save goes only to QA stub."""
    log = []
    page.on("dialog", lambda d: __import__("asyncio").ensure_future(d.dismiss()))
    await page.route("**/api/**", make_route(log))
    await page.set_viewport_size({"width": 1440, "height": 900})
    await page.goto(BASE + "/admin/login", wait_until="networkidle")
    await page.fill('[data-testid="login-email"]', EMAIL); await page.fill('[data-testid="login-password"]', PWD)
    await page.click('[data-testid="login-submit"]'); await page.wait_for_timeout(2500)
    await page.goto(BASE + "/connect?edit=1", wait_until="networkidle"); await page.wait_for_timeout(1500)
    for scope, toggle, field, status, save in (("header", "live-header-toggle", '[data-testid="header-tab-panel-content"] input[type=text], [data-testid="header-tab-panel-content"] input:not([type])', '[data-testid="header-save-status"]', "header-editor-save"),
                                                ("site", "live-site-toggle", '[data-testid="live-site-value"]', '[data-testid="live-site-save"]', "live-site-save")):
        try:
            await page.click(f'[data-testid="{toggle}"]'); await page.wait_for_timeout(800)
            f = page.locator(field).first
            orig = await f.input_value()
            await f.fill(orig + " QA"); await page.wait_for_timeout(300)
            st0 = await page.locator(status).first.text_content() if scope == "header" else None
            await page.set_viewport_size({"width": 390, "height": 844}); await page.wait_for_timeout(700)
            mob = await page.evaluate("() => ({liveUi: [...document.querySelectorAll('.live-ui')].filter(e => getComputedStyle(e).display !== 'none').length, cls: document.body.className})")
            await page.set_viewport_size({"width": 1440, "height": 900}); await page.wait_for_timeout(900)
            f = page.locator(field).first
            back = await f.input_value() if await f.count() else None
            st1 = await page.locator(status).first.text_content() if scope == "header" and await page.locator(status).count() else None
            log.clear()
            await page.click(f'[data-testid="{save}"]'); await page.wait_for_timeout(1500)
            print(scope, {"orig": orig[:30], "status_before": st0, "mobile": mob, "after_back": (back or "")[:40], "retained": back == orig + " QA", "status_back": st1, "save_reqs": [x for x in log if x.startswith("PUT")]})
            close = "header-editor-close" if scope == "header" else "live-site-close"
            if await page.locator(f'[data-testid="{close}"]').count(): await page.click(f'[data-testid="{close}"]'); await page.wait_for_timeout(400)
        except Exception as e:
            print(scope, "FAIL", str(e)[:300])


SKIP_GATE = False


async def run(page):
    log = []
    res = {}
    page.on("dialog", lambda d: (log.append("DIALOG " + d.message), __import__("asyncio").ensure_future(d.dismiss())))
    await page.route("**/api/**", make_route(log))
    await page.set_viewport_size({"width": 1440, "height": 900})
    await page.goto(BASE + "/admin/login", wait_until="networkidle")
    await page.fill('[data-testid="login-email"]', EMAIL)
    await page.fill('[data-testid="login-password"]', PWD)
    await page.click('[data-testid="login-submit"]')
    await page.wait_for_timeout(2500)
    print("logged in url", page.url)
    # cold ?edit=1 at mobile/tablet widths
    for w, h in (() if SKIP_GATE else ((390, 844), (768, 1024), (1024, 768))):
        await page.evaluate("sessionStorage.removeItem('usp-live-edit')")
        await page.set_viewport_size({"width": w, "height": h})
        log.clear()
        await page.goto(BASE + "/about?edit=1", wait_until="networkidle"); await page.wait_for_timeout(1200)
        s = await page.evaluate(STATE_JS); s["adminReq"] = list(log); res[f"cold{w}"] = s; print("cold", w, s)
        log.clear()
        await page.goto(BASE + "/about", wait_until="networkidle"); await page.wait_for_timeout(1000)
        s = await page.evaluate(STATE_JS); s["adminReq"] = list(log); res[f"stored{w}"] = s; print("stored", w, s)
    # touch landscape 1366 with same auth cookies
    st = await page.context.storage_state()
    ctx = await page.context.browser.new_context(viewport={"width": 1366, "height": 1024}, has_touch=True, is_mobile=True, storage_state=st)
    tp = await ctx.new_page(); tlog = []
    await tp.route("**/api/**", make_route(tlog))
    await tp.goto(BASE + "/about?edit=1", wait_until="networkidle"); await tp.wait_for_timeout(1200)
    s = await tp.evaluate(STATE_JS); s["adminReq"] = tlog; res["touch1366"] = s; print("touch1366", s)
    await ctx.close()
    # desktop
    for w in (1280, 1920, 1440):
        await page.set_viewport_size({"width": w, "height": 900})
        log.clear()
        await page.goto(BASE + "/about?edit=1", wait_until="networkidle"); await page.wait_for_timeout(1800)
        s = await page.evaluate(STATE_JS); s["adminReq"] = list(log); res[f"desk{w}"] = s; print("desktop", w, s)
    # selection + inline edit (dirty) at 1440
    h = page.locator('[data-testid="block-0-heading"]')
    await h.click(); await page.wait_for_timeout(500)
    print("selected label", await page.locator('[data-testid="live-selected-label"]').text_content() if await page.locator('[data-testid="live-selected-label"]').count() else None,
          "selbox", await page.locator('[data-testid="live-selection-box"]').count())
    await page.keyboard.press("End"); await page.keyboard.type(" QA")
    await page.wait_for_timeout(500)
    # panel drag
    pd = page.locator('[data-testid="live-panel-drag"]')
    if await pd.count():
        b0 = await page.locator('[data-testid="live-editor-panel"]').bounding_box(); db = await pd.bounding_box()
        await page.mouse.move(db["x"] + 10, db["y"] + db["height"] / 2); await page.mouse.down()
        await page.mouse.move(db["x"] - 200, db["y"] + 120, steps=8); await page.mouse.up(); await page.wait_for_timeout(300)
        b1 = await page.locator('[data-testid="live-editor-panel"]').bounding_box()
        print("panel drag", [round(b0["x"]), round(b0["y"])], "->", [round(b1["x"]), round(b1["y"])])
    s = await page.evaluate(STATE_JS); print("after edit", s)
    print("heading text", await h.text_content())
    # shrink to mobile: no editing UI, link nav not intercepted by editor (dirty guard confirm is expected; dismissed)
    await page.set_viewport_size({"width": 390, "height": 844}); await page.wait_for_timeout(800)
    s = await page.evaluate(STATE_JS); res["dirtyMobile"] = s; print("dirty->390", s, "heading", await h.text_content())
    await page.click('[data-testid="brand-link"]'); await page.wait_for_timeout(600)
    print("brand click at 390 while dirty -> url", page.url, "dialogs", [x for x in log if x.startswith("DIALOG")])
    await page.set_viewport_size({"width": 1440, "height": 900}); await page.wait_for_timeout(1200)
    s = await page.evaluate(STATE_JS); res["dirtyBack"] = s; print("back 1440", s, "heading", await h.text_content())
    log.clear()
    if await page.locator('[data-testid="live-save-btn"]').count():
        await page.click('[data-testid="live-save-btn"]'); await page.wait_for_timeout(1500)
    puts = [x for x in log if x.startswith("PUT")]
    print("save requests (QA stub)", puts, "status", await page.evaluate("document.querySelector('[data-testid=live-status]')?.textContent"))
    print("toast", await page.evaluate("[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent).join('|')"))
    res["savePuts"] = puts
    json.dump(res, open("/app/test_reports/iter28_editor_gate.json", "w"), indent=1)
    return res
