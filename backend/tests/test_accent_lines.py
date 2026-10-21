# Red accent line settings: /api/admin/site-styles validation of accentLineWidth/Thickness/Gap + persistence via public site
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@uspindia.org", "password": "M-8iH7yaR-980GZW"}, headers={"Origin": BASE_URL})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    s.headers.update({"x-csrf-token": s.cookies.get("csrf_token"), "Origin": BASE_URL})
    original = requests.get(f"{BASE_URL}/api/public/site").json().get("header_styles") or {}
    yield s
    s.put(f"{BASE_URL}/api/admin/site-styles", json={"styles": original})


def test_valid_accent_values_persist(admin):
    r = admin.put(f"{BASE_URL}/api/admin/site-styles", json={"styles": {"accentLineWidth": "60px", "accentLineThickness": "3px", "accentLineGap": "20px"}})
    assert r.status_code == 200
    assert r.json()["header_styles"] == {"accentLineWidth": "60px", "accentLineThickness": "3px", "accentLineGap": "20px"}
    pub = requests.get(f"{BASE_URL}/api/public/site").json()["header_styles"]
    assert pub["accentLineWidth"] == "60px" and pub["accentLineThickness"] == "3px" and pub["accentLineGap"] == "20px"


@pytest.mark.parametrize("key,val", [("accentLineWidth", "4px"), ("accentLineWidth", "300px"), ("accentLineThickness", "0px"),
                                     ("accentLineThickness", "13px"), ("accentLineGap", "121px"), ("accentLineGap", "10em"),
                                     ("accentLineWidth", "40px; color:red")])
def test_invalid_accent_values_rejected(admin, key, val):
    r = admin.put(f"{BASE_URL}/api/admin/site-styles", json={"styles": {key: val}})
    assert r.status_code == 400
    assert key in r.json().get("detail", "")


def test_empty_values_clear_to_default(admin):
    r = admin.put(f"{BASE_URL}/api/admin/site-styles", json={"styles": {"accentLineWidth": "", "accentLineThickness": None, "accentLineGap": ""}})
    assert r.status_code == 200
    assert r.json()["header_styles"] == {}


def test_requires_auth():
    r = requests.put(f"{BASE_URL}/api/admin/site-styles", json={"styles": {"accentLineWidth": "60px"}}, headers={"Origin": BASE_URL})
    assert r.status_code in (401, 403)
