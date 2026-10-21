# Iter26: read-only baked bundle checksum check (no capture, no DB writes): 10 pages, no TEST_, haveli caption present
import sys
sys.path.insert(0, "/app/backend")
from content_sync.source import baked
from content_sync.schema import BUNDLE_FILE

bundle, ptr = baked()
keys = [p["key"] for p in bundle["collections"]["pages"]]
raw = BUNDLE_FILE.read_text()
note = [n for n in bundle["collections"]["notes"] if n["slug"] == "what-the-haveli-reveals"][0]
print("pages:", len(keys), "| TEST_ in file:", "TEST_" in raw, "| caption:", note["published"]["cover"].get("caption"))
assert len(keys) == 10 and "TEST_" not in raw and note["published"]["cover"]["caption"] == "Views from the restoration in progress"
print("PASS")
