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
import re
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
#: How each kind of proof is worded on documents and the check page.
EVIDENCE_TEXT = {
    "provider_verified": "Verified by PayFast (a regulated payment provider)",
    "confirmed_by_both": "Cash: confirmed by both parties in the app; not verified by a payment provider",
    "not_confirmed": "Cash: not confirmed yet",
    "none": "No payment",
}

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


def _people(order) -> tuple[dict, dict, object]:
    """(seller, buyer, the supplier row) as they appear on the documents."""
    s = supplier_service.get(order.supplier_id)
    seller = {
        "name": s.legal_name or s.trading_name,
        "trading_as": s.trading_name,
        "address": supplier_service.public_view(s)["address"],
        "vat_number": s.vat_number,
        "email": s.orders_email,
        "phone": s.phone,
    }
    trader = account_service.get(order.user_id)
    profile = business_profile_service.get(trader) if trader else None
    address = ""
    if profile is not None:
        address = ", ".join(x for x in (profile.building, profile.street, profile.suburb, profile.city, profile.postal_code) if x)
    buyer = {
        "business": (profile.business_name if profile else None) or "Customer",
        "owner": profile.owner_name if profile else None,
        "email": trader.email if trader else None,
        "phone": profile.cellphone if profile else None,
        "address": address or None,
        # CIPC only when the trader gave one; "verified" only when our check said so.
        "cipc_number": profile.cipc_number if profile and profile.cipc_number else None,
        "cipc_name": profile.cipc_registered_name if profile and profile.cipc_status == "verified" else None,
        "cipc_verified": bool(profile and profile.cipc_status == "verified"),
    }
    return seller, buyer, s


def _order_facts(order) -> dict:
    return {
        "evidence": EVIDENCE_TEXT[order_service.payment_evidence(order)],
        "reference": order.reference,
        "placed": order.placed_at.strftime("%Y-%m-%d %H:%M"),
        "fulfilment": ("Delivery to " if order.fulfilment == "delivery" else "Collection at ") + order.address,
        "payment": "Digital payment (PayFast)" if order.payment_method == "in_app" else "Cash",
    }


def invoice(order_id: uuid.UUID) -> dict:
    order = order_service.get_order(order_id)
    if order is None or not available(order)["invoice"]:
        raise NotFoundError("Not found.")
    seller, buyer, s = _people(order)
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
    # Dated when the sale became firm: the supplier accepted, or it was paid.
    firm = next((e for e in order.events if e.status == "accepted"), None)
    number = "INV-" + order.reference.removeprefix("AKZ-")
    return {
        "title": ("Tax Invoice" if registered else "Invoice"),
        # Over R5,000 the buyer's details are REQUIRED (full tax invoice);
        # we show them on every invoice anyway.
        "full": registered and order.total_cents > FULL_INVOICE_OVER_CENTS,
        "number": number,
        "date": (firm.at if firm else order.placed_at).date().isoformat(),
        "order": _order_facts(order),
        "order_reference": order.reference,
        "supplier": seller,
        "buyer": buyer,
        "lines": lines,
        "total_cents": order.total_cents,
        "vat_cents": vat,
        "excl_cents": order.total_cents - vat,
        "paid": order.payment_status in ("paid", "confirmed_by_both"),
        "note": None if registered else "The supplier is not registered for VAT; no VAT is charged.",
        "verify_url": verify_url(number),
    }


def receipt(order_id: uuid.UUID) -> dict:
    order = order_service.get_order(order_id)
    if order is None or not available(order)["receipt"]:
        raise NotFoundError("Not found.")
    seller, buyer, _ = _people(order)
    paid_event = next((e for e in order.events if e.note == "Paid"), None) or next(
        (e for e in reversed(order.events) if e.status in ("delivered", "collected")), None
    )
    number = "RCT-" + order.reference.removeprefix("AKZ-")
    return {
        "number": number,
        "date": (paid_event.at if paid_event else order.placed_at).strftime("%Y-%m-%d %H:%M"),
        "order": _order_facts(order),
        "order_reference": order.reference,
        "supplier": seller,
        "buyer": buyer,
        "method": "Digital payment (PayFast): card or instant EFT" if order.payment_method == "in_app" else "Cash, confirmed by both",
        "provider_reference": payment_service.completed_reference(order.id) if order.payment_method == "in_app" else None,
        "total_cents": order.total_cents,
        "verify_url": verify_url(number),
    }


# ----------------------------------------------------- "is this genuine?" QR


def _verify_sig(number: str) -> str:
    key = current_app.config["SECRET_KEY"].encode()
    return hmac.new(key, f"verify:{number}".encode(), hashlib.sha256).hexdigest()[:32]


def verify_url(number: str) -> str:
    """Permanent public link in the QR code: anyone holding the document can
    check it's ours. Signed, so numbers can't be tried one by one."""
    return f"{current_app.config['APP_BASE_URL']}/verify/{number}?s={_verify_sig(number)}"


def verify(number: str, sig: str) -> Optional[dict]:
    """What the public check page may show: never the buyer's details."""
    if not re.fullmatch(r"(INV|RCT)-\d{4}-\d{6}", number or "") or not hmac.compare_digest(_verify_sig(number), sig or ""):
        return None
    order = order_service.get_by_reference("AKZ-" + number[4:])
    if order is None:
        return None
    kind = "invoice" if number.startswith("INV") else "receipt"
    if not available(order)[kind]:
        return None
    firm = next((e for e in order.events if e.status == "accepted" or e.note == "Paid"), None)
    return {
        "kind": "Invoice" if kind == "invoice" else "Payment receipt",
        "number": number,
        "supplier": order.supplier_name,
        "order_reference": order.reference,
        "date": (firm.at if firm else order.placed_at).date().isoformat(),
        "total": f"R{order.total_cents / 100:,.2f}",
        "paid": order.payment_status in ("paid", "confirmed_by_both"),
        "evidence": EVIDENCE_TEXT[order_service.payment_evidence(order)],
    }


def kind_data(kind: str, order_id: uuid.UUID) -> Optional[dict]:
    return invoice(order_id) if kind == "invoice" else receipt(order_id)
