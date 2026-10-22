"""Privacy-friendly website traffic statistics.

No cookies and no personal data: a visitor is counted with a daily-rotating hash of
(IP address + browser + date + secret), so the same person is one visitor per day
and cannot be followed across days. Raw page views are kept for 400 days.
"""
import hashlib
import os
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field

from core import db, current_user, JWT_SECRET, SITE_URL, log

router = APIRouter(prefix="/api")
TZ = ZoneInfo(os.environ.get("ANALYTICS_TZ", "Asia/Kolkata"))
SITE_HOST = urlsplit(SITE_URL).netloc.lower().removeprefix("www.")
BOTS = re.compile(r"bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|java/|go-http|axios|node-fetch|facebookexternalhit|whatsapp|telegram|discord|semrush|ahrefs|bing|yandex|baidu|gptbot|claude|perplexity|bytespider", re.I)
SEARCH = {"google": "Google", "bing": "Bing", "duckduckgo": "DuckDuckGo", "yahoo": "Yahoo", "ecosia": "Ecosia", "yandex": "Yandex", "baidu": "Baidu"}
SOCIAL = {"facebook": "Facebook", "fb.": "Facebook", "instagram": "Instagram", "linkedin": "LinkedIn", "lnkd.in": "LinkedIn", "t.co": "X / Twitter", "twitter": "X / Twitter",
          "x.com": "X / Twitter", "youtube": "YouTube", "whatsapp": "WhatsApp", "pinterest": "Pinterest", "reddit": "Reddit"}
AI = {"chatgpt": "ChatGPT", "openai": "ChatGPT", "perplexity": "Perplexity", "claude.ai": "Claude", "gemini.google": "Gemini", "copilot": "Copilot"}
TZ_COUNTRY = {
    "Asia/Kolkata": "India", "Asia/Calcutta": "India", "Asia/Dubai": "United Arab Emirates", "Asia/Karachi": "Pakistan", "Asia/Dhaka": "Bangladesh",
    "Asia/Kathmandu": "Nepal", "Asia/Colombo": "Sri Lanka", "Asia/Singapore": "Singapore", "Asia/Tokyo": "Japan", "Asia/Shanghai": "China",
    "Asia/Hong_Kong": "Hong Kong", "Asia/Riyadh": "Saudi Arabia", "Asia/Qatar": "Qatar", "Asia/Bangkok": "Thailand", "Asia/Jakarta": "Indonesia",
    "Asia/Kuala_Lumpur": "Malaysia", "Asia/Seoul": "South Korea", "Asia/Manila": "Philippines", "Europe/London": "United Kingdom",
    "Europe/Dublin": "Ireland", "Europe/Paris": "France", "Europe/Berlin": "Germany", "Europe/Amsterdam": "Netherlands", "Europe/Madrid": "Spain",
    "Europe/Rome": "Italy", "Europe/Zurich": "Switzerland", "Europe/Stockholm": "Sweden", "Europe/Brussels": "Belgium", "Europe/Vienna": "Austria",
    "Europe/Lisbon": "Portugal", "Europe/Oslo": "Norway", "Europe/Copenhagen": "Denmark", "Europe/Helsinki": "Finland", "Europe/Warsaw": "Poland",
    "America/New_York": "United States", "America/Chicago": "United States", "America/Denver": "United States", "America/Los_Angeles": "United States",
    "America/Phoenix": "United States", "America/Toronto": "Canada", "America/Vancouver": "Canada", "America/Sao_Paulo": "Brazil",
    "America/Mexico_City": "Mexico", "Australia/Sydney": "Australia", "Australia/Melbourne": "Australia", "Australia/Perth": "Australia",
    "Australia/Brisbane": "Australia", "Pacific/Auckland": "New Zealand", "Africa/Johannesburg": "South Africa", "Africa/Nairobi": "Kenya",
    "Africa/Lagos": "Nigeria", "Africa/Cairo": "Egypt",
}


class Hit(BaseModel):
    path: str = Field(max_length=300)
    ref: str = Field("", max_length=500)
    w: int = 0
    tz: str = Field("", max_length=60)
    utm_source: str = Field("", max_length=80)
    utm_medium: str = Field("", max_length=80)
    utm_campaign: str = Field("", max_length=120)


def _source(ref, utm):
    if utm:
        return utm.strip().lower()[:60]
    if not ref:
        return "Direct"
    host = urlsplit(ref).netloc.lower().removeprefix("www.")
    if not host or host == SITE_HOST or host.endswith("." + SITE_HOST):
        return "Direct"
    for k, v in {**AI, **SEARCH, **SOCIAL}.items():
        if k in host:
            return v
    return host[:80]


def _device(w, ua):
    if re.search(r"ipad|tablet", ua, re.I) or 600 <= w < 1024 and re.search(r"android|ipad", ua, re.I):
        return "Tablet"
    if re.search(r"mobi|iphone|android", ua, re.I) or 0 < w < 768:
        return "Mobile"
    return "Desktop"


def _browser(ua):
    for pat, name in ((r"edg/", "Edge"), (r"opr/|opera", "Opera"), (r"samsungbrowser", "Samsung Internet"), (r"firefox|fxios", "Firefox"),
                      (r"chrome|crios", "Chrome"), (r"safari", "Safari")):
        if re.search(pat, ua, re.I):
            return name
    return "Other"


