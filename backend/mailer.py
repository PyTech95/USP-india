"""Enquiry form settings and email delivery (any SMTP provider: Gmail/Google Workspace, Zoho, Hostinger, Outlook, Amazon SES...).

Settings live in db.config {key: "enquiry_form"} — never in the public site settings —
and the SMTP password is never sent back to the browser.
"""
import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from core import db, now, require, SITE_URL, log

router = APIRouter(prefix="/api/admin/enquiry-settings")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DEFAULTS = {
    "key": "enquiry_form",
    "notify": False,
    "recipients": [],
    "subject": "New enquiry from the website: {topic} — {name}",
    "smtp": {"host": "", "port": 587, "security": "starttls", "username": "", "password": "", "from_email": "", "from_name": "USP India website"},
    "autoreply": {"enabled": False, "subject": "Thank you for contacting USP India",
                  "message": "Dear {name},\n\nThank you for getting in touch with Urban Suburban Perspectives. We have received your message and will reply soon.\n\nWarm regards,\nUSP India"},
    "last": {"status": "", "at": "", "error": ""},
}


async def load():
    doc = await db.config.find_one({"key": "enquiry_form"}, {"_id": 0}) or {}
    out = {**DEFAULTS, **doc}
    out["smtp"] = {**DEFAULTS["smtp"], **(doc.get("smtp") or {})}
    out["autoreply"] = {**DEFAULTS["autoreply"], **(doc.get("autoreply") or {})}
    out["last"] = {**DEFAULTS["last"], **(doc.get("last") or {})}
    if os.environ.get("SMTP_PASSWORD"):
        out["smtp"]["password"] = os.environ["SMTP_PASSWORD"]
    return out


def ready(cfg):
    s = cfg["smtp"]
    return bool(cfg["notify"] and cfg["recipients"] and s["host"] and s["from_email"])


def public_view(cfg):
    view = {k: v for k, v in cfg.items() if k != "key"}
    view["smtp"] = {k: v for k, v in cfg["smtp"].items() if k != "password"} | {"has_password": bool(cfg["smtp"]["password"]), "password_from_env": bool(os.environ.get("SMTP_PASSWORD"))}
    view["ready"] = ready(cfg)
    return view


def _fill(template, enquiry):
    values = {k: str(enquiry.get(k) or "") for k in ("name", "email", "topic", "phone", "organisation", "message")}
    return re.sub(r"\{(\w+)\}", lambda m: values.get(m.group(1), m.group(0)), template or "")


def _send(cfg, to, subject, text, reply_to=None):
    s = cfg["smtp"]
    msg = EmailMessage()
    msg["From"] = formataddr((s["from_name"] or "", s["from_email"]))
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject.replace("\n", " ")[:200]
    msg["Message-ID"] = make_msgid(domain=(s["from_email"].split("@")[-1] or None))
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text)
    port = int(s["port"] or (465 if s["security"] == "ssl" else 587))
    context = ssl.create_default_context()
    if s["security"] == "ssl":
        server = smtplib.SMTP_SSL(s["host"], port, timeout=20, context=context)
    else:
        server = smtplib.SMTP(s["host"], port, timeout=20)
    try:
        server.ehlo()
        if s["security"] == "starttls":
            server.starttls(context=context)
            server.ehlo()
        if s["username"]:
            server.login(s["username"], s["password"])
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:
            pass


def explain(err):
    """Turn an SMTP error into a sentence the site owner can act on."""
    text = str(err)
    low = text.lower()
    if isinstance(err, smtplib.SMTPAuthenticationError) or "535" in text or "username and password" in low:
        hint = "The username or password was not accepted. For Gmail / Google Workspace use an App Password, not the normal password."
    elif isinstance(err, (ConnectionRefusedError, TimeoutError)) or "refused" in low or "timed out" in low or "name or service" in low or "getaddrinfo" in low:
        hint = "Could not reach the mail server. Check the server name, port and security (587 = STARTTLS, 465 = SSL/TLS)."
    elif isinstance(err, ssl.SSLError) or "wrong version number" in low or "ssl" in low:
        hint = "Secure connection failed. Try the other security option (587 = STARTTLS, 465 = SSL/TLS)."
    elif "sender" in low or "from" in low and "not" in low:
        hint = "The mail server refused the “From” address. Use the mailbox's own address as the “From” address."
    else:
        hint = "The mail server refused the message."
    return f"{hint} ({text[:160]})"


def notification_text(e):
    lines = [f"Name: {e.get('name')}", f"Email: {e.get('email')}", f"Topic: {e.get('topic')}"]
    if e.get("phone"):
        lines.append(f"Phone: {e['phone']}")
    if e.get("organisation"):
        lines.append(f"Organisation: {e['organisation']}")
    return "\n".join(lines) + f"\n\nMessage:\n{e.get('message')}\n\n—\nReply to this email to answer {e.get('name')} directly.\nAll enquiries: {SITE_URL}/admin/enquiries\n"


