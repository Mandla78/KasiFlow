"""
Order documents (docs/supplier/08): the invoice and the payment receipt.

INVOICE -- in the SUPPLIER's name: they sold the goods. Akayza issues it
on their behalf as their agent (VAT Act s54(2); the Supplier Agreement
must say so). Which kind (VAT Act s20):
  - supplier registered for VAT (has a VAT number):
      up to R5,000  -> abridged TAX INVOICE
      over R5,000   -> full TAX INVOICE (also names the buyer)
  - not registered -> INVOICE, no VAT charged or shown
  Available once the supplier accepts the order, or once a digital order
  is paid. Number: INV-<the order number>.

RECEIPT -- from Akayza, confirming the payment: once a digital payment is
confirmed, or once both sides confirm a cash payment.

Links: a trader asks for one; the server hands back a URL signed with
SECRET_KEY that works for 10 minutes (no login in a PDF viewer, nothing
guessable, nothing stored).
"""
from __future__ import annotations

import hashlib
import hmac
import time
import uuid
from dataclasses import dataclass
from typing import Optional

from flask import current_app

from src.core.exceptions import ConflictError, NotFoundError
from src.domains.commerce.orders.services import order_service
from src.domains.commerce.payments.services import payment_service
from src.domains.identity.accounts.services import account_service
from src.domains.informal_trader.business_profile.services import business_profile_service
from src.domains.supplier.supplier_profile.services import supplier_service

KINDS = ("invoice", "receipt")
LINK_SECONDS = 600
FULL_INVOICE_OVER_CENTS = 500_000
VAT_PERCENT = 15


@dataclass
class Line:
    description: str
    qty: int
    unit_cents: int
    total_cents: int
    vat_cents: int
    zero_rated: bool


def vat_in(inclusive_cents: int) -> int:
    """The VAT inside a VAT-inclusive amount at 15%, rounded to the cent."""
    return round(inclusive_cents * VAT_PERCENT / (100 + VAT_PERCENT))


# --------------------------------------------------------------- availability


def available(order) -> dict[str, bool]:
    """The rule lives with orders (it's about an order's state)."""
    return order_service.documents_ready(order)


# --------------------------------------------------------------- signed links


def _sign(kind: str, order_id: str, expires: int) -> str:
    key = current_app.config["SECRET_KEY"].encode()
    return hmac.new(key, f"{kind}:{order_id}:{expires}".encode(), hashlib.sha256).hexdigest()


def link(user, order_id: uuid.UUID, kind: str) -> str:
    order = order_service.owned_order(user, order_id)
    if not available(order).get(kind):
        raise ConflictError(
            "The invoice is ready once the supplier accepts your order." if kind == "invoice" else "The receipt is ready once the payment is confirmed.",
            code="NOT_READY",
        )
    expires = int(time.time()) + LINK_SECONDS
    return f"{current_app.config['APP_BASE_URL']}/documents/{kind}/{order.id}?exp={expires}&sig={_sign(kind, str(order.id), expires)}"


def check_link(kind: str, order_id: str, expires: str, sig: str) -> bool:
    if kind not in KINDS or not expires.isdigit() or int(expires) < time.time():
        return False
    return hmac.compare_digest(_sign(kind, order_id, int(expires)), sig or "")


# ------------------------------------------------------------------ content


def invoice(order_id: uuid.UUID) -> dict:
    order = order_service.get_order(order_id)
    if order is None or not available(order)["invoice"]:
        raise NotFoundError("Not found.")
    s = supplier_service.get(order.supplier_id)
    registered = bool(s.vat_number)
    lines = [
        Line(
            description=f"{l.name} ({l.pack_size})",
            qty=l.qty,
            unit_cents=l.unit_price_cents,
            total_cents=l.line_total_cents,
            vat_cents=0 if not registered or l.vat_rate == "zero" else vat_in(l.line_total_cents),
            zero_rated=l.vat_rate == "zero",
        )
        for l in order.lines
    ]
    if order.delivery_fee_cents:
        lines.append(Line("Delivery", 1, order.delivery_fee_cents, order.delivery_fee_cents, vat_in(order.delivery_fee_cents) if registered else 0, False))
    vat = sum(l.vat_cents for l in lines)
    full = registered and order.total_cents > FULL_INVOICE_OVER_CENTS
    buyer = None
    if full:
        trader = account_service.get(order.user_id)
        profile = business_profile_service.get(trader) if trader else None
        buyer = {
            "name": (profile.business_name if profile else None) or "Customer",
            "address": order.address,
        }
    # The invoice is dated when the sale became firm: accepted, or paid.
    firm = next((e for e in order.events if e.status == "accepted" or e.note == "Paid"), None)
    accepted_at = firm.at if firm else order.placed_at
    return {
        "title": ("Tax Invoice" if registered else "Invoice"),
        "full": full,
        "number": "INV-" + order.reference.removeprefix("AKZ-"),
        "date": accepted_at.date().isoformat(),
        "order_reference": order.reference,
        "supplier": {
            "name": s.legal_name or s.trading_name,
            "trading_as": s.trading_name,
            "address": supplier_service.public_view(s)["address"],
            "vat_number": s.vat_number,
        },
        "buyer": buyer,
        "lines": lines,
        "total_cents": order.total_cents,
        "vat_cents": vat,
        "excl_cents": order.total_cents - vat,
        "note": None if registered else "The supplier is not registered for VAT; no VAT is charged.",
    }


def receipt(order_id: uuid.UUID) -> dict:
    order = order_service.get_order(order_id)
    if order is None or not available(order)["receipt"]:
        raise NotFoundError("Not found.")
    paid_event = next((e for e in reversed(order.events) if e.note == "Paid" or e.status in ("delivered", "collected")), None)
    return {
        "number": "RCT-" + order.reference.removeprefix("AKZ-"),
        "date": (paid_event.at if paid_event else order.placed_at).date().isoformat(),
        "order_reference": order.reference,
        "supplier": order.supplier_name,
        "method": "Digital payment (PayFast)" if order.payment_method == "in_app" else "Cash, confirmed by both",
        "provider_reference": payment_service.completed_reference(order.id) if order.payment_method == "in_app" else None,
        "total_cents": order.total_cents,
    }


def kind_data(kind: str, order_id: uuid.UUID) -> Optional[dict]:
    return invoice(order_id) if kind == "invoice" else receipt(order_id)
