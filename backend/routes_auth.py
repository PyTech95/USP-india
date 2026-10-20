import os
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
import jwt
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from core import db, now, new_id, hash_password, verify_password, make_token, current_user, public_user, JWT_SECRET, PERMS, SITE_URL, log

router = APIRouter(prefix="/api/auth")


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class TokenPasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=10, max_length=200)
    name: str | None = None


class ForgotIn(BaseModel):
    email: EmailStr


def set_session(resp: Response, user_id: str):
    # Secure cookies need HTTPS (localhost is exempt). Set COOKIE_SECURE=false only for plain-HTTP testing on a LAN.
    opts = dict(secure=os.environ.get("COOKIE_SECURE", "true").lower() != "false", samesite="lax", path="/")
    resp.set_cookie("access_token", make_token(user_id, "access", 60), httponly=True, max_age=3600, **opts)
    resp.set_cookie("refresh_token", make_token(user_id, "refresh", 60 * 24 * 7), httponly=True, max_age=604800, **opts)
    resp.set_cookie("csrf_token", secrets.token_urlsafe(24), httponly=False, max_age=604800, **opts)


def client_ip(request: Request):
    return (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()


def token_hash(t):
    return hashlib.sha256(t.encode()).hexdigest()


async def issue_token(user_id, kind, hours):
    t = secrets.token_urlsafe(32)
    exp = datetime.now(timezone.utc) + timedelta(hours=hours)
    await db.tokens.insert_one({"hash": token_hash(t), "kind": kind, "user_id": user_id, "expires_at_dt": exp, "used": False, "created_at": now()})
    return t


async def consume_token(t, kind):
    doc = await db.tokens.find_one({"hash": token_hash(t), "kind": kind, "used": False})
    if not doc or doc["expires_at_dt"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(400, "This link is invalid or has expired")
    await db.tokens.update_one({"hash": doc["hash"]}, {"$set": {"used": True}})
    return doc


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ident = f"{client_ip(request)}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("locked_until") and att["locked_until"] > now():
        raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
    u = await db.users.find_one({"email": email})
    if not u or not u.get("active") or not u.get("password_hash") or not verify_password(body.password, u["password_hash"]):
        count = (att or {}).get("count", 0) + 1
        upd = {"count": count}
        if count >= 5:
            upd = {"count": 0, "locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}
        await db.login_attempts.update_one({"identifier": ident}, {"$set": upd}, upsert=True)
        raise HTTPException(401, "Incorrect email or password")
    await db.login_attempts.delete_many({"identifier": ident})
    set_session(response, u["id"])
    return public_user(u) | {"permissions": sorted(PERMS[u["role"]])}


@router.post("/logout")
async def logout(response: Response):
    for c in ("access_token", "refresh_token", "csrf_token"):
        response.delete_cookie(c, path="/")
    return {"ok": True}


@router.get("/me")
async def me(user=Depends(current_user)):
    return user | {"permissions": sorted(PERMS[user["role"]])}


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    t = request.cookies.get("refresh_token")
    try:
        payload = jwt.decode(t or "", JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Session expired")
    if payload.get("type") != "refresh" or not await db.users.find_one({"id": payload["sub"], "active": True}):
        raise HTTPException(401, "Session expired")
    set_session(response, payload["sub"])
    return {"ok": True}


@router.post("/forgot-password")
async def forgot(body: ForgotIn):
    u = await db.users.find_one({"email": body.email.lower(), "active": True})
    if u:
        t = await issue_token(u["id"], "reset", 1)
        log.warning("Password reset link (email delivery not configured): %s/admin/reset-password?token=%s", os.environ.get("PREVIEW_URL") or SITE_URL, t)
    return {"ok": True, "message": "If the account exists, a reset link has been created. Email delivery is not configured — ask the site owner for the link."}


@router.post("/reset-password")
async def reset(body: TokenPasswordIn):
    doc = await consume_token(body.token, "reset")
    await db.users.update_one({"id": doc["user_id"]}, {"$set": {"password_hash": hash_password(body.password)}})
    return {"ok": True}


@router.post("/accept-invite")
async def accept_invite(body: TokenPasswordIn):
    doc = await consume_token(body.token, "invite")
    upd = {"password_hash": hash_password(body.password), "active": True}
    if body.name:
        upd["name"] = body.name[:120]
    await db.users.update_one({"id": doc["user_id"]}, {"$set": upd})
    return {"ok": True}
