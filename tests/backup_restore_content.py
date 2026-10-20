# Backup/restore pages + site config so live-editor tests leave client content intact
import sys, os, json
from pymongo import MongoClient
from bson import json_util
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
PATH = "/tmp/content_backup.json"
COLS = ["pages", "site", "settings", "config", "notes"]
if sys.argv[1] == "backup":
    out = {c: list(db[c].find()) for c in db.list_collection_names() if c in COLS}
    open(PATH, "w").write(json_util.dumps(out))
    print({k: len(v) for k, v in out.items()}, db.list_collection_names())
elif sys.argv[1] == "diff":
    old = json_util.loads(open(PATH).read())
    for c, docs in old.items():
        for d in docs:
            cur = db[c].find_one({"_id": d["_id"]})
            a = {k: v for k, v in (cur or {}).items() if k not in ("updated_at", "published_at")}
            b = {k: v for k, v in d.items() if k not in ("updated_at", "published_at")}
            if json_util.dumps(a, sort_keys=True) != json_util.dumps(b, sort_keys=True):
                print("DIFF", c, d.get("key") or d.get("_id"))
    print("diff done")
elif sys.argv[1] == "restore":
    old = json_util.loads(open(PATH).read())
    for c, docs in old.items():
        for d in docs:
            db[c].replace_one({"_id": d["_id"]}, d, upsert=True)
    print("restored")
