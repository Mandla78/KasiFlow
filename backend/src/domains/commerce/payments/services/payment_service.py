"""
Paying an order digitally through PayFast (docs/supplier/07).

  start(user, order_id)      a pay link for the trader's unpaid order
  form_for_ticket(ticket)    what the pay page posts to PayFast (signed)
  handle_itn(posted, ip)     PayFast's notification: all four checks, then
                             the order is paid (once, however many times
                             PayFast repeats it)

The app never sees the amount, the merchant key or the passphrase: the
pay link opens OUR page, which builds the signed form from the ORDER.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import timedelta
from typing import Optional

from flask import current_app

from src.core.base_model import utcnow
from src.core.exceptions import AppError
from src.domains.commerce.orders.services import order_audit, order_service
from src.extensions import db
from src.shared.audit.event_types.commerce import CommerceAuditEvent as E

from ..models import Payment
from ..repositories import payment_repository as repo
from . import payfast

#: A pay link works this long (the order itself waits up to 24 hours).
TICKET_MINUTES = 30
#: What we keep from PayFast's notification (no names, emails or signature).
ITN_KEPT = ("m_payment_id", "pf_payment_id", "payment_status", "item_name", "amount_gross", "amount_fee", "amount_net")


class PaymentsNotReady(AppError):
    status_code = 503
    code = "PAYMENTS_NOT_READY"


def _digest(ticket: str) -> str:
    key = current_app.config["SECRET_KEY"].encode()
    return hmac.new(key, ticket.encode(), hashlib.sha256).hexdigest()


def _ready() -> None:
    cfg = current_app.config
    if not (cfg["PAYFAST_MERCHANT_ID"] and cfg["PAYFAST_MERCHANT_KEY"] and cfg["PAYFAST_PASSPHRASE"]):
        raise PaymentsNotReady("Digital payment isn't available right now. Try again later.")


def start(user, order_id: uuid.UUID) -> dict:
    _ready()
    order = order_service.payable(user, order_id)
    for old in repo.pending_for_order(order.id):
        old.status = "cancelled"  # only the newest pay link works
    ticket = secrets.token_urlsafe(32)
    repo.add(
        Payment(
            order_id=order.id,
            user_id=user.id,
            amount_cents=order.total_cents,
            ticket_hash=_digest(ticket),
            ticket_expires_at=utcnow() + timedelta(minutes=TICKET_MINUTES),
        )
    )
    db.session.commit()
    return {"pay_url": f"{current_app.config['APP_BASE_URL']}/pay/{ticket}", "amount_cents": order.total_cents}


def completed_reference(order_id: uuid.UUID) -> Optional[str]:
    """PayFast's reference for the order's completed payment (for the receipt)."""
    payment = next((p for p in repo.for_order(order_id) if p.status == "complete"), None)
    return payment.provider_reference if payment else None


def form_for_ticket(ticket: str) -> Optional[dict]:
    """(PayFast's URL, the signed fields), or None if the link is used up."""
    if not ticket or len(ticket) > 100:
        return None
    payment = repo.by_ticket_hash(_digest(ticket))
    if payment is None or payment.status != "pending" or payment.ticket_expires_at <= utcnow():
        return None
    order = order_service.get_for_payment(payment.order_id)
    db.session.rollback()  # only reading: release the lock
    if order is None or order.status != "awaiting_payment":
        return None
    base = current_app.config["APP_BASE_URL"]
    fields = payfast.payment_form(
        payment_id=str(payment.id),
        amount_cents=payment.amount_cents,
        item_name=f"Order {order.reference}",
        item_description=f"{order.supplier_name} via Akayza",
        return_url=f"{base}/pay/done?order={order.reference}",
        cancel_url=f"{base}/pay/cancelled?order={order.reference}",
        notify_url=f"{base}/api/v1/payments/payfast/notify",
    )
    return {"action": payfast.process_url(), "fields": fields, "reference": order.reference, "amount": payfast.rands(payment.amount_cents)}


def handle_itn(posted: list[tuple[str, str]], remote_ip: Optional[str]) -> str:
    """Returns what happened (for tests and the audit trail)."""
    data = dict(posted)
    passphrase = current_app.config["PAYFAST_PASSPHRASE"]
    try:
        payment_id = uuid.UUID(data.get("m_payment_id", ""))
    except ValueError:
        return _itn_refused("unknown_payment")

    if not payfast.itn_signature_ok(posted, passphrase):
        return _itn_refused("bad_signature", payment_id)
    if not payfast.from_payfast(remote_ip):
        return _itn_refused("not_from_payfast", payment_id)

    payment = repo.by_id(payment_id, lock=True)
    if payment is None:
        return _itn_refused("unknown_payment", payment_id)
    if payment.status == "complete":
        db.session.rollback()
        return "already_complete"  # PayFast repeats notifications: harmless
    if not payfast.amount_ok(posted, payment.amount_cents):
        db.session.rollback()
        return _itn_refused("wrong_amount", payment_id)
    if not payfast.confirmed_by_payfast(posted):
        db.session.rollback()
        return _itn_refused("not_confirmed", payment_id)

    payment.itn_payload = {k: data[k] for k in ITN_KEPT if k in data}
    payment.provider_reference = data.get("pf_payment_id")
    if data.get("payment_status") != "COMPLETE":
        payment.status = "failed" if data.get("payment_status") == "FAILED" else "cancelled"
        payment.failure_reason = (data.get("payment_status") or "")[:120]
        db.session.commit()
        return payment.status

    payment.status = "complete"
    payment.completed_at = utcnow()
    order = order_service.get_for_payment(payment.order_id)
    paid_in_time = order is not None and order_service.mark_paid(order, payment.provider_reference or "")
    if not paid_in_time:
        payment.failure_reason = "Paid after the order lapsed: refund due"
    db.session.commit()
    order_audit.record(
        E.ORDER_STATUS_CHANGED if paid_in_time else E.ORDER_REFUSED, ok=paid_in_time, actor="system",
        order_id=payment.order_id, payment_id=payment.id, amount_cents=payment.amount_cents,
        reason=None if paid_in_time else "paid_after_lapse",
    )
    return "paid" if paid_in_time else "paid_late"


def _itn_refused(reason: str, payment_id: Optional[uuid.UUID] = None) -> str:
    db.session.rollback()
    order_audit.record(E.ORDER_REFUSED, ok=False, actor="system", reason=f"itn_{reason}", payment_id=payment_id)
    return f"refused:{reason}"
