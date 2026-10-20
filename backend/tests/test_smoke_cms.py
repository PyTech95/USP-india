# Smoke tests for USP India CMS: health, public content, enquiries, admin auth + CRUD
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@uspindia.org"
ADMIN_PASSWORD = "M-8iH7yaR-980GZW"
PAGE_KEYS = ["home", "about", "our-work", "rakhigarhi", "theatre", "craft-livelihood", "workshops-learning", "field-notes", "connect"]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, headers={"Origin": BASE_URL})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    s.headers.update({"x-csrf-token": s.cookies.get("csrf_token"), "Origin": BASE_URL})
    return s


# Health
def test_health():
    r = requests.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200 and r.json()["ok"] is True


# Public content
def test_public_site():
    d = requests.get(f"{BASE_URL}/api/public/site").json()
    assert d["site_name"] and isinstance(d["menus"]["main"], list) and len(d["menus"]["main"]) > 0


@pytest.mark.parametrize("key", PAGE_KEYS)
def test_public_pages(key):
    r = requests.get(f"{BASE_URL}/api/public/pages/{key}")
    assert r.status_code == 200, r.text
    assert isinstance(r.json()["content"]["sections"], list)


def test_public_notes_and_detail_and_media():
    d = requests.get(f"{BASE_URL}/api/public/notes").json()
    assert d["total"] > 0
    n = d["items"][0]
    r = requests.get(f"{BASE_URL}/api/public/notes/{n['slug']}")
    assert r.status_code == 200 and r.json()["note"]["title"] == n["title"]
    cover = n.get("cover")
    if cover:
        img = requests.get(BASE_URL + cover["srcs"][0]["url"])
        assert img.status_code == 200 and img.headers["content-type"].startswith("image")


def test_note_404():
    assert requests.get(f"{BASE_URL}/api/public/notes/does-not-exist-xyz").status_code == 404


# Auth
def test_login_bad_password():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "nobody_test@example.com", "password": "x"})
    assert r.status_code == 401


def test_me(admin):
    r = admin.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200 and r.json()["email"] == ADMIN_EMAIL


def test_csrf_required(admin):
    r = requests.post(f"{BASE_URL}/api/admin/notes", cookies=admin.cookies.get_dict(), json={"title": "x", "slug": "x"})
    assert r.status_code == 403


# Admin list endpoints
@pytest.mark.parametrize("path", ["dashboard", "pages", "notes", "media", "settings", "enquiries", "users", "redirects"])
def test_admin_lists(admin, path):
    r = admin.get(f"{BASE_URL}/api/admin/{path}")
    assert r.status_code == 200, r.text


# Enquiry -> admin
def test_enquiry_flow(admin):
    payload = {"name": "TEST_Smoke", "email": "test_smoke@example.com", "topic": "General",
               "message": "TEST smoke enquiry message", "elapsed_ms": 5000}
    r = requests.post(f"{BASE_URL}/api/public/enquiries", json=payload)
    assert r.status_code == 200, r.text
    eid = r.json()["id"]
    items = admin.get(f"{BASE_URL}/api/admin/enquiries").json()
    assert any(e["id"] == eid and e["name"] == "TEST_Smoke" for e in items)
    assert admin.delete(f"{BASE_URL}/api/admin/enquiries/{eid}").status_code == 200


def test_enquiry_bot_rejected():
    r = requests.post(f"{BASE_URL}/api/public/enquiries", json={"name": "x", "email": "a@b.com", "topic": "General", "message": "1234567890", "elapsed_ms": 100})
    assert r.status_code == 400


# Admin note create/update/delete
def test_note_crud(admin):
    slug = f"test-smoke-{int(time.time())}"
    r = admin.post(f"{BASE_URL}/api/admin/notes", json={"title": "TEST_Note", "slug": slug})
    assert r.status_code == 200, r.text
    nid = r.json()["id"]
    try:
        r = admin.put(f"{BASE_URL}/api/admin/notes/{nid}", json={"title": "TEST_Note Updated", "slug": slug})
        assert r.status_code == 200, r.text
        g = admin.get(f"{BASE_URL}/api/admin/notes/{nid}").json()
        assert g["draft"]["title"] == "TEST_Note Updated"
    finally:
        assert admin.delete(f"{BASE_URL}/api/admin/notes/{nid}").status_code == 200
    assert admin.get(f"{BASE_URL}/api/admin/notes/{nid}").status_code == 404
