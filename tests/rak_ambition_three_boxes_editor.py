# Playwright: Rakhigarhi Ambition 3 independent boxes in LiveEditor (select/inline edit/style/move/undo/redo/save/public reload)
# Always backup & restore the full rakhigarhi page doc.
import asyncio, os, copy, json
from playwright.async_api import async_playwright
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
BASE = "https://launch-pad-462.preview.emergentagent.com"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
SEL = "#the-ambition"
R = []

def ok(name, cond, info=""):
    R.append((name, bool(cond))); print(("PASS " if cond else "FAIL ") + name, info)

GEO = """() => { const sec=document.querySelector('#the-ambition'); const b=sec.querySelector('.ambition-body').getBoundingClientRect();
 const g=f=>{const e=sec.querySelector('[data-edit='+f+']'); if(!e) return null; const r=e.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y-b.y),w:Math.round(r.width),h:Math.round(r.height),txt:e.innerText,html:e.innerHTML.slice(0,200),fs:getComputedStyle(e.querySelector('p')||e).fontSize}};
 return {bodyH:Math.round(b.height), b1:g('body_1_html'), b2:g('body_2_html'), b3:g('body_3_html'), sw:document.documentElement.scrollWidth}; }"""

async def save(page):
    await page.click('[data-testid="live-save-btn"]')
    await page.wait_for_function("() => document.querySelector('[data-testid=live-status]')?.textContent.includes('Everything is saved')", timeout=15000)
    await page.wait_for_timeout(600)

async def select(page, f):
    el = page.locator(f'{SEL} [data-edit="{f}"]').first
    await el.scroll_into_view_if_needed()
    await el.click()
    await page.wait_for_selector('[data-testid="live-selection-box"]', timeout=5000)
    await page.wait_for_timeout(300)
    return el

