import re
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from fastapi.responses import Response, HTMLResponse
from pydantic import BaseModel, EmailStr, Field
from core import db, now, new_id, resolve_media_tree, media_public_ok, media_public_view, ip_hash, PAGE_PATHS, SITE_URL

router = APIRouter(prefix="/api")
PER_PAGE = 9
TOPICS = ["General", "Collaboration", "Volunteer", "Craft", "Theatre", "Workshops & Learning"]


async def get_site():
    s = await db.settings.find_one({"key": "site"}, {"_id": 0, "checklist": 0, "taxonomy": 0, "email_notifications": 0})
    out = {k: s.get(k) for k in ("site_name", "full_name", "tagline", "theme", "footer_text", "privacy_html", "contact", "social", "menus", "preview_banner", "indexing_enabled", "live_editor_enabled")}
    out["brand_label"] = s.get("brand_label", "USP")
    out["ui_text"] = s.get("ui_text", {})
    out["header_styles"] = s.get("header_styles") or {}
    out["text_styles"] = s.get("text_styles") or {}
    for f in ("logo_media_id", "favicon_media_id", "default_share_media_id"):
        m = await db.media.find_one({"id": s.get(f)}, {"_id": 0}) if s.get(f) else None
        out[f.replace("_media_id", "")] = media_public_view(m) if media_public_ok(m) else None
    out["categories"] = (await db.settings.find_one({"key": "site"}, {"taxonomy": 1}))["taxonomy"]["categories"]
    return out


def note_card(n, cover):
    p = n["published"]
    cover = cover or {}
    return {"slug": n["slug"], "title": p["title"], "standfirst": p.get("standfirst", ""), "summary": p.get("seo", {}).get("description") or p.get("standfirst", ""),
            "kind": p.get("kind"), "category": p.get("category"), "author": p.get("author"), "published_at": n.get("published_at"),
            "updated_at": n.get("updated_at"), "cover": cover.get("media"), "secondary": (cover.get("secondary") or {}).get("media"),
            "gallery": [g["media"] for g in cover.get("gallery") or [] if isinstance(g, dict) and g.get("media")], "caption": cover.get("caption", "")}


async def cards(notes):
    resolved = await resolve_media_tree([n["published"].get("cover", {}) for n in notes])
    return [note_card(n, c) for n, c in zip(notes, resolved)]


