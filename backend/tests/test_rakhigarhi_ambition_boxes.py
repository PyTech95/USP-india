# Rakhigarhi "The Ambition" 3 boxes + live_save optimistic concurrency (base_version / atomic CAS).
# ISOLATED: every test works on a disposable clone (key TEST_rak_<uuid>). The real rakhigarhi doc is READ-ONLY here.
import os
import copy
import uuid
import asyncio
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SID = "1017b7e20a8648a0b3f8c546ed6f89d6"
_LOOP = asyncio.new_event_loop()
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _clone(key):
    src = db.pages.find_one({"key": "rakhigarhi"}, {"_id": 0})  # read-only
    assert src, "rakhigarhi page missing"
    doc = copy.deepcopy(src)
    doc.update({"key": key, "id": uuid.uuid4().hex, "path": f"/{key}"})
    db.pages.insert_one(doc)
    return src


def _cleanup(key):
    assert key.startswith("TEST_rak_")
    db.pages.delete_many({"key": key})
    db.revisions.delete_many({"entity_id": key})


@pytest.fixture(scope="module")
def page():
    key = f"TEST_rak_{uuid.uuid4().hex[:10]}"
    src = _clone(key)
    yield {"key": key, "src": src}
    _cleanup(key)  # only the disposable doc + its revisions


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@uspindia.org", "password": "M-8iH7yaR-980GZW"}, headers={"Origin": BASE_URL})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    s.headers.update({"x-csrf-token": s.cookies.get("csrf_token"), "Origin": BASE_URL})
    return s


def _amb(sections):
    return next(s for s in sections if s["id"] == SID)


def _live(admin, key):
    r = admin.get(f"{BASE_URL}/api/admin/pages/{key}/live")
    assert r.status_code == 200, r.text
    j = r.json()
    assert isinstance(j.get("version"), str) and len(j["version"]) == 64
    return j


def _published(key):
    return db.pages.find_one({"key": key}, {"_id": 0})["published"]


# --- 3 boxes roundtrip / sanitize ---
def test_live_save_three_boxes_roundtrip_and_sanitize(admin, page):
    key = page["key"]
    j = _live(admin, key)
    sections = j["content"]["sections"]
    sec = _amb(sections)
    data = {k: v for k, v in sec["data"].items() if k != "body_html"}
    data["body_1_html"] = '<p>TEST_box one <a href="https://example.org">link</a></p>'
    data["body_2_html"] = "<p>TEST_box two<script>alert(1)</script></p>"
    data["body_3_html"] = '<p onclick="x()">TEST_box three <strong>bold</strong></p>'
    sec["data"] = data
    sec["styles"] = {"body_1_html": {"fontSize": "18px"}, "body_3_html": {"fontSize": "18px", "translateX": "12px"},
                     "body_2_html": {"color": "red; background:url(x)"}}
    r = admin.put(f"{BASE_URL}/api/admin/pages/{key}/live", json={"sections": sections, "base_version": j["version"]})
    assert r.status_code == 200, r.text
    assert r.json()["version"] != j["version"]
    d = _amb(_published(key)["sections"])
    assert "body_html" not in d["data"]
    assert "<script" not in d["data"]["body_2_html"] and "onclick" not in d["data"]["body_3_html"]
    assert "body_2_html" not in d["styles"]
    pub = requests.get(f"{BASE_URL}/api/public/pages/{key}").json()
    assert "TEST_box one" in _amb(pub["content"]["sections"])["data"]["body_1_html"]


# --- empty box persists as "" ---
def test_live_save_empty_box_ok(admin, page):
    key = page["key"]
    j = _live(admin, key)
    sections = j["content"]["sections"]
    _amb(sections)["data"]["body_2_html"] = ""
    r = admin.put(f"{BASE_URL}/api/admin/pages/{key}/live", json={"sections": sections, "base_version": j["version"]})
    assert r.status_code == 200, r.text
    assert _amb(_published(key)["sections"])["data"]["body_2_html"] == ""


# --- optimistic concurrency: version is stable & matches after save ---
def test_version_stable_and_returned_after_save(admin, page):
    key = page["key"]
    v1 = _live(admin, key)["version"]
    v2 = _live(admin, key)["version"]
    assert v1 == v2
    j = _live(admin, key)
    r = admin.put(f"{BASE_URL}/api/admin/pages/{key}/live", json={"sections": j["content"]["sections"], "base_version": j["version"]})
    assert r.status_code == 200
    assert r.json()["version"] == _live(admin, key)["version"]


