"""
The client's SIGN-OFF PAGE -- what the link in the builder's WhatsApp
opens (PDF p14). No app, no login: the ticket in the link is the key.

    {APP_BASE_URL}/sign-off?ticket=...

Built like the password reset page (identity/auth/api/reset_page.py): a
plain server-rendered form, NOT under /api/v1 so it matches the sent link.

SECURITY
  * The ticket: 256 random bits, stored only as an HMAC, one use, 7 days,
    revoked by a newer link (sign_off_service).
  * Shows the business, the stage and its price, the job, the photo --
    never the builder's cash amount, never the client's own name or
    number. Used, expired and unknown links get the same answer.
  * Referrer-Policy: no-referrer and Cache-Control: no-store on every
    response (src/__init__.py) keep the ticket out of logs and caches;
    noindex keeps it out of search; no cookie, so no CSRF.
  * Rate limited per IP.
"""
from __future__ import annotations

from flask import Blueprint, render_template, request

from src.core.exceptions import ValidationError
from src.shared.rate_limit.limiter import limiter

from ..constants import MAX_JOB_CENTS
from ..schemas.jobs_schemas import ClientAnswerSchema, load
from ..services import sign_off_service

sign_off_page_bp = Blueprint("sign_off_page", __name__, template_folder="templates")

PAGE_LIMIT = "30 per hour"


def _rand(cents: int) -> str:
    whole, part = divmod(cents, 100)
    text = f"R{whole:,}"
    return f"{text}.{part:02d}" if part else text


def _page(state: str, *, ticket: str = "", info: dict | None = None, error: str = "", amount: str = "", note: str = "", status: int = 200):
    return (
        render_template(
            "sign_off_page.html",
            state=state,
            ticket=ticket,
            info=info,
            price=_rand(info["stage_amount_cents"]) if info else "",
            error=error,
            amount=amount,
            note=note,
        ),
        status,
    )


@sign_off_page_bp.route("/sign-off", methods=["GET", "POST"])
@limiter.limit(PAGE_LIMIT)
def sign_off_page():
    ticket = (request.values.get("ticket") or "").strip()
    info = sign_off_service.page(ticket)
    if info is None:
        return _page("invalid")
    if request.method == "GET":
        return _page("form", ticket=ticket, info=info)

    try:
        data = load(ClientAnswerSchema(), request.form.to_dict())
    except ValidationError:
        return _page("form", ticket=ticket, info=info, error="Please check what you typed and try again.")
    cents = sign_off_service.parse_rand(data["amount"]) if data["answer"] == "done" else 0
    if cents is None or cents > MAX_JOB_CENTS:
        return _page("form", ticket=ticket, info=info, error="Type the cash you paid, like 12000 (or leave it empty).", amount=data["amount"])
    try:
        outcome = sign_off_service.answer(ticket, data["answer"], cents, data["note"])
    except sign_off_service.InvalidTicket:
        return _page("invalid")
    return _page("thanks", info={**info, "outcome": outcome})
