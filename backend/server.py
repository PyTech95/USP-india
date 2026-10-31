import os
import logging
from urllib.parse import urlsplit
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from core import db, client, init_storage, log
import routes_auth
import routes_admin
import routes_media
import routes_public
import routes_content_release
import routes_content_json
import analytics
import mailer
from content_sync import runtime as content_runtime
from seed import seed, apply_header_update, apply_page_updates

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
app = FastAPI(title="USP India CMS", docs_url=None, redoc_url=None, openapi_url=None)
ALLOWED_ORIGINS = [o.strip() for o in os.environ["CORS_ORIGINS"].split(",") if o.strip()]
CSRF_EXEMPT = {"/api/auth/login", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/accept-invite", "/api/public/enquiries", "/api/public/track", "/api/auth/logout"}


@app.middleware("http")
async def security(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith("/api/"):
        origin = request.headers.get("origin")
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        if origin and origin not in ALLOWED_ORIGINS and urlsplit(origin).netloc != host:
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
        if request.cookies.get("access_token") or request.cookies.get("refresh_token"):
            if request.url.path not in CSRF_EXEMPT:
                tok = request.cookies.get("csrf_token")
                if not tok or request.headers.get("x-csrf-token") != tok:
                    return JSONResponse({"detail": "Security token missing or invalid. Please reload the page."}, status_code=403)
    resp = await call_next(request)
    release = await content_runtime.after_mutation(request.url.path, request.method, resp.status_code)
    if release:
        resp.headers["X-Content-Release-State"] = release["state"]
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if request.url.path.startswith("/api/admin") or request.url.path.startswith("/api/auth"):
        resp.headers["Cache-Control"] = "no-store"
        resp.headers["X-Robots-Tag"] = "noindex"
    return resp


for r in (routes_auth.router, routes_admin.router, routes_media.router, routes_public.router, routes_content_release.router, routes_content_json.router,
          analytics.router, mailer.router):
    app.include_router(r)

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=ALLOWED_ORIGINS, allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def coordinate_content_writes(request: Request, call_next):
    try:
        async with content_runtime.write_guard(request.url.path, request.method):
            return await call_next(request)
    except RuntimeError as error:
        if str(error).startswith("Another content operation is still in progress"):
            return JSONResponse({"detail": "Another content operation is in progress. Please retry shortly; nothing was imported."}, status_code=409)
        raise


@app.on_event("startup")
async def startup():
    await analytics.ensure_indexes()
    await seed()
    log.info("Media storage: %s", init_storage())
    # Target readiness waits for a complete, validated, backup-first import.
    # A failure must not silently serve half-imported/default content.
    await content_runtime.startup()
    await apply_header_update()  # one-time updates shipped with the release (seed.py)
    await apply_page_updates()


@app.get("/api/health")
async def health():
    await db.command("ping")
    if not await content_runtime.readiness():
        return JSONResponse({"ok": False, "content_release": "pending_or_failed"}, status_code=503)
    return {"ok": True}


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---- Self-hosting: serve the built frontend (frontend/build) when present ----
# Public pages are answered with server-rendered HTML (real status codes, titles,
# meta/robots tags, JSON-LD) plus the React bundle, which then takes over in the
# browser — the same behaviour the development proxy (frontend/src/setupProxy.js) gives.
import re as _re
from pathlib import Path as _Path

_BUILD = _Path(__file__).resolve().parent.parent / "frontend" / "build"
if _BUILD.is_dir() and (_BUILD / "index.html").is_file():
    from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, RedirectResponse
    import ssr as _ssr
    import routes_public as _public

    # Every frontend build gives the site's script and stylesheet files new names (and removes the
    # old ones). They are read from frontend/build/index.html again whenever that file changes, so
    # a new build is used straight away: pages never ask for files a rebuild has removed (which
    # showed the site without its design until the backend was restarted).
    _SHELL = {"mtime": None, "css": ""}

    def _page_shell():
        try:
            mtime = (_BUILD / "index.html").stat().st_mtime_ns
        except OSError:  # (in the middle of a build) keep the last complete one
            return _SHELL
        if mtime != _SHELL["mtime"]:
            index = (_BUILD / "index.html").read_text()
            scripts = _re.findall(r'<script[^>]*\ssrc="([^"]+)"', index)
            if scripts:  # a complete page (not one still being written)
                _ssr.SCRIPTS[:] = scripts
                _SHELL.update(mtime=mtime, css="".join(f'<link rel="stylesheet" href="{href}">' for href in _re.findall(r'<link[^>]*href="([^"]+\.css)"', index)))
        return _SHELL

    _page_shell()
    _NO_SSR = _re.compile(r"^(admin|api|static)(/|$)")
    _VIDEO = {".mp4": "video/mp4", ".webm": "video/webm", ".m4v": "video/mp4"}

    def _video(path, request):
        """A film (frontend/build/films/…) with byte ranges: phones and Safari only play (and seek in) a
        video when the server can send part of it."""
        from fastapi.responses import Response, StreamingResponse
        size, ctype = path.stat().st_size, _VIDEO[path.suffix.lower()]
        headers = {"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"}
        m = _re.fullmatch(r"bytes=(\d*)-(\d*)", (request.headers.get("range") or "").strip())
        if not m or not (m[1] or m[2]):
            return FileResponse(path, media_type=ctype, headers=headers)
        start, end = (int(m[1]), min(int(m[2]) if m[2] else size - 1, size - 1)) if m[1] else (max(0, size - int(m[2])), size - 1)
        if start >= size or start > end:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}", **headers})

        def chunks():
            with open(path, "rb") as f:
                f.seek(start)
                left = end - start + 1
                while left > 0:
                    data = f.read(min(256 * 1024, left))
                    if not data:
                        break
                    left -= len(data)
                    yield data
        return StreamingResponse(chunks(), status_code=206, media_type=ctype,
                                 headers={**headers, "Content-Range": f"bytes {start}-{end}/{size}", "Content-Length": str(end - start + 1)})

    @app.get("/robots.txt", include_in_schema=False)
    async def robots_txt():
        return await _public.robots()

    @app.get("/sitemap.xml", include_in_schema=False)
    async def sitemap_xml():
        return await _public.sitemap()

    @app.get("/llms.txt", include_in_schema=False)
    async def llms_txt():
        return await _public.llms_txt()

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str, request: Request):
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        candidate = (_BUILD / full_path).resolve()
        if full_path and candidate.is_file() and str(candidate).startswith(str(_BUILD)):
            if candidate.suffix.lower() in _VIDEO:
                return _video(candidate, request)
            return FileResponse(candidate)
        if full_path.startswith("static/"):
            # a built script, stylesheet or image that is not there is "not found" — never the page
            # itself (browsers refuse a page as a script or stylesheet, and would keep it cached)
            return PlainTextResponse("Not found", status_code=404, headers={"Cache-Control": "no-store"})
        if _NO_SSR.match(full_path) or "text/html" not in request.headers.get("accept", "text/html"):
            # always re-check the page shell, so a new deployment's CSS/JS is picked up straight away
            return FileResponse(_BUILD / "index.html", headers={"Cache-Control": "no-cache"})
        shell = _page_shell()  # this build's script and stylesheet names
        try:
            target = "/" + full_path + (f"?{request.url.query}" if request.url.query else "")
            status, html_text, headers = await _ssr.render(target)
        except Exception as error:  # never break the site because of SSR
            log.warning("SSR failed for /%s: %s", full_path, error)
            return FileResponse(_BUILD / "index.html", headers={"Cache-Control": "no-cache"})
        if status in (301, 302, 307, 308) and headers.get("Location"):
            return RedirectResponse(headers["Location"], status_code=status)
        return HTMLResponse(html_text.replace("</head>", shell["css"] + "</head>", 1), status_code=status, headers={"Cache-Control": "no-cache"})