async def main():
    doc = db.pages.find_one({"key": "rakhigarhi"}); backup = copy.deepcopy(doc)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            ctx = await b.new_context(viewport={"width": 1920, "height": 1080})
            page = await ctx.new_page()
            errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
            await page.goto(BASE + "/admin/login")
            await page.fill('[data-testid="login-email"]', "admin@uspindia.org")
            await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
            await page.click('[data-testid="login-submit"]')
            await page.wait_for_url("**/admin**", timeout=15000); await page.wait_for_timeout(1200)
            await page.goto(BASE + "/our-work/rakhigarhi?edit=1")
            await page.wait_for_selector('[data-testid="live-editor-panel"]', timeout=25000); await page.wait_for_timeout(1500)
            g0 = await page.evaluate(GEO); print("editor initial", json.dumps({k:(v if not isinstance(v,dict) else {a:b for a,b in v.items() if a not in ("html","txt")}) for k,v in g0.items()}))
            ok("3 boxes in editor", g0["b1"] and g0["b2"] and g0["b3"])
            # selection labels per box
            labels = {}
            for f in ("body_1_html", "body_2_html", "body_3_html"):
                await select(page, f)
                labels[f] = (await page.locator('[data-testid="live-selected-label"]').inner_text()).strip()
                bx = await page.locator('[data-testid="live-selection-box"]').bounding_box()
                eb = await page.locator(f'{SEL} [data-edit="{f}"]').bounding_box()
                ok(f"selection box hugs {f}", abs(bx["height"] - eb["height"]) < 30 and abs(bx["width"] - eb["width"]) < 30, f"sel={bx} el={eb}")
                await page.keyboard.press("Escape"); await page.wait_for_timeout(200)
            print("labels", labels)
            ok("distinct labels Text box 1/2/3", all(f"TEXT BOX {i}" in labels[f"body_{i}_html"].upper() for i in (1, 2, 3)))
            # inline edit box 2: append text
            el = await select(page, "body_2_html")
            await page.keyboard.press("Control+End")
            await page.keyboard.type(" TEST_EDIT2")
            await page.keyboard.press("Escape"); await page.wait_for_timeout(400)
            g1 = await page.evaluate(GEO)
            ok("inline edit box2 applied", "TEST_EDIT2" in g1["b2"]["txt"] + (await el.inner_text()), g1["b2"]["txt"])
            ok("box1 & box3 text unchanged after box2 edit", g1["b1"]["txt"] == g0["b1"]["txt"] and g1["b3"]["txt"] == g0["b3"]["txt"])
            # undo / redo
            await page.click('[data-testid="live-undo"]'); await page.wait_for_timeout(500)
            u = await page.evaluate(GEO)
            ok("undo reverts box2 edit", "TEST_EDIT2" not in (await page.locator(f'{SEL} [data-edit=body_2_html]').inner_text()), u["b2"]["txt"])
            await page.click('[data-testid="live-redo"]'); await page.wait_for_timeout(500)
            ok("redo restores box2 edit", "TEST_EDIT2" in (await page.locator(f'{SEL} [data-edit=body_2_html]').inner_text()))
            # style box 1 font size
            await select(page, "body_1_html")
            await page.fill('[data-testid="live-font-size"]', "24"); await page.wait_for_timeout(500)
            g2 = await page.evaluate(GEO); print("after fs", g2["b1"]["fs"], g2["b2"]["fs"], g2["b3"]["fs"])
            ok("font-size applies to box1 only", g2["b1"]["fs"] == "24px" and g2["b2"]["fs"] == g0["b2"]["fs"] and g2["b3"]["fs"] == g0["b3"]["fs"])
            await page.keyboard.press("Escape"); await page.wait_for_timeout(200)
            # move box 3
            await select(page, "body_3_html")
            gr = await page.locator('[data-testid="live-move-grip"]').bounding_box()
            sx, sy = gr["x"] + gr["width"] / 2, gr["y"] + gr["height"] / 2
            await page.mouse.move(sx, sy); await page.mouse.down()
            for i in range(1, 9):
                await page.mouse.move(sx + 10 * i, sy + 5 * i); await page.wait_for_timeout(30)
            await page.mouse.up(); await page.wait_for_timeout(500)
            g3 = await page.evaluate(GEO); print("after move", json.dumps(g3))
            ok("box3 moved", abs(g3["b3"]["x"] - g2["b3"]["x"]) > 30 or abs(g3["b3"]["y"] - g2["b3"]["y"]) > 15)
            ok("box1/box2 position unchanged after box3 move", all(abs(g3[k][a] - g2[k][a]) <= 2 for k in ("b1", "b2") for a in ("x", "y", "w")))
            await page.keyboard.press("Escape"); await page.wait_for_timeout(200)
            # multi-paragraph in box 3: Enter
            await select(page, "body_3_html")
            await page.keyboard.press("Control+End"); await page.keyboard.press("Enter"); await page.keyboard.type("TEST_PARA3")
            await page.keyboard.press("Escape"); await page.wait_for_timeout(400)
            await save(page)
            gs = await page.evaluate(GEO); print("after save", json.dumps(gs))
            pub_db = next(s for s in db.pages.find_one({"key": "rakhigarhi"})["published"]["sections"] if s["id"] == "1017b7e20a8648a0b3f8c546ed6f89d6")
            print("DB data", json.dumps(pub_db["data"])[:900]); print("DB styles", pub_db["styles"])
            d = pub_db["data"]
            ok("saved new shape (no body_html)", "body_html" not in d and all(f"body_{i}_html" in d for i in (1, 2, 3)))
            ok("box2 edit persisted", "TEST_EDIT2" in d.get("body_2_html", ""))
            ok("box3 multi paragraph persisted", "TEST_PARA3" in d.get("body_3_html", "") and d.get("body_3_html", "").count("<p") >= 2, d.get("body_3_html"))
            ok("box1 style persisted", pub_db["styles"].get("body_1_html", {}).get("fontSize") == "24px")
            ok("box3 translate persisted", "translateX" in pub_db["styles"].get("body_3_html", {}))
            ok("box1 text untouched", "The ambition reaches beyond" in d.get("body_1_html", ""))
            # fresh public load
            ctx2 = await b.new_context(viewport={"width": 1920, "height": 1080}); p2 = await ctx2.new_page()
            await p2.goto(BASE + "/our-work/rakhigarhi", wait_until="networkidle")
            await p2.evaluate("document.querySelector('#the-ambition .ambition-body').scrollIntoView({block:'center'})"); await p2.wait_for_timeout(2500)
            gp = await p2.evaluate(GEO); print("public", json.dumps(gp))
            ok("public shows edits", "TEST_EDIT2" in gp["b2"]["txt"] and gp["b1"]["fs"] == "24px")
            ok("public box3 position matches editor", abs(gp["b3"]["x"] - gs["b3"]["x"]) <= 3 and abs(gp["b3"]["y"] - gs["b3"]["y"]) <= 3, f'{gp["b3"]} vs {gs["b3"]}')
            await p2.locator("#the-ambition").screenshot(path="/tmp/amb_pub_after_edit.jpeg", quality=40, type="jpeg")
            # reset position of box 3 -> should re-center
            await select(page, "body_3_html")
            if await page.locator('[data-testid="live-reset-pos"]').count():
                await page.evaluate("document.querySelector('[data-testid=live-reset-pos]').closest('details').open = true")
                await page.wait_for_timeout(200)
                await page.click('[data-testid="live-reset-pos"]'); await page.wait_for_timeout(500)
                gr2 = await page.evaluate(GEO)
                lm = (gr2["b1"]["y"] + gr2["b2"]["y"] + gr2["b2"]["h"]) / 2; rm = gr2["b3"]["y"] + gr2["b3"]["h"] / 2
                ok("reset pos re-centers box3", abs(lm - rm) <= 3 and gr2["b3"]["x"] == g0["b3"]["x"], f"lm={lm} rm={rm} {gr2['b3']} vs {g0['b3']}")
            await page.keyboard.press("Escape"); await page.wait_for_timeout(200)
            # clear box 2 and re-add
            await select(page, "body_2_html")
            await page.keyboard.press("Control+a"); await page.keyboard.press("Delete")
            await page.keyboard.press("Escape"); await page.wait_for_timeout(400)
            await save(page)
            gc = await page.evaluate(GEO); print("after clear", json.dumps(gc))
            dd = next(s for s in db.pages.find_one({"key": "rakhigarhi"})["published"]["sections"] if s["id"] == "1017b7e20a8648a0b3f8c546ed6f89d6")["data"]
            print("cleared body_2_html in DB:", repr(dd.get("body_2_html")))
            ok("cleared box still selectable (h>0)", gc["b2"] and gc["b2"]["h"] > 5, gc["b2"])
            await select(page, "body_2_html")
            await page.keyboard.type("TEST_READDED")
            await page.keyboard.press("Escape"); await page.wait_for_timeout(400)
            await save(page)
            dd = next(s for s in db.pages.find_one({"key": "rakhigarhi"})["published"]["sections"] if s["id"] == "1017b7e20a8648a0b3f8c546ed6f89d6")["data"]
            ok("re-added text persisted", "TEST_READDED" in dd.get("body_2_html", ""), dd.get("body_2_html"))
            await page.screenshot(path="/tmp/amb_editor_final.jpeg", quality=40, type="jpeg")
            print("page errors", errs[:5])
            await b.close()
    except Exception as e:
        print("EXCEPTION", repr(e))
    finally:
        db.pages.replace_one({"_id": backup["_id"]}, backup); print("RESTORED rakhigarhi page doc")
        print(f"SUMMARY {sum(1 for _, v in R if v)}/{len(R)} passed; failed: {[n for n, v in R if not v]}")

asyncio.run(main())
