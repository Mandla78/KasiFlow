"""
The password reset PAGE -- what the button in the reset email opens.
(Adapted from TruConnect's browser reset page; see REUSE.md.)

WHY A WEB PAGE AND NOT ONLY THE APP: email apps (Gmail especially) strip
links that aren't https://, so an akayza:// link in an email is a dead
button. The email links here instead:

    {APP_BASE_URL}/reset-password?ticket=...

and this page shows the new-password form (plus "Open the Akayza app"
for phones that have it). NOT under /api/v1: it must match the emailed
URL exactly. It calls the SAME auth_service.reset_password as the app,
so the rules can never drift between the two.

SECURITY
  * The ticket is the credential: random 256 bits, stored only as an
    HMAC, one use, 30 minutes. No cookie, so no CSRF to protect.
  * Referrer-Policy: no-referrer (every response) keeps the ticket out of
    other sites' logs; Cache-Control: no-store keeps the page out of caches.
  * Rate limited per IP, on top of the ticket's own entropy.
  * HTTPS in production (APP_BASE_URL must be https; see config.py).
"""
from __future__ import annotations

from flask import Blueprint, render_template, request

from src.core.exceptions import AppError, ValidationError
from src.shared.rate_limit.limiter import limiter

from ..services import auth_service

reset_page_bp = Blueprint("reset_page", __name__, template_folder="templates")

APP_LINK = "akayza://reset-password"
PAGE_LIMIT = "30 per hour"


def _page(state: str, ticket: str = "", error: str = "", status: int = 200):
    app_link = f"{APP_LINK}?token={ticket}" if ticket and state in ("form", "invalid") else None
    return render_template("reset_password_page.html", state=state, ticket=ticket, error=error, app_link=app_link), status


@reset_page_bp.route("/reset-password", methods=["GET", "POST"])
@limiter.limit(PAGE_LIMIT)
def reset_password_page():
    ticket = (request.values.get("ticket") or "").strip()
    if not ticket or len(ticket) > 100:
        return _page("missing")

    if request.method == "GET":
        return _page("form", ticket) if auth_service.reset_link_is_valid(ticket) else _page("invalid", ticket)

    password = request.form.get("password", "")
    if password != request.form.get("confirm", ""):
        return _page("form", ticket, "The two passwords don't match.")
    try:
        auth_service.reset_password(ticket, password)
    except ValidationError as e:  # the password rule, one message
        return _page("form", ticket, e.message)
    except AppError:  # used, expired or unknown
        return _page("invalid")
    return _page("done")
