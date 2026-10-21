# Iter26: pure in-memory merge_bundle check using real stored note shape (draft/published) from read-only baked bundle.
# baseline/incoming have restored caption; live has caption + standfirst 22px; next release change preserves both. No DB/deploy.
import copy, sys
sys.path.insert(0, "/app/backend")
from content_sync.merge import merge_bundle
from content_sync.source import baked

CAP = "Views from the restoration in progress"
base_bundle, _ = baked()
baseline = copy.deepcopy(base_bundle)
idx = [i for i, n in enumerate(baseline["collections"]["notes"]) if n["slug"] == "what-the-haveli-reveals"][0]
assert baseline["collections"]["notes"][idx]["published"]["cover"]["caption"] == CAP

live = copy.deepcopy(baseline)
ln = live["collections"]["notes"][idx]
for side in ("published", "draft"):
    ln[side]["styles"] = {"standfirst": {"fontSize": "22px"}}

incoming = copy.deepcopy(baseline)
inn = incoming["collections"]["notes"][idx]
inn["published"]["title"] = inn["published"]["title"] + " (next release)"

out, preserved = merge_bundle(baseline, live, incoming)
r = [n for n in out["collections"]["notes"] if n["slug"] == "what-the-haveli-reveals"][0]
print("caption:", r["published"]["cover"]["caption"], "| styles:", r["published"]["styles"], "| title:", r["published"]["title"], "| preserved:", preserved)
assert r["published"]["cover"]["caption"] == CAP and r["draft"]["cover"]["caption"] == CAP
assert r["published"]["styles"]["standfirst"]["fontSize"] == "22px"
assert r["published"]["title"].endswith("(next release)")
assert len(out["collections"]["pages"]) == len(base_bundle["collections"]["pages"])
print("PASS")
