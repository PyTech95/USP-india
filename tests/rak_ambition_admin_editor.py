# Playwright (ISOLATED): Admin PageEditor 3 rich fields for Rakhigarhi Ambition on a disposable clone TEST_rak_<uuid>.
# Never writes/restores the real rakhigarhi doc; only the clone + its revisions are deleted in finally.
import asyncio, os, copy, json, uuid, hashlib
from playwright.async_api import async_playwright
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env"); load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
SID = "1017b7e20a8648a0b3f8c546ed6f89d6"
KEY = f"TEST_rak_{uuid.uuid4().hex[:10]}"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
R = []
def ok(n, c, i=""): R.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n, i)
amb = lambda secs: next(s for s in secs if s["id"] == SID)
def fp(): return hashlib.sha256(json.dumps(db.pages.find_one({"key": "rakhigarhi"}, {"_id": 0}), sort_keys=True, default=str).encode()).hexdigest()

async def main():
    real_before = fp()
    src = db.pages.find_one({"key": "rakhigarhi"}, {"_id": 0})
    doc = copy.deepcopy(src); doc.update({"key": KEY, "id": uuid.uuid4().hex, "path": f"/{KEY}"}); db.pages.insert_one(doc)
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
            await page.goto(BASE + f"/admin/pages/{KEY}"); await page.wait_for_selector('[data-testid="page-status"]', timeout=20000)
            idx = [s["id"] for s in doc["draft"]["sections"]].index(SID)
            await page.click(f'[data-testid="section-{idx}-toggle"]'); await page.wait_for_timeout(600)
            rich = page.locator(f'[data-testid="section-{idx}"]').locator(".rt-editor")
            n = await rich.count(); ok("3 rich fields", n == 3)
            await rich.nth(1).click(); await page.keyboard.press("Control+End"); await page.keyboard.type(" TEST_DRAFT2")
            await page.click('[data-testid="page-save-draft-btn"]'); await page.wait_for_timeout(2000)
            d = db.pages.find_one({"key": KEY})
            dd = amb(d["draft"]["sections"])
            ok("draft new shape saved, box2 edited", "body_html" not in dd["data"] and "TEST_DRAFT2" in dd["data"].get("body_2_html", ""))
            ok("draft styles typography on boxes only", all(dd["styles"].get(f"body_{i}_html", {}).get("fontSize") == "18px" for i in (1, 2, 3)) and "fontSize" not in dd["styles"].get("body_html", {}), dd["styles"])
            ok("published untouched", amb(d["published"]["sections"]) == amb(doc["published"]["sections"]))
            p2 = await page.context.new_page()
            await p2.goto(BASE + f"/admin/preview/page/{KEY}"); await p2.wait_for_timeout(4000)
            info = await p2.evaluate("() => [...document.querySelectorAll('#the-ambition [data-edit^=body_]')].map(e=>[e.dataset.edit, e.innerText.slice(-20)])")
            ok("preview renders 3 boxes with draft edit", len(info) == 3 and "TEST_DRAFT2" in info[1][1], info)
            print("errors", errs[:3]); await b.close()
    except Exception as e:
        print("EXCEPTION", repr(e)); R.append(("exception", False))
    finally:
        db.pages.delete_many({"key": KEY}); db.revisions.delete_many({"entity_id": KEY})
        ok("real rakhigarhi doc unchanged", fp() == real_before)
        print(f"SUMMARY {sum(v for _, v in R)}/{len(R)} failed: {[n for n, v in R if not v]}")
asyncio.run(main())
