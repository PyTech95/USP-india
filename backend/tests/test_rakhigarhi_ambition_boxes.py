# Rakhigarhi "The Ambition" 3 independent text boxes: live_save roundtrip, sanitization, styles, SSR (old + new shape)
import os
import copy
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SID = "1017b7e20a8648a0b3f8c546ed6f89d6"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def backup():
    doc = db.pages.find_one({"key": "rakhigarhi"})
    assert doc, "rakhigarhi page missing"
    yield copy.deepcopy(doc)
    db.pages.replace_one({"_id": doc["_id"]}, doc)  # always restore full doc (published+draft+flags)


@pytest.fixture(scope="module")
def admin(backup):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@uspindia.org", "password": "M-8iH7yaR-980GZW"}, headers={"Origin": BASE_URL})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    s.headers.update({"x-csrf-token": s.cookies.get("csrf_token"), "Origin": BASE_URL})
    return s


def _ambition(sections):
    return next(s for s in sections if s["id"] == SID)


def _ssr():
    r = requests.get(f"{BASE_URL}/api/ssr", params={"path": "/our-work/rakhigarhi"})
    assert r.status_code == 200
    try:
        j = r.json()
        return j.get("html") or str(j)
    except ValueError:
        return r.text


def test_ssr_old_shape_renders_body_html(backup):
    sec = _ambition(backup["published"]["sections"])
    if "body_1_html" in sec["data"]:
        pytest.skip("already in new shape")
    html = _ssr()
    assert "The ambition reaches beyond the restoration" in html
    assert "What begins with one haveli" in html


def test_live_save_three_boxes_roundtrip_and_sanitize(admin, backup):
    live = admin.get(f"{BASE_URL}/api/admin/pages/rakhigarhi/live")
    assert live.status_code == 200
    sections = live.json()["content"]["sections"]
    sec = _ambition(sections)
    data = {k: v for k, v in sec["data"].items() if k != "body_html"}
    data["body_1_html"] = '<p>TEST_box one <a href="https://example.org">link</a></p><p>second para</p>'
    data["body_2_html"] = "<p>TEST_box two<script>alert(1)</script></p>"
    data["body_3_html"] = '<p onclick="x()">TEST_box three <strong>bold</strong></p>'
    sec["data"] = data
    sec["styles"] = {**(sec.get("styles") or {}),
                     "body_1_html": {"fontSize": "18px"},
                     "body_3_html": {"fontSize": "18px", "translateX": "12px", "translateY": "-8px", "width": "400px"},
                     "body_2_html": {"color": "red; background:url(x)"}}
    r = admin.put(f"{BASE_URL}/api/admin/pages/rakhigarhi/live", json={"sections": sections})
    assert r.status_code == 200, r.text
    pub = requests.get(f"{BASE_URL}/api/public/pages/rakhigarhi").json()
    psec = _ambition(pub["content"]["sections"] if "content" in pub else pub["sections"])
    d, st = psec["data"], psec["styles"]
    assert "body_html" not in d
    assert "TEST_box one" in d["body_1_html"] and 'href="https://example.org"' in d["body_1_html"] and "second para" in d["body_1_html"]
    assert "TEST_box two" in d["body_2_html"] and "<script" not in d["body_2_html"]
    assert "<strong>bold</strong>" in d["body_3_html"] and "onclick" not in d["body_3_html"]
    assert st["body_3_html"] == {"fontSize": "18px", "translateX": "12px", "translateY": "-8px", "width": "400px"}
    assert "body_2_html" not in st  # malicious style rejected
    # draft mirrors published after live save (no dirty draft)
    doc = db.pages.find_one({"key": "rakhigarhi"})
    assert doc["has_unpublished_changes"] is False
    assert _ambition(doc["draft"]["sections"])["data"]["body_3_html"] == d["body_3_html"]
    html = _ssr()
    assert "TEST_box one" in html and "TEST_box two" in html and "TEST_box three" in html
    assert "<script>alert" not in html
    # other sections untouched
    old = {s["id"]: s for s in backup["published"]["sections"] if s["id"] != SID}
    for s in doc["published"]["sections"]:
        if s["id"] in old:
            assert s["data"] == old[s["id"]]["data"], s["id"]


def test_live_save_empty_box_ok(admin):
    sections = admin.get(f"{BASE_URL}/api/admin/pages/rakhigarhi/live").json()["content"]["sections"]
    sec = _ambition(sections)
    sec["data"]["body_2_html"] = ""
    r = admin.put(f"{BASE_URL}/api/admin/pages/rakhigarhi/live", json={"sections": sections})
    assert r.status_code == 200
    d = _ambition(requests.get(f"{BASE_URL}/api/public/pages/rakhigarhi").json()["content"]["sections"])["data"]
    assert d["body_2_html"] == "" and "TEST_box one" in d["body_1_html"] and "TEST_box three" in d["body_3_html"]


def test_live_save_requires_auth():
    r = requests.put(f"{BASE_URL}/api/admin/pages/rakhigarhi/live", json={"sections": []}, headers={"Origin": BASE_URL})
    assert r.status_code in (401, 403)
