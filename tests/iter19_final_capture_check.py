# Iter19 post-test: remove any leftover TEST_ clone pages, then run existing content_sync.source.capture(core.db) and verify packaged bundle (10 pages, no TEST)
import asyncio, json, sys
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
import core
from content_sync.source import capture, baked
from content_sync.schema import BUNDLE_FILE

async def main():
    left = await core.db.pages.count_documents({"key": {"$regex": "^TEST_"}})
    print("leftover TEST pages before cleanup:", left)
    if left:
        await core.db.pages.delete_many({"key": {"$regex": "^TEST_"}})
    st = await capture(core.db)
    print("capture:", {k: st.get(k) for k in ("state", "release_id", "captured_at", "counts")})
    bundle, ptr = baked()
    keys = [p["key"] for p in bundle["collections"]["pages"]]
    raw = BUNDLE_FILE.read_text()
    print("baked pages:", len(keys), keys)
    print("checksum ok + source ok (baked() raised nothing); TEST_ in file:", "TEST_" in raw)
    assert len(keys) == 10 and not any(k.startswith("TEST") for k in keys) and "TEST_" not in raw

asyncio.run(main())