async def list_notes(q="", category="", tag="", page=1, per=PER_PAGE, exclude=None):
    f = {"status": "published"}
    if category:
        f["published.category"] = category
    if tag:
        f["published.tags"] = tag
    if q:
        rx = {"$regex": re.escape(q[:100]), "$options": "i"}
        f["$or"] = [{"published.title": rx}, {"published.standfirst": rx}, {"published.body_html": rx}, {"published.tags": rx}]
    if exclude:
        f["slug"] = {"$ne": exclude}
    total = await db.notes.count_documents(f)
    page = max(1, page)
    docs = await db.notes.find(f, {"_id": 0}).sort("published_at", -1).skip((page - 1) * per).limit(per).to_list(per)
    return {"items": await cards(docs), "total": total, "page": page, "pages": max(1, -(-total // per))}


async def public_page(key):
    p = await db.pages.find_one({"key": key, "status": "published"}, {"_id": 0})
    if not p:
        return None
    content = await resolve_media_tree(p["published"])
    content["sections"] = [s for s in content["sections"] if not s.get("hidden")]
    for s in content["sections"]:
        if s["type"] == "notes_feed":
            s["notes"] = (await list_notes(category=s["data"].get("category", ""), per=int(s["data"].get("count") or 3)))["items"]
    return {"key": key, "path": p["path"], "content": content, "updated_at": p.get("published_at") or p["updated_at"]}


async def public_note(slug):
    n = await db.notes.find_one({"slug": slug, "status": "published"}, {"_id": 0})
    if not n:
        return None
    note = await resolve_media_tree(n["published"])
    rel = [r for r in note.get("related", []) if r]
    related = await cards(await db.notes.find({"id": {"$in": rel}, "status": "published"}, {"_id": 0}).to_list(6)) if rel else []
    if not related:
        related = (await list_notes(category=note.get("category", ""), per=3, exclude=slug))["items"]
    note["downloads"] = [d for d in note.get("downloads", []) if d.get("media")]
    return {"note": note, "id": n["id"], "slug": slug, "published_at": n["published_at"], "updated_at": n["updated_at"], "related": related}


@router.get("/public/site")
async def site():
    return await get_site()


@router.get("/public/pages/{key}")
async def page(key: str):
    p = await public_page(key)
    if not p:
        raise HTTPException(404, "Not found")
    return p


@router.get("/public/notes")
async def notes(q: str = "", category: str = "", tag: str = "", page: int = 1):
    return await list_notes(q, category, tag, page)


@router.get("/public/notes/{slug}")
async def note(slug: str):
    n = await public_note(slug)
    if not n:
        raise HTTPException(404, "Not found")
    return n


@router.get("/public/redirect")
async def redirect_lookup(path: str):
    r = await db.redirects.find_one({"from_path": path.split("?")[0].rstrip("/") or "/"}, {"_id": 0})
    if not r:
        raise HTTPException(404, "No redirect")
    return {"to": r["to_path"]}


class EnquiryIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    topic: str
    message: str = Field(min_length=10, max_length=5000)
    phone: str = Field("", max_length=40)
    organisation: str = Field("", max_length=160)
    website: str = ""
    elapsed_ms: int = 0


@router.post("/public/enquiries")
async def submit_enquiry(body: EnquiryIn, request: Request, background: BackgroundTasks):
    if body.website or body.elapsed_ms < 1500:
        raise HTTPException(400, "Your message could not be accepted. Please wait a moment and try again.")
    if body.topic not in TOPICS:
        raise HTTPException(400, "Please choose an enquiry topic")
    if body.phone and not re.match(r"^[0-9+()\-\s]{6,40}$", body.phone):
        raise HTTPException(400, "Phone number may contain only digits, spaces and + ( ) -")
    ih = ip_hash(request)
    since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    if await db.enquiries.count_documents({"ip_hash": ih, "created_at": {"$gte": since}}) >= 5:
        raise HTTPException(429, "Too many messages from this connection. Please try again later.")
    import mailer
    email_on = mailer.ready(await mailer.load())
    doc = {"id": new_id(), **body.model_dump(exclude={"website", "elapsed_ms"}), "name": body.name.strip(), "status": "new", "private_notes": "",
           "email_status": "sending" if email_on else "not_configured", "ip_hash": ih, "created_at": now()}
    await db.enquiries.insert_one(doc)
    if email_on:
        background.add_task(mailer.deliver, {k: v for k, v in doc.items() if k != "_id"})
    return {"ok": True, "id": doc["id"], "email_status": doc["email_status"]}


@router.get("/sitemap.xml")
async def sitemap():
    s = await db.settings.find_one({"key": "site"}, {"indexing_enabled": 1})
    urls = []
    if s.get("indexing_enabled"):
        async for p in db.pages.find({"status": "published"}, {"_id": 0}):
            if not p["published"]["seo"].get("noindex") and p["path"] != "/our-work":
                urls.append((SITE_URL + (p["path"] if p["path"] != "/" else "/"), p.get("published_at") or p["updated_at"]))
        async for n in db.notes.find({"status": "published"}, {"_id": 0}):
            if not n["published"]["seo"].get("noindex"):
                urls.append((f"{SITE_URL}/field-notes/{n['slug']}", n["updated_at"]))
    body = "".join(f"<url><loc>{u}</loc><lastmod>{d[:10]}</lastmod></url>" for u, d in urls)
    return Response(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>', media_type="application/xml")


AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai", "PerplexityBot",
               "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot", "meta-externalagent", "Bytespider", "Amazonbot", "DuckAssistBot", "cohere-ai", "MistralAI-User"]


@router.get("/robots.txt")
async def robots():
    s = await db.settings.find_one({"key": "site"}, {"indexing_enabled": 1, "geo": 1})
    if not s.get("indexing_enabled"):
        return Response("# Private preview: indexing disabled\nUser-agent: *\nDisallow: /\n", media_type="text/plain")
    rules = "Disallow: /admin\nDisallow: /api/\nAllow: /api/media/\n"
    ai = (s.get("geo") or {}).get("ai_crawlers", "allow")
    out = f"User-agent: *\n{rules}\n"
    out += "# AI search and answer engines (GEO)\n" + "".join(f"User-agent: {b}\n" for b in AI_CRAWLERS)
    out += (rules if ai != "block" else "Disallow: /\n") + "\n"
    out += f"Sitemap: {SITE_URL}/sitemap.xml\n# Plain-language summary for AI assistants: {SITE_URL}/llms.txt\n"
    return Response(out, media_type="text/plain")


def _plain(html_text, limit=300):
    t = re.sub(r"<[^>]+>", " ", html_text or "")
    t = re.sub(r"&nbsp;", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t[:limit].rsplit(" ", 1)[0] + "…" if len(t) > limit else t


@router.get("/llms.txt")
async def llms_txt():
    """llms.txt — a short, plain-language map of the site for AI assistants (llmstxt.org)."""
    s = await db.settings.find_one({"key": "site"}, {"_id": 0})
    if not s.get("indexing_enabled"):
        return Response("# This website is not public yet.\n", media_type="text/plain")
    geo = s.get("geo") or {}
    name = f"{s.get('site_name') or 'USP'} — {s.get('full_name') or ''}".strip(" —")
    lines = [f"# {name}", ""]
    about = geo.get("org_description") or s.get("tagline") or ""
    if about:
        lines += [f"> {about}", ""]
    facts = [f"- Website: {SITE_URL}/"]
    if geo.get("area_served"):
        facts.append(f"- Works in: {geo['area_served']}")
    if geo.get("founded"):
        facts.append(f"- Founded: {geo['founded']}")
    contact = s.get("contact") or {}
    if contact.get("email"):
        facts.append(f"- Contact: {contact['email']} or {SITE_URL}/connect")
    if contact.get("address"):
        facts.append("- Address: " + contact["address"].replace("\n", ", "))
    for sm in s.get("social") or []:
        facts.append(f"- {sm.get('label') or 'Profile'}: {sm.get('url')}")
    lines += facts + ["", "## Pages", ""]
    async for p in db.pages.find({"status": "published"}, {"_id": 0}).sort("path", 1):
        if p["path"] in ("/our-work", "/blog") or p["published"]["seo"].get("noindex"):
            continue
        seo = p["published"]["seo"]
        desc = seo.get("summary") or seo.get("description") or ""
        lines.append(f"- [{p['published']['title']}]({SITE_URL}{p['path'] if p['path'] != '/' else '/'})" + (f": {desc}" if desc else ""))
    notes = await db.notes.find({"status": "published"}, {"_id": 0}).sort("published_at", -1).to_list(200)
    if notes:
        lines += ["", "## Field Notes (stories from the work)", ""]
        for n in notes:
            pub = n["published"]
            if pub["seo"].get("noindex"):
                continue
            desc = pub["seo"].get("summary") or pub["seo"].get("description") or pub.get("standfirst") or _plain(pub.get("body_html"), 200)
            lines.append(f"- [{pub['title']}]({SITE_URL}/field-notes/{n['slug']}): {desc}")
    if geo.get("llms_extra"):
        lines += ["", "## More about us", "", geo["llms_extra"]]
    return Response("\n".join(lines) + "\n", media_type="text/plain; charset=utf-8")


@router.get("/ssr")
async def ssr(path: str = "/"):
    from ssr import render
    status, html_text, headers = await render(path)
    return HTMLResponse(html_text, status_code=status, headers=headers)
