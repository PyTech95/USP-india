# Iteration 28: diff desktop 1440/1920 captures (iter28_desktop_after.json) against iteration-27 baseline. Run: python3 /app/tests/iter28_desktop_diff.py
import json
from collections import Counter

base = json.load(open("/app/test_reports/responsive_desktop_baseline.json"))["captures"]
after = json.load(open("/app/test_reports/iter28_desktop_after.json"))
FONT = ("fs", "lh", "fw", "ff", "ls", "ta")
report = {}
for k, a in after.items():
    b = base.get(k)
    if not b or "error" in a:
        print(k, "missing/err"); continue
    r = {"docH": (b["docH"], a["docH"]), "font": [], "box": [], "sec": [], "img": [], "missing": []}
    for kind, field in (("texts", "box"), ("sections", "sec"), ("imgs", "img")):
        bc, ac = Counter(), Counter()
        bm, am = {}, {}
        for x in b[kind]:
            bc[x["k"]] += 1; bm[(x["k"], bc[x["k"]])] = x
        for x in a[kind]:
            ac[x["k"]] += 1; am[(x["k"], ac[x["k"]])] = x
        for key, bx in bm.items():
            ax = am.get(key)
            if not ax:
                r["missing"].append(kind + ":" + key[0]); continue
            d = [ax["box"][i] - bx["box"][i] for i in range(4)]
            if any(abs(v) > 2 for v in d):
                r[field].append((key[0], bx["box"], ax["box"], bx.get("txt", "")[:25]))
            if kind == "texts":
                fd = [f for f in FONT if bx.get(f) != ax.get(f)]
                if fd: r["font"].append((key[0], {f: (bx[f], ax[f]) for f in fd}))
            if kind == "imgs" and (bx.get("of") != ax.get("of") or bx.get("op") != ax.get("op")):
                r["img"].append((key[0], "objfit/pos", bx.get("of"), ax.get("of"), bx.get("op"), ax.get("op")))
    report[k] = r
    n = {x: len(r[x]) for x in ("font", "box", "sec", "img", "missing")}
    print(k, "docH", r["docH"], n)
json.dump(report, open("/app/test_reports/iter28_desktop_diff.json", "w"), indent=1)
for k in after:
    a, b = after[k].get("band"), base.get(k, {}).get("band")
    if a: print("BAND", k, "before", b and b["bandBox"], "after", a["bandBox"], "hero", a["heroBox"], "tf", a["bandTf"])