def _os(ua):
    for pat, name in ((r"iphone|ipad|ios", "iOS"), (r"android", "Android"), (r"windows", "Windows"), (r"mac os|macintosh", "macOS"), (r"linux", "Linux")):
        if re.search(pat, ua, re.I):
            return name
    return "Other"


async def ensure_indexes():
    await db.pageviews.create_index("ts", expireAfterSeconds=400 * 86400)
    await db.pageviews.create_index([("day", 1), ("path", 1)])


@router.post("/public/track", status_code=204)
async def track(hit: Hit, request: Request):
    ua = request.headers.get("user-agent", "")
    path = "/" + hit.path.strip().lstrip("/").split("#")[0][:200]
    if not ua or BOTS.search(ua) or path.startswith(("/admin", "/api")) or request.cookies.get("access_token"):
        return Response(status_code=204)
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()
    stamp = datetime.now(timezone.utc)
    day = stamp.astimezone(TZ).strftime("%Y-%m-%d")
    visitor = hashlib.sha256(f"{ip}|{ua}|{day}|{JWT_SECRET}".encode()).hexdigest()[:20]
    if await db.pageviews.count_documents({"day": day, "v": visitor}) >= 300:
        return Response(status_code=204)
    await db.pageviews.insert_one({
        "ts": stamp, "day": day, "path": path.split("?")[0], "v": visitor,
        "src": _source(hit.ref, hit.utm_source), "campaign": hit.utm_campaign[:120],
        "device": _device(hit.w, ua), "browser": _browser(ua), "os": _os(ua),
        "country": TZ_COUNTRY.get(hit.tz, hit.tz.split("/")[-1].replace("_", " ") if "/" in hit.tz else "Unknown"),
        "lang": (request.headers.get("accept-language", "").split(",")[0].split(";")[0] or "")[:12],
    })
    return Response(status_code=204)


def _top(counter, n=10, key="name", val="visits"):
    return [{key: k, val: c} for k, c in counter.most_common(n)]


async def _period(start_day, end_day):
    docs = await db.pageviews.find({"day": {"$gte": start_day, "$lte": end_day}}, {"_id": 0, "day": 1, "path": 1, "v": 1, "src": 1, "device": 1, "browser": 1, "os": 1, "country": 1}).to_list(500000)
    return docs


@router.get("/admin/analytics")
async def analytics(days: int = 30, user=Depends(current_user)):
    days = days if days in (7, 30, 90, 365) else 30
    today = datetime.now(TZ).date()
    start = today - timedelta(days=days - 1)
    prev_start, prev_end = start - timedelta(days=days), start - timedelta(days=1)
    docs = await _period(start.isoformat(), today.isoformat())
    prev = await _period(prev_start.isoformat(), prev_end.isoformat())

    by_day = {(start + timedelta(days=i)).isoformat(): {"views": 0, "visitors": set()} for i in range(days)}
    pages, page_visitors = Counter(), {}
    visits = {}  # (day, visitor) -> first document of that visit
    for d in docs:
        slot = by_day.setdefault(d["day"], {"views": 0, "visitors": set()})
        slot["views"] += 1
        slot["visitors"].add(d["v"])
        pages[d["path"]] += 1
        page_visitors.setdefault(d["path"], set()).add(d["v"])
        visits.setdefault((d["day"], d["v"]), d)
    first = list(visits.values())
    visitors = len(visits)
    prev_visitors = len({(d["day"], d["v"]) for d in prev})

    since = datetime.combine(start, datetime.min.time(), TZ).astimezone(timezone.utc).isoformat()
    prev_since = datetime.combine(prev_start, datetime.min.time(), TZ).astimezone(timezone.utc).isoformat()
    enquiries = await db.enquiries.count_documents({"created_at": {"$gte": since}})
    prev_enquiries = await db.enquiries.count_documents({"created_at": {"$gte": prev_since, "$lt": since}})
    live_since = datetime.now(timezone.utc) - timedelta(minutes=30)
    live = len({d["v"] for d in await db.pageviews.find({"ts": {"$gte": live_since}}, {"_id": 0, "v": 1}).to_list(10000)})

    return {
        "days": days, "from": start.isoformat(), "to": today.isoformat(), "live_visitors": live,
        "totals": {"visitors": visitors, "pageviews": len(docs), "pages_per_visit": round(len(docs) / visitors, 1) if visitors else 0, "enquiries": enquiries},
        "previous": {"visitors": prev_visitors, "pageviews": len(prev), "enquiries": prev_enquiries},
        "series": [{"day": k, "views": v["views"], "visitors": len(v["visitors"])} for k, v in sorted(by_day.items())],
        "top_pages": [{"path": p, "views": c, "visitors": len(page_visitors[p])} for p, c in pages.most_common(12)],
        "sources": _top(Counter(d["src"] for d in first)),
        "devices": _top(Counter(d["device"] for d in first), 5),
        "browsers": _top(Counter(d["browser"] for d in first), 6),
        "systems": _top(Counter(d["os"] for d in first), 6),
        "countries": _top(Counter(d["country"] for d in first), 10),
    }


async def visitors_last(days=7):
    today = datetime.now(TZ).date()
    start = (today - timedelta(days=days - 1)).isoformat()
    docs = await db.pageviews.find({"day": {"$gte": start}}, {"_id": 0, "day": 1, "v": 1}).to_list(500000)
    return {"visitors": len({(d["day"], d["v"]) for d in docs}), "pageviews": len(docs)}
