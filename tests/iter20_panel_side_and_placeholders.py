# Iter20 NO-WRITE: auto panel side for right-half selections, east handle drag reachable, explicit side toggle, mobile side,
# undo/redo hit, Ambition section padding placeholders (computed). All non-GET /api requests blocked; nothing saved.
import asyncio, os
from playwright.async_api import async_playwright
from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
RES, BLOCKED = [], []
def ok(n, c, info=""): RES.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n, info)
PANEL = """() => { const p=document.querySelector('[data-testid=live-editor-panel]'); if(!p) return {missing:true, sel:document.querySelector('[data-testid=live-selected-label]')?.innerText||null, ui:[...document.querySelectorAll('.live-ui')].map(e=>e.dataset.testid)}; const r=p.getBoundingClientRect();
 const hit=(t)=>{const el=document.querySelector(`[data-testid=${t}]`); if(!el) return null; const b=el.getBoundingClientRect(); const e=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2); return !!e&&el.contains(e)};
 const sb=document.querySelector('[data-testid=live-panel-side]');
 return {side:p.dataset.panelSide, top:Math.round(r.top), left:Math.round(r.left), right:Math.round(innerWidth-r.right), save:hit('live-save-btn'), exit:hit('live-exit-btn'), undo:hit('live-undo'), redo:hit('live-redo'),
   sideBtnVisible: !!sb && getComputedStyle(sb).display!=='none' && sb.getBoundingClientRect().width>0} }"""
GEOM = """(tid) => { const a=document.querySelector(`[data-testid="${tid}"]`); const t=a.querySelector('[data-edit-text]'), s=a.querySelector('svg'); const ar=a.getBoundingClientRect(), tr=t.getBoundingClientRect(), sr=s.getBoundingClientRect();
 return {aw:Math.round(ar.width), ax:Math.round(ar.left), tx:Math.round(tr.left), sx:Math.round(sr.left), gap:Math.round(sr.left-tr.right), vc:Math.round(Math.abs((sr.top+sr.height/2)-(tr.top+tr.height/2))), lines:t.getClientRects().length, txt:t.innerText} }"""
