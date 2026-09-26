"""
The pay pages (outside /api/v1: they match the links we hand out).

  /pay/<ticket>     sends the trader to PayFast with a form our server
                    signed from the order (auto-submits; a button too)
  /pay/done         after paying: "we're confirming it", back to the app
  /pay/cancelled    after cancelling on PayFast's page

The order is marked paid only by PayFast's verified notification, never
by reaching /pay/done. No cookies (so no CSRF); no-referrer and no-store
headers (src/__init__.py) keep the ticket out of logs and caches.
"""
from __future__ import annotations

import re

from flask import Blueprint, render_template, request

from src.shared.rate_limit.limiter import limiter

from ..services import payment_service

pay_pages_bp = Blueprint("pay_pages", __name__, template_folder="templates")

PAGE_LIMIT = "30 per hour"
_REFERENCE = re.compile(r"^AKZ-\d{4}-\d{6}$")
APP_LINK = "akayza://informal-business/orders"


def _reference() -> str:
    ref = (request.args.get("order") or "").strip()
    return ref if _REFERENCE.match(ref) else ""


@pay_pages_bp.get("/pay/done")
@limiter.limit(PAGE_LIMIT)
def done():
    return render_template("pay_page.html", state="done", reference=_reference(), app_link=APP_LINK)


@pay_pages_bp.get("/pay/cancelled")
@limiter.limit(PAGE_LIMIT)
def cancelled():
    return render_template("pay_page.html", state="cancelled", reference=_reference(), app_link=APP_LINK)


@pay_pages_bp.get("/pay/<ticket>")
@limiter.limit(PAGE_LIMIT)
def pay(ticket: str):
    form = payment_service.form_for_ticket(ticket)
    if form is None:
        return render_template("pay_page.html", state="invalid", app_link=APP_LINK)
    return render_template("pay_page.html", state="redirect", form=form, app_link=APP_LINK)
