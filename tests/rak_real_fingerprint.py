# Read-only fingerprint of the real rakhigarhi page doc + revision count (to verify tests never write it)
import os, json, hashlib, sys
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
d = db.pages.find_one({"key": "rakhigarhi"}, {"_id": 0})
h = hashlib.sha256(json.dumps(d, sort_keys=True, default=str).encode()).hexdigest()
revs = db.revisions.count_documents({"entity_id": "rakhigarhi"})
last = db.revisions.find_one({"entity_id": "rakhigarhi"}, sort=[("created_at", -1)], projection={"_id": 0, "by": 1, "created_at": 1, "action": 1})
print(json.dumps({"hash": h, "updated_at": str(d.get("updated_at")), "revisions": revs, "last_rev": last,
                  "test_docs": db.pages.count_documents({"key": {"$regex": "^TEST_rak_"}})}, default=str))