EHIT = """() => { const h=document.querySelector('[data-testid=live-resize-e]'); if(!h) return null; const r=h.getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
 return {x:Math.round(r.left), hit: !!e && (e===h || h.contains(e)), by: e && (e.closest('[data-testid=live-editor-panel]')?'PANEL':(e.dataset.testid||String(e.className).slice(0,40)))} }"""

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(); ctx = await b.new_context(viewport={"width": 1920, "height": 1080})
        async def block(route):
            if route.request.method != "GET" and "/auth/" not in route.request.url: BLOCKED.append(route.request.url); return await route.abort()
            await route.continue_()
        await ctx.route("**/api/**", block)
        page = await ctx.new_page(); errs = []; page.on("pageerror", lambda e: errs.append(str(e))); page.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await page.goto(BASE + "/admin/login"); await page.fill('[data-testid="login-email"]', "admin@uspindia.org"); await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
        await page.click('[data-testid="login-submit"]'); await page.wait_for_url(lambda u: "/admin" in u and "/login" not in u, timeout=20000)
        try:
            await page.goto(BASE + "/?edit=1"); await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(2000)
            p0 = await page.evaluate(PANEL); ok("load: panel right top12, side btn visible, save/exit/undo/redo hit", p0["side"] == "right" and p0["top"] == 12 and p0["sideBtnVisible"] and p0["save"] and p0["exit"] and p0["undo"] and p0["redo"], p0)
            tid = await page.evaluate("()=>{const e=[...document.querySelectorAll('[data-edit-group=action]')].find(e=>/Field Notes/i.test(e.innerText)); return e&&e.dataset.testid}")
            print("explore notes tid", tid)
            loc = page.locator(f'[data-testid="{tid}"] svg'); await loc.scroll_into_view_if_needed(); await page.wait_for_timeout(300)
            await loc.click(force=True); await page.wait_for_timeout(800)
            g0 = await page.evaluate(GEOM, tid); print("before", g0)
            p1 = await page.evaluate(PANEL); ok("select right-half Explore Field Notes -> panel LEFT, top12, buttons hit", p1["side"] == "left" and p1["top"] == 12 and p1["left"] == 12 and p1["save"] and p1["exit"], p1)
            # no loop: side stays stable over time
            sides = []
            for _ in range(6): await page.wait_for_timeout(250); sides.append(await page.evaluate("document.querySelector('[data-testid=live-editor-panel]').dataset.panelSide"))
            ok("no side-switch loop (stable 1.5s)", set(sides) == {"left"}, sides)
            eh = await page.evaluate(EHIT); ok("east handle reachable via elementFromPoint", eh and eh["hit"], eh)
            h = page.locator('[data-testid="live-resize-e"]'); hb = await h.bounding_box()
            await page.mouse.move(hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2); await page.mouse.down()
            await page.mouse.move(hb["x"] + hb["width"] / 2 + 50, hb["y"] + hb["height"] / 2, steps=8); await page.mouse.up(); await page.wait_for_timeout(600)
            g1 = await page.evaluate(GEOM, tid); print("after east drag", g1)
            ok("east drag grows width; text+arrow together single line", g1["aw"] > g0["aw"] + 20 and g1["lines"] == 1 and g1["vc"] <= 4 and 0 <= g1["gap"] <= 16 and abs(g1["sx"] - g1["tx"] - (g0["sx"] - g0["tx"])) <= 60, (g0, g1))
            print("INFO right edge before/after", g0["ax"] + g0["aw"], g1["ax"] + g1["aw"])
            p2 = await page.evaluate(PANEL); ok("after drag panel still left/top12", p2["side"] == "left" and p2["top"] == 12, p2)
            sides = []
            for _ in range(4): await page.wait_for_timeout(250); sides.append(await page.evaluate("document.querySelector('[data-testid=live-editor-panel]').dataset.panelSide"))
            ok("no loop after drag", set(sides) == {"left"}, sides)
            # undo local change via real mouse click (hit test)
            await page.locator('[data-testid="live-undo"]').click(timeout=5000); await page.wait_for_timeout(500)
            gu = await page.evaluate(GEOM, tid); ok("real mouse click undo restores width", abs(gu["aw"] - g0["aw"]) <= 2, (gu["aw"], g0["aw"]))
            # explicit toggle
            await page.locator('[data-testid="live-panel-side"]').click(timeout=5000); await page.wait_for_timeout(500)
            p3 = await page.evaluate(PANEL); ok("toggle -> right, top unchanged 12", p3["side"] == "right" and p3["top"] == 12 and p3["right"] == 12, p3)
            await page.locator('[data-testid="live-panel-side"]').click(timeout=5000); await page.wait_for_timeout(500)
            p4 = await page.evaluate(PANEL); ok("toggle -> left, top unchanged 12", p4["side"] == "left" and p4["top"] == 12 and p4["left"] == 12, p4)
            # selecting a left-half element returns right
            lh = await page.evaluate("()=>{const e=[...document.querySelectorAll('main [data-edit]')].find(e=>{const r=e.getBoundingClientRect(); return r.right<innerWidth/2-20 && r.width>40 && r.top>0 && r.bottom<innerHeight}); if(e) e.setAttribute('data-t1','l'); return !!e}")
            if lh:
                await page.locator("[data-t1=l]").click(force=True); await page.wait_for_timeout(600)
                p5 = await page.evaluate(PANEL); ok("left-half selection -> panel right top12", p5["side"] == "right" and p5["top"] == 12, p5)
            # mobile
            await page.locator(f'[data-testid="{tid}"] svg').scroll_into_view_if_needed(); await page.locator(f'[data-testid="{tid}"] svg').click(force=True); await page.wait_for_timeout(500)
            for vw, vh in ((768, 1024), (390, 844)):
                await page.set_viewport_size({"width": vw, "height": vh}); await page.wait_for_timeout(700)
                pm = await page.evaluate(PANEL)
                ok(f"{vw}: panel at right/top12, side btn hidden, save hit", pm["right"] in (8, 12) and pm["top"] == 12 and not pm["sideBtnVisible"] and pm["save"], pm)
                if await page.locator(f'[data-testid="{tid}"]').count():
                    await page.evaluate(f"document.querySelector('[data-testid={tid}] svg').scrollIntoView({{block:'end'}}); scrollBy(0,-120)"); await page.wait_for_timeout(500)
                    print("INFO hit at arrow:", await page.evaluate(f"()=>{{const r=document.querySelector('[data-testid={tid}] svg').getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return [Math.round(r.top), e&&(e.closest('[data-testid]')?.dataset.testid)]}}"))
                    await page.locator(f'[data-testid="{tid}"] svg').click(); await page.wait_for_timeout(500)
                    pm2 = await page.evaluate(PANEL); print("pm2", pm2, "url", page.url); ok(f"{vw}: after selecting, still right/top12", pm2 and not pm2.get("missing") and pm2["right"] in (8, 12) and pm2["top"] == 12, pm2)
            await page.set_viewport_size({"width": 1920, "height": 1080})
            # Ambition placeholders
            for vw, vh, exp in ((1920, 1080, ("72", "64")), (390, 844, ("40", "40"))):
                await page.set_viewport_size({"width": vw, "height": vh})
                await page.goto(BASE + "/our-work/rakhigarhi?edit=1"); await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=50000); await page.wait_for_timeout(2000)
                st = page.locator("#the-ambition .stacked").first; await page.evaluate("document.querySelector('#the-ambition .stacked').scrollIntoView({block:'end'})"); await page.wait_for_timeout(1200); bb = await st.bounding_box()
                bb = {**bb, "y": bb["y"] + bb["height"] - 60 - 15}
                print("INFO ambition click target:", await page.evaluate(f"(()=>{{const e=document.elementFromPoint({bb['x'] + bb['width'] / 2},{bb['y'] + 15}); return e&&(e.closest('[data-testid]')?.dataset.testid||e.className)}})()"))
                await page.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + 15); await page.wait_for_timeout(800)
                pt, pb = page.locator('[data-testid="live-sec-pad-top"]'), page.locator('[data-testid="live-sec-pad-bottom"]')
                if not await pt.count(): ok(f"{vw} ambition pad inputs present", False); continue
                if not await pt.is_visible(): await page.evaluate("()=>document.querySelectorAll('[data-testid=live-editor-panel] details').forEach(d=>d.open=true)"); await page.wait_for_timeout(300)
                ph = (await pt.get_attribute("placeholder"), await pb.get_attribute("placeholder")); vals = (await pt.input_value(), await pb.input_value())
                actual = await page.evaluate("()=>{const s=document.querySelector('#the-ambition > section')||document.querySelector('#the-ambition section'); const c=getComputedStyle(s); return [String(Math.round(parseFloat(c.paddingTop))), String(Math.round(parseFloat(c.paddingBottom)))]}")
                ok(f"{vw} ambition placeholders show computed padding", ph == exp and list(ph) == actual and vals == ("", ""), (ph, actual, vals))
                h0 = await page.evaluate("document.querySelector('#the-ambition').getBoundingClientRect().height")
                await pb.fill("20"); await page.wait_for_timeout(500)
                a2 = await page.evaluate("()=>{const s=document.querySelector('#the-ambition > section')||document.querySelector('#the-ambition section'); return [Math.round(parseFloat(getComputedStyle(s).paddingBottom)), document.querySelector('#the-ambition').getBoundingClientRect().height]}")
                ok(f"{vw} setting bottom 20 sets actual inner padding (not additive)", a2[0] == 20 and a2[1] < h0, (a2, h0))
                await pb.fill(""); await page.wait_for_timeout(500)
                await page.wait_for_timeout(1000); ph2 = await pb.get_attribute("placeholder")
                act2 = await page.evaluate("()=>{const s=document.querySelector('#the-ambition > section')||document.querySelector('#the-ambition section'); return Math.round(parseFloat(getComputedStyle(s).paddingBottom))}")
                print("INFO after clear: placeholder", ph2, "actual", act2)
                await pt.fill("5"); await page.wait_for_timeout(400); await pt.fill(""); await page.wait_for_timeout(600)
                print("INFO after another rerender: placeholder bottom", await pb.get_attribute("placeholder"), "top", await pt.get_attribute("placeholder"))
                ok(f"{vw} cleared -> placeholder back to default", ph2 == exp[1], ph2)
        except Exception as e:
            ok("EXCEPTION", False, repr(e)[:400])
        print("page errors", errs[:5]); print("blocked writes:", BLOCKED); await b.close()
    print(f"TOTAL {sum(r for _, r in RES)}/{len(RES)}; FAILS:", [n for n, r in RES if not r])
asyncio.run(main())