async def deliver(enquiry):
    """Send the notification (and optional auto-reply) for one enquiry. Never raises."""
    cfg = await load()
    if not ready(cfg):
        return "not_configured"
    status, error = "sent", ""
    try:
        await run_in_threadpool(_send, cfg, cfg["recipients"], _fill(cfg["subject"], enquiry), notification_text(enquiry), enquiry.get("email"))
        if cfg["autoreply"]["enabled"] and enquiry.get("email"):
            await run_in_threadpool(_send, cfg, [enquiry["email"]], _fill(cfg["autoreply"]["subject"], enquiry), _fill(cfg["autoreply"]["message"], enquiry))
    except Exception as err:  # keep the enquiry even if email fails
        status, error = "failed", explain(err)[:300]
        log.warning("Enquiry email failed: %s", err)
    await db.config.update_one({"key": "enquiry_form"}, {"$set": {"last": {"status": status, "at": now(), "error": error}}}, upsert=True)
    if enquiry.get("id"):
        await db.enquiries.update_one({"id": enquiry["id"]}, {"$set": {"email_status": status, "email_error": error}})
    return status


async def send_account_email(to, subject, text):
    """Password-reset and invitation emails. Uses the same mailbox as enquiries; never raises."""
    cfg = await load()
    if not (cfg["smtp"]["host"] and cfg["smtp"]["from_email"]):
        return "not_configured"
    try:
        await run_in_threadpool(_send, cfg, [to], subject, text)
        return "sent"
    except Exception as err:
        log.warning("Account email failed: %s", err)
        return "failed"


class SmtpIn(BaseModel):
    host: str = Field("", max_length=200)
    port: int = 587
    security: str = Field("starttls", pattern=r"^(starttls|ssl|none)$")
    username: str = Field("", max_length=200)
    password: str = Field("", max_length=300)
    from_email: str = Field("", max_length=200)
    from_name: str = Field("", max_length=120)


class AutoReplyIn(BaseModel):
    enabled: bool = False
    subject: str = Field("", max_length=200)
    message: str = Field("", max_length=4000)


class SettingsIn(BaseModel):
    notify: bool = False
    recipients: list[str] = []
    subject: str = Field("", max_length=200)
    smtp: SmtpIn
    autoreply: AutoReplyIn


@router.get("")
async def get_settings(user=Depends(require("config"))):
    return public_view(await load())


@router.put("")
async def save_settings(body: SettingsIn, user=Depends(require("config"))):
    recipients = [r.strip() for r in body.recipients if r.strip()][:10]
    bad = [r for r in recipients if not EMAIL_RE.match(r)]
    if bad:
        raise HTTPException(400, f"Not a valid email address: {', '.join(bad)}")
    if body.smtp.from_email and not EMAIL_RE.match(body.smtp.from_email):
        raise HTTPException(400, "The “From” address is not a valid email address")
    if body.notify and not recipients:
        raise HTTPException(400, "Add at least one email address to send enquiries to")
    current = await load()
    smtp = body.smtp.model_dump()
    if not smtp["password"]:
        smtp["password"] = (await db.config.find_one({"key": "enquiry_form"}, {"_id": 0, "smtp.password": 1}) or {}).get("smtp", {}).get("password", "")
    doc = {"notify": body.notify, "recipients": recipients, "subject": body.subject or DEFAULTS["subject"], "smtp": smtp,
           "autoreply": body.autoreply.model_dump(), "last": current["last"], "updated_at": now(), "updated_by": user["email"]}
    await db.config.update_one({"key": "enquiry_form"}, {"$set": doc}, upsert=True)
    return public_view(await load())


class TestIn(BaseModel):
    to: str = ""


@router.post("/test")
async def send_test(body: TestIn, user=Depends(require("config"))):
    cfg = await load()
    if not (cfg["smtp"]["host"] and cfg["smtp"]["from_email"]):
        raise HTTPException(400, "Fill in and save the email server details first")
    to = [body.to.strip()] if body.to.strip() else (cfg["recipients"] or [user["email"]])
    if any(not EMAIL_RE.match(t) for t in to):
        raise HTTPException(400, "Not a valid email address")
    sample = {"name": "Test Person", "email": user["email"], "topic": "General", "message": "This is a test enquiry sent from the website admin. If you can read this, enquiry emails are working."}
    try:
        await run_in_threadpool(_send, cfg, to, "[Test] " + _fill(cfg["subject"], sample), notification_text(sample), user["email"])
    except Exception as err:
        await db.config.update_one({"key": "enquiry_form"}, {"$set": {"last": {"status": "failed", "at": now(), "error": explain(err)[:300]}}}, upsert=True)
        raise HTTPException(400, f"Could not send. {explain(err)}")
    await db.config.update_one({"key": "enquiry_form"}, {"$set": {"last": {"status": "sent", "at": now(), "error": ""}}}, upsert=True)
    return {"ok": True, "sent_to": to}
