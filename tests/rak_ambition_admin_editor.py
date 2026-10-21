# Playwright: Admin PageEditor shows 3 rich fields for Rakhigarhi Ambition; draft save keeps other boxes; preview renders; published untouched
import asyncio, os, copy, json
from playwright.async_api import async_playwright
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
BASE = "https://launch-pad-462.preview.emergentagent.com"
SID = "1017b7e20a8648a0b3f8c546ed6f89d6"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
R = []
def ok(n, c, i=""): R.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n, i)
amb = lambda secs: next(s for s in secs if s["id"] == SID)

async def main():
    backup = copy.deepcopy(db.pages.find_one({"key": "rakhigarhi"}))
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            page = await (await b.new_context(viewport={"width": 1920, "height": 1080})).new_page()
            errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
            await page.goto(BASE + "/admin/login")
            await page.fill('[data-testid="login-email"]', "admin@uspindia.org")
            await page.fill('[data-testid="login-password"]', "M-8iH7yaR-980GZW")
            await page.click('[data-testid="login-submit"]')
            await page.wait_for_url("**/admin**", timeout=15000); await page.wait_for_timeout(1000)
            await page.goto(BASE + "/admin/pages/rakhigarhi"); await page.wait_for_selector('[data-testid="page-status"]', timeout=20000)
            idx = [s["id"] for s in backup["draft"]["sections"]].index(SID)
            await page.click(f'[data-testid="section-{idx}-toggle"]'); await page.wait_for_timeout(600)
            card = page.locator(f'[data-testid="section-{idx}"]')
            rich = card.locator(".rt-editor")
            n = await rich.count()
            tids = [await rich.nth(i).get_attribute("data-testid") for i in range(n)]
            labels = [await rich.nth(i).get_attribute("aria-label") for i in range(n)]
            ok("3 rich fields", n == 3, f"{tids} {labels}")
            texts = [await rich.nth(i).inner_text() for i in range(n)]
            ok("rich fields prefilled from body_html split", n == 3 and "The ambition reaches" in texts[0] and "If that activity" in texts[1] and "What begins" in texts[2], [t[:30] for t in texts])
            await page.screenshot(path="/tmp/admin_amb_fields.jpeg", quality=40, type="jpeg")
            await rich.nth(1).click(); await page.keyboard.press("Control+End"); await page.keyboard.type(" TEST_DRAFT2")
            await page.click('[data-testid="page-save-draft-btn"]'); await page.wait_for_timeout(2000)
            doc = db.pages.find_one({"key": "rakhigarhi"})
            d = amb(doc["draft"]["sections"])["data"]
            ok("draft new shape saved", "body_html" not in d and all(f"body_{i}_html" in d for i in (1, 2, 3)), list(d.keys()))
            ok("draft box2 edited, others intact", "TEST_DRAFT2" in d.get("body_2_html", "") and "The ambition reaches" in d.get("body_1_html", "") and "What begins" in d.get("body_3_html", ""))
            ok("published untouched", amb(doc["published"]["sections"]) == amb(backup["published"]["sections"]))
            ok("draft styles copied typography", amb(doc["draft"]["sections"]).get("styles"), amb(doc["draft"]["sections"]).get("styles"))
            p2 = await page.context.new_page()
            await p2.goto(BASE + "/admin/preview/page/rakhigarhi"); await p2.wait_for_timeout(4000)
            info = await p2.evaluate("""() => [...document.querySelectorAll('#the-ambition [data-edit^=body_]')].map(e=>[e.dataset.edit, e.innerText.slice(-20)])""")
            ok("preview renders 3 boxes with draft edit", len(info) == 3 and "TEST_DRAFT2" in info[1][1], info)
            # public still old content
            p3 = await (await b.new_context()).new_page()
            await p3.goto(BASE + "/our-work/rakhigarhi", wait_until="networkidle"); await p3.wait_for_timeout(1500)
            pub = await p3.evaluate("() => document.querySelector('#the-ambition').innerText")
            ok("public not showing draft edit", "TEST_DRAFT2" not in pub and "What begins" in pub)
            print("errors", errs[:3]); await b.close()
    except Exception as e:
        print("EXCEPTION", repr(e))
    finally:
        db.pages.replace_one({"_id": backup["_id"]}, backup); print("RESTORED")
        print(f"SUMMARY {sum(v for _, v in R)}/{len(R)} failed: {[n for n, v in R if not v]}")
asyncio.run(main())
