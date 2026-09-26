"""
/api/v1 -- digital payment.

  POST /me/orders/<id>/pay           a pay link for the trader's unpaid order
  POST /payments/payfast/notify      PayFast's notification (public: PayFast
                                     calls it). Always answers 200 so PayFast
                                     stops retrying; what we do depends on the
                                     four checks in services/payfast.py.
"""
from __future__ import annotations

import uuid

from flask import current_app, request

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.shared.rate_limit.limiter import limiter

from ..services import payment_service


@api_bp.post("/me/orders/<uuid:order_id>/pay")
@limiter.limit("20 per minute")
@auth_required(dashboard="informal_business")
def pay_order(order_id: uuid.UUID):
    return success_response(payment_service.start(current_user(), order_id))


def _caller_ip() -> str:
    """PayFast's address. Behind our own tunnel/proxy, the last
    X-Forwarded-For entry is the one our proxy added (earlier ones can be
    typed by anyone)."""
    if current_app.config["PAYFAST_TRUST_PROXY"]:
        forwarded = [p.strip() for p in (request.headers.get("X-Forwarded-For") or "").split(",") if p.strip()]
        if forwarded:
            return forwarded[-1]
    return request.remote_addr or ""


@api_bp.post("/payments/payfast/notify")
@limiter.limit("60 per minute")
def payfast_notify():
    posted = list(request.form.items(multi=True))[:60]
    payment_service.handle_itn(posted, _caller_ip())
    return "", 200
