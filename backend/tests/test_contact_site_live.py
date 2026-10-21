# Contact page shared site settings: site_live_patch allowlist (contact.address/phone/email) tested IN-PROCESS
# against an ISOLATED cloned settings collection. Real db.settings is never written (fingerprinted before/after).
import os
import sys
import copy
import json
import uuid
import asyncio
import hashlib
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
sync = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
SUFFIX = uuid.uuid4().hex[:8]
SET_COLL, REV_COLL = f"TEST_settings_{SUFFIX}", f"TEST_revisions_{SUFFIX}"
USER = {"id": "TEST_user", "email": "admin@uspindia.org", "name": "TEST", "role": "admin"}


def _fp():
    return hashlib.sha256(json.dumps(sync.settings.find_one({"key": "site"}, {"_id": 0}), sort_keys=True, default=str).encode()).hexdigest()


@pytest.fixture(scope="module")
def env():
    before = _fp()
    src = copy.deepcopy(sync.settings.find_one({"key": "site"}, {"_id": 0}))
    sync[SET_COLL].insert_one(src)
    import routes_admin
    real_db = routes_admin.db

    class Proxy:
        def __getattr__(self, n):
            if n == "settings":
                return real_db[SET_COLL]
            if n == "revisions":
                return real_db[REV_COLL]
            return getattr(real_db, n)

        def __getitem__(self, n):
            return self.__getattr__(n)

    routes_admin.db = Proxy()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield {"mod": routes_admin, "loop": loop, "src": src}
    routes_admin.db = real_db
    sync.drop_collection(SET_COLL)
    sync.drop_collection(REV_COLL)
    assert _fp() == before, "REAL settings changed!"


def _call(env, path, value):
    m = env["mod"]
    return env["loop"].run_until_complete(m.site_live_patch(m.SiteLivePatch(path=path, value=value), USER))


# Address is newly allowlisted; multiline persists
def test_address_multiline_persists(env):
    val = "TEST House\nLine 2, Lane\nGurgaon 122009"
    r = _call(env, "contact.address", val)
    assert r == {"path": "contact.address", "value": val}
    doc = sync[SET_COLL].find_one({"key": "site"})
    assert doc["contact"]["address"] == val
    assert doc["contact"].get("email") == (env["src"].get("contact") or {}).get("email")  # sibling intact
    assert sync[REV_COLL].count_documents({"entity_id": "site"}) >= 1


def test_phone_and_email_persist(env):
    _call(env, "contact.phone", "+91 98100 00000")
    _call(env, "contact.email", "TEST_info@example.org")
    c = sync[SET_COLL].find_one({"key": "site"})["contact"]
    assert c["phone"] == "+91 98100 00000" and c["email"] == "TEST_info@example.org"
    assert c["address"].startswith("TEST House")


def test_blank_phone_allowed(env):
    _call(env, "contact.phone", "")
    assert sync[SET_COLL].find_one({"key": "site"})["contact"]["phone"] == ""


def test_non_allowlisted_rejected(env):
    from fastapi import HTTPException
    for bad in ["contact", "contact.secret", "theme.primary", "$set", "contact.address.x"]:
        with pytest.raises(HTTPException) as ex:
            _call(env, bad, "x")
        assert ex.value.status_code == 400


def test_http_requires_auth_and_rejects_bad_path():
    # No-write HTTP checks only (unauth & invalid path never touch real settings)
    r = requests.put(f"{BASE_URL}/api/admin/site-live", json={"path": "contact.address", "value": "x"}, headers={"Origin": BASE_URL})
    assert r.status_code in (401, 403)
    s = requests.Session()
    lr = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@uspindia.org", "password": "M-8iH7yaR-980GZW"}, headers={"Origin": BASE_URL})
    if lr.status_code != 200:
        pytest.skip("login failed")
    s.headers.update({"x-csrf-token": s.cookies.get("csrf_token") or "", "Origin": BASE_URL})
    r = s.put(f"{BASE_URL}/api/admin/site-live", json={"path": "contact.not_allowed", "value": "x"})
    assert r.status_code == 400


def test_public_settings_real_phone_empty():
    r = requests.get(f"{BASE_URL}/api/public/site")
    if r.status_code == 404:
        pytest.skip("public site endpoint differs")
    assert r.status_code == 200
    assert not (r.json().get("contact") or {}).get("phone"), "real phone should be empty (no fake seeded)"
