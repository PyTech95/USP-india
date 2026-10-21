# Playwright check: field note cover caption visible publicly + editable/clearable/re-addable in live editor
import asyncio
from playwright.async_api import async_playwright
BASE = "https://launch-pad-462.preview.emergentagent.com"
NOTE = "/field-notes/what-the-haveli-reveals"
ORIG = "Views from the restoration in progress"
CAP = '[data-testid="note-cover-caption"]'
R = {}

def rec(k, ok, info=""):
    R[k] = ok; print(("PASS " if ok else "FAIL ") + k, info)

async def public_caption(b, w, path=NOTE):
    ctx = await b.new_context(viewport={"width": w, "height": 900})
    pg = await ctx.new_page()
    await pg.goto(BASE + path); await pg.wait_for_selector('[data-testid="field-note"]', timeout=20000); await pg.wait_for_timeout(1500)
    n = await pg.locator(CAP).count()
    txt = (await pg.locator(CAP).first.inner_text()) if n else None
    vis = (await pg.locator(CAP).first.is_visible()) if n else False
    shot = f"/tmp/cap_{w}_{path.split('/')[-1]}.jpeg"
    if n and vis: await pg.locator(CAP).first.scroll_into_view_if_needed()
    await pg.screenshot(path=shot, quality=40)
    await ctx.close()
    return n, txt, vis

async def set_caption(page, text):
    await page.goto(BASE + NOTE + "?edit=1")
    await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(1500)
    span = page.locator(CAP + " span").first
    await span.scroll_into_view_if_needed(); await page.wait_for_timeout(300)
    vis = await span.is_visible()
    pseudo = await span.evaluate("e => getComputedStyle(e, '::before').content")
    await span.click(); await page.wait_for_timeout(500)
    label = await page.locator('[data-testid="live-selected-label"]').text_content() if await page.locator('[data-testid="live-selected-label"]').count() else None
    ce = await span.evaluate("e => e.isContentEditable")
    await page.keyboard.press("Control+A"); await page.keyboard.press("Delete")
    if text: await page.keyboard.type(text)
    await page.wait_for_timeout(400)
    now = await span.inner_text()
    status = await page.locator('[data-testid="live-status"]').text_content()
    await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
    await page.click('[data-testid="live-save-btn"]'); await page.wait_for_timeout(2500)
    status2 = await page.locator('[data-testid="live-status"]').text_content()
    print(f"  set_caption({text!r}): visible={vis} before={pseudo} label={label!r} editable={ce} typed={now!r} status={status!r} -> {status2!r}")
    return vis, pseudo, ce, now, status2

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w in (1440, 390):
            n, t, v = await public_caption(b, w)
            rec(f"public caption {w}", n == 1 and v and t.strip() == ORIG, f"{n} {t!r} {v}")
        ctx = await b.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()
        await page.goto(BASE + "/admin/login")
        await page.fill('[data-testid="login-email"]', "admin@uspindia.org")
        await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
        await page.click('[data-testid="login-submit"]')
        await page.wait_for_url("**/admin**", timeout=15000); await page.wait_for_timeout(1200)
        # edit
        vis, _, ce, now, st = await set_caption(page, "TEST caption edited")
        rec("editor edit caption", vis and ce and now == "TEST caption edited" and "saved" in st.lower())
        await page.screenshot(path="/tmp/cap_editor_edit.jpeg", quality=40)
        n, t, v = await public_caption(b, 1440)
        rec("public shows edited caption", n == 1 and t.strip() == "TEST caption edited", repr(t))
        # clear
        vis, _, ce, now, st = await set_caption(page, "")
        rec("editor clear caption saved", now.strip() == "" and "saved" in st.lower(), repr(now))
        n, t, v = await public_caption(b, 1440)
        rec("public no caption when empty", n == 0 or not v, f"{n} {v} {t!r}")
        n, t, v = await public_caption(b, 390)
        rec("public no caption when empty mobile", n == 0 or not v, f"{n} {v}")
        # placeholder in editor + re-add
        vis, pseudo, ce, now, st = await set_caption(page, ORIG)
        await page.screenshot(path="/tmp/cap_editor_readd.jpeg", quality=40)
        rec("editor placeholder visible", vis and "Add a caption" in (pseudo or ""), pseudo)
        rec("re-add caption saved", now == ORIG and "saved" in st.lower())
        for w in (1440, 390):
            n, t, v = await public_caption(b, w)
            rec(f"public restored caption {w}", n == 1 and v and t.strip() == ORIG, repr(t))
        # reload editor - verify persistence after reload while logged in
        await page.goto(BASE + NOTE); await page.wait_for_timeout(2000)
        rec("logged-in view caption", (await page.locator(CAP).first.inner_text()).strip() == ORIG)
        # other note
        n, t, v = await public_caption(b, 1440, "/field-notes/when-acceptance-comes-home")
        print("other note caption:", n, repr(t), v)
        await page.goto(BASE + "/field-notes/when-acceptance-comes-home"); await page.wait_for_timeout(2000)
        empties = await page.evaluate("() => Array.from(document.querySelectorAll('.photo-caption-empty')).map(e => getComputedStyle(e).display)")
        print("logged-in non-edit empty captions display:", empties)
        rec("no empty placeholder outside editor", all(d == "none" for d in empties))
        print("SUMMARY", sum(R.values()), "/", len(R))
        await b.close()

asyncio.run(main())