# --- two editors share version A; second (stale) save -> 409, nothing written ---
def test_stale_save_returns_409_and_writes_nothing(admin, page):
    key = page["key"]
    a = _live(admin, key)
    b = copy.deepcopy(a)
    secs_a = a["content"]["sections"]
    _amb(secs_a)["data"]["body_1_html"] = "<p>TEST_EDITOR_A</p>"
    ra = admin.put(f"{BASE_URL}/api/admin/pages/{key}/live", json={"sections": secs_a, "base_version": a["version"]})
    assert ra.status_code == 200
    before = _published(key)
    revs = db.revisions.count_documents({"entity_id": key})
    secs_b = b["content"]["sections"]
    _amb(secs_b)["data"]["body_1_html"] = "<p>TEST_EDITOR_B_STALE</p>"
    rb = admin.put(f"{BASE_URL}/api/admin/pages/{key}/live", json={"sections": secs_b, "base_version": b["version"]})
    assert rb.status_code == 409
    assert "changed in another editor" in rb.json().get("detail", "")
    assert _published(key) == before
    assert db.revisions.count_documents({"entity_id": key}) == revs
    # fresh editor still saves; repeated saves in same current editor work
    c = _live(admin, key)
    secs_c = c["content"]["sections"]
    _amb(secs_c)["data"]["body_1_html"] = "<p>TEST_EDITOR_C1</p>"
    r1 = admin.put(f"{BASE_URL}/api/admin/pages/{key}/live", json={"sections": secs_c, "base_version": c["version"]})
    assert r1.status_code == 200
    secs_c2 = r1.json()["content"]["sections"]
    _amb(secs_c2)["data"]["body_1_html"] = "<p>TEST_EDITOR_C2</p>"
    r2 = admin.put(f"{BASE_URL}/api/admin/pages/{key}/live", json={"sections": secs_c2, "base_version": r1.json()["version"]})
    assert r2.status_code == 200
    assert "TEST_EDITOR_C2" in _amb(_published(key)["sections"])["data"]["body_1_html"]


# --- legacy request without base_version still accepted ---
def test_legacy_save_without_base_version(admin, page):
    key = page["key"]
    secs = _live(admin, key)["content"]["sections"]
    _amb(secs)["data"]["body_1_html"] = "<p>TEST_LEGACY</p>"
    r = admin.put(f"{BASE_URL}/api/admin/pages/{key}/live", json={"sections": secs})
    assert r.status_code == 200
    assert "TEST_LEGACY" in _amb(_published(key)["sections"])["data"]["body_1_html"]


def test_live_save_requires_auth(page):
    r = requests.put(f"{BASE_URL}/api/admin/pages/{page['key']}/live", json={"sections": []}, headers={"Origin": BASE_URL})
    assert r.status_code in (401, 403)


# --- in-process race regression: write lands between validation read and CAS update ---
@pytest.mark.parametrize("with_version", [True, False])
def test_atomic_cas_race_in_process(monkeypatch, with_version):
    import sys
    sys.path.insert(0, "/app/backend")
    import routes_admin
    from fastapi import HTTPException
    key = f"TEST_rak_{uuid.uuid4().hex[:10]}"
    _clone(key)
    try:
        async def run():
            real_get_page = routes_admin.get_page
            stale = await real_get_page(key)
            version = routes_admin.live_page_version(stale["published"])

            async def racing_get_page(k):
                p = await real_get_page(k)
                # concurrent editor writes after this read but before live_save's CAS update
                await routes_admin.db.pages.update_one({"key": k}, {"$set": {"published.title": "TEST_CONCURRENT_WRITE"}})
                return p
            monkeypatch.setattr(routes_admin, "get_page", racing_get_page)
            body = {"sections": copy.deepcopy(stale["published"]["sections"]), "title": "TEST_RACE_LOSER"}
            if with_version:
                body["base_version"] = version
            with pytest.raises(HTTPException) as ei:
                await routes_admin.live_save(key, body, {"email": "test@local"})
            return ei.value.status_code
        code = _LOOP.run_until_complete(run())  # motor binds to the first loop; reuse one loop
        assert code == 409
        doc = db.pages.find_one({"key": key})
        assert doc["published"]["title"] == "TEST_CONCURRENT_WRITE"
        assert db.revisions.count_documents({"entity_id": key}) == 0
    finally:
        _cleanup(key)
