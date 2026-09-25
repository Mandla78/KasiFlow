"""
Orders (docs/supplier/04, rules in docs/supplier/12_POLICIES.txt).

  place(user, data)            the trader places an order
  list_mine / get_mine         the trader's own orders only
  cancel(user, id)             cash orders, until the supplier accepts
  supplier_move(id, status)    the supplier's side moves it on (their
                               system later; a dev command until then)
  expire_unpaid(now)           unpaid digital orders lapse after 24 hours

THE SERVER PRICES EVERYTHING. The app sends products and quantities only;
prices, the delivery fee and the total come from the catalogue and the
supplier's terms at this moment, and each line keeps a snapshot.

STOCK is held when the order is placed (an atomic "only if enough is
left" update) and given back if it's cancelled, rejected or lapses.

Only a supplier the trader is CONNECTED to can be ordered from.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from src.core.base_model import utcnow
from src.core.exceptions import AppError, ConflictError, NotFoundError
from src.domains.informal_trader.business_profile.services import business_profile_service
from src.domains.supplier.catalogue.services import catalogue_service
from src.domains.supplier.connections.services import connection_service
from src.domains.supplier.recommendation.services.recommendation_service import distance_km
from src.domains.supplier.supplier_profile.services import supplier_service
from src.extensions import db
from src.shared.audit.event_types.commerce import CommerceAuditEvent as E
from src.shared.constants.commerce_policy import MAX_OPEN_CASH_ORDERS, cash_limit_for

from ..constants import CLOSED_WITHOUT_SALE, SUPPLIER_MOVES, UNPAID_HOURS
from ..models import Order, OrderEvent, OrderLine
from ..repositories import order_repository as repo
from . import order_audit


class OrderRefused(AppError):
    """The order can't be placed as asked; `code` says why (the app shows the message)."""

    status_code = 409


def _refuse(code: str, message: str) -> None:
    db.session.rollback()
    order_audit.record(E.ORDER_REFUSED, ok=False, reason=code)
    raise OrderRefused(message, code=code)


def _rand(cents: int) -> str:
    return f"R{cents / 100:,.2f}".replace(".00", "")


# ------------------------------------------------------------------ placing


def place(user, data: dict) -> dict:
    s = supplier_service.get_active(data["supplier_id"])
    if s is None:
        raise NotFoundError("We couldn't find that supplier.")
    if not connection_service.is_connected(user, s.id):
        _refuse("NOT_CONNECTED", f"Connect with {s.trading_name} before ordering from them.")

    payment, fulfilment = data["payment"], data["fulfilment"]
    if payment == "in_app" and not s.accepts_in_app:
        _refuse("NOT_ACCEPTED", f"{s.trading_name} doesn't take digital payment.")
    if payment == "cash" and not s.accepts_cash:
        _refuse("NOT_ACCEPTED", f"{s.trading_name} doesn't take cash.")
    if fulfilment == "collect" and not s.collect:
        _refuse("NOT_ACCEPTED", f"{s.trading_name} doesn't do collection.")
    if fulfilment == "delivery" and not s.delivers:
        _refuse("NOT_ACCEPTED", f"{s.trading_name} doesn't deliver.")

    address, point = _where(user, s, data)

    products = []
    for line in data["lines"]:
        p = catalogue_service.get_active(line["product_id"])
        if p is None or p.supplier_id != s.id:
            _refuse("NOT_FOUND", "A product in your cart is no longer available. Remove it and try again.")
        if not p.min_qty <= line["qty"] <= p.max_qty:
            _refuse("QUANTITY", f"{p.name}: order between {p.min_qty} and {p.max_qty}.")
        products.append((p, line["qty"]))

    subtotal = sum(p.price_cents * qty for p, qty in products)
    if subtotal < s.minimum_order_cents:
        _refuse("BELOW_MINIMUM", f"{s.trading_name}'s minimum order is {_rand(s.minimum_order_cents)}.")
    free = s.free_delivery_over_cents is not None and subtotal >= s.free_delivery_over_cents
    fee = s.delivery_fee_cents if fulfilment == "delivery" and not free else 0
    total = subtotal + fee

    if payment == "cash":
        limit = cash_limit_for(s.accepts_cash, s.cash_limit_cents)
        if limit is not None and total > limit:
            _refuse("CASH_LIMIT", f"Cash is up to {_rand(limit)} per order. Pay digitally instead.")
        if repo.open_cash_count(user.id) >= MAX_OPEN_CASH_ORDERS:
            _refuse("CASH_LIMIT", f"You can have {MAX_OPEN_CASH_ORDERS} cash orders waiting at a time. Pay digitally for this one.")

    # Last, because it changes stock: hold every line or none.
    for p, qty in products:
        if not catalogue_service.hold_stock(p.id, qty):
            _refuse("OUT_OF_STOCK", f"{p.name} ({p.pack_size}) doesn't have enough stock. Lower the quantity or remove it.")

    now = utcnow()
    digital = payment == "in_app"
    status = "awaiting_payment" if digital else "placed"
    order = repo.add(
        Order(
            reference=f"AKZ-{now.year}-{repo.next_number():06d}",
            user_id=user.id,
            supplier_id=s.id,
            supplier_name=s.trading_name,
            status=status,
            payment_method=payment,
            payment_status="unpaid" if digital else "cash_due",
            fulfilment=fulfilment,
            address=address,
            latitude=point[0] if point else None,
            longitude=point[1] if point else None,
            subtotal_cents=subtotal,
            delivery_fee_cents=fee,
            total_cents=total,
            placed_at=now,
            pay_by=now + timedelta(hours=UNPAID_HOURS) if digital else None,
        )
    )
    for i, (p, qty) in enumerate(products):
        order.lines.append(
            OrderLine(
                position=i, product_id=p.id, name=p.name, pack_size=p.pack_size, unit=p.unit,
                vat_rate=p.vat_rate, unit_price_cents=p.price_cents, qty=qty, line_total_cents=p.price_cents * qty,
            )
        )
    order.events.append(OrderEvent(status=status, actor="trader", at=now))
    db.session.commit()
    order_audit.record(
        E.ORDER_PLACED, user_id=user.id, order_id=order.id, reference=order.reference, supplier_id=s.id,
        total_cents=total, payment=payment, fulfilment=fulfilment, lines=len(products),
    )
    return view(order)


def _where(user, s, data) -> tuple[str, Optional[tuple[Decimal, Decimal]]]:
    """(address text, delivery pin) -- checked against the delivery radius."""
    if data["fulfilment"] == "collect":
        return supplier_service.public_view(s)["address"], None
    if data.get("delivery_point"):
        lat, lng = data["delivery_point"]["latitude"], data["delivery_point"]["longitude"]
        address = data["delivery_address"]
    else:
        profile = business_profile_service.get(user)
        if profile is None or profile.latitude is None:
            _refuse("LOCATION_NEEDED", "Add where your business is, or choose a delivery address.")
        lat, lng = float(profile.latitude), float(profile.longitude)
        address = ", ".join(x for x in (profile.building, profile.street, profile.suburb, profile.city, profile.postal_code) if x)
    km = distance_km(lat, lng, float(s.latitude), float(s.longitude))
    if km > s.delivery_radius_km:
        _refuse("OUTSIDE_DELIVERY_AREA", f"That address is {km:.0f} km away; {s.trading_name} delivers within {s.delivery_radius_km} km. Choose collection instead.")
    return address, (Decimal(f"{lat:.6f}"), Decimal(f"{lng:.6f}"))


# ------------------------------------------------------------------ reading


def list_mine(user) -> list[dict]:
    return [view(o) for o in repo.list_for_user(user.id)]


def get_mine(user, order_id: uuid.UUID) -> dict:
    order = repo.for_user(user.id, order_id)
    if order is None:
        raise NotFoundError("We couldn't find that order.")
    return view(order)


# ------------------------------------------------------------ changing state


def cancel(user, order_id: uuid.UUID) -> dict:
    """Cash orders only, and only until the supplier accepts. A digital
    order is never cancelled by the trader (unpaid ones lapse)."""
    order = repo.for_user(user.id, order_id, lock=True)
    if order is None:
        raise NotFoundError("We couldn't find that order.")
    if order.payment_method != "cash":
        db.session.rollback()
        raise ConflictError("Orders paid digitally can't be cancelled.", code="TOO_LATE")
    if order.status != "placed":
        db.session.rollback()
        raise ConflictError("The supplier already accepted this order, so it can no longer be cancelled.", code="TOO_LATE")
    _close(order, "cancelled", "trader")
    db.session.commit()
    order_audit.record(E.ORDER_CANCELLED, user_id=user.id, order_id=order.id, reference=order.reference)
    return view(order)


def supplier_move(order_id: uuid.UUID, to_status: str, *, note: Optional[str] = None) -> Order:
    """The supplier's side: accept / reject / on its way / ready / delivered / collected."""
    order = repo.by_id(order_id, lock=True)
    if order is None:
        raise NotFoundError("We couldn't find that order.")
    allowed_from = SUPPLIER_MOVES.get(to_status)
    if allowed_from is None or order.status not in allowed_from:
        db.session.rollback()
        raise ConflictError(f"An order that is {order.status.replace('_', ' ')} can't become {to_status.replace('_', ' ')}.", code="BAD_STEP")
    if to_status == "rejected":
        _close(order, "rejected", "supplier", note)
    else:
        order.status = to_status
        order.events.append(OrderEvent(status=to_status, actor="supplier", at=utcnow(), note=note))
    db.session.commit()
    order_audit.record(E.ORDER_STATUS_CHANGED, order_id=order.id, reference=order.reference, status=to_status, actor="supplier")
    return order


def payable(user, order_id: uuid.UUID) -> Order:
    """The trader's own order, if it can be paid now (awaiting payment, in time)."""
    order = repo.for_user(user.id, order_id)
    if order is None:
        raise NotFoundError("We couldn't find that order.")
    if order.status != "awaiting_payment" or (order.pay_by and order.pay_by <= utcnow()):
        raise ConflictError("This order can't be paid any more.", code="NOT_PAYABLE")
    return order


def get_for_payment(order_id: uuid.UUID) -> Optional[Order]:
    """For the payments feature (no trader in the request): the order, locked."""
    return repo.by_id(order_id, lock=True)


def mark_paid(order: Order, provider_reference: str) -> bool:
    """A verified payment arrived: the order goes to the supplier. Returns
    False if the order is no longer waiting (paid already, or it lapsed:
    then the payment is recorded and must be refunded). The caller commits."""
    if order.status != "awaiting_payment":
        return False
    order.status = "placed"
    order.payment_status = "paid"
    order.events.append(OrderEvent(status="placed", actor="system", at=utcnow(), note="Paid"))
    order_audit.record(E.ORDER_STATUS_CHANGED, order_id=order.id, reference=order.reference, status="placed", actor="system", paid_with=provider_reference)
    return True


def expire_unpaid(now: Optional[datetime] = None) -> int:
    """Unpaid digital orders past their pay-by time lapse; their stock goes back."""
    now = now or utcnow()
    expired = repo.unpaid_past(now)
    for order in expired:
        _close(order, "expired", "system")
    db.session.commit()
    for order in expired:
        order_audit.record(E.ORDER_EXPIRED, order_id=order.id, reference=order.reference)
    return len(expired)


def _close(order: Order, status: str, actor: str, note: Optional[str] = None) -> None:
    """Ends an order without a sale and gives its stock back. The caller commits."""
    assert status in CLOSED_WITHOUT_SALE
    for line in order.lines:
        catalogue_service.release_stock(line.product_id, line.qty)
    order.status = status
    order.events.append(OrderEvent(status=status, actor=actor, at=utcnow(), note=note))


# --------------------------------------------------------------------- view


def view(o: Order) -> dict:
    """The trader's view of their order."""
    return {
        "id": str(o.id),
        "reference": o.reference,
        "supplier_id": str(o.supplier_id),
        "supplier_name": o.supplier_name,
        "status": o.status,
        "payment": o.payment_method,
        "payment_status": o.payment_status,
        "fulfilment": o.fulfilment,
        "address": o.address,
        "lines": [
            {
                "product_id": str(l.product_id), "name": l.name, "pack_size": l.pack_size, "unit": l.unit,
                "vat_rate": l.vat_rate, "qty": l.qty, "price_cents": l.unit_price_cents, "line_total_cents": l.line_total_cents,
            }
            for l in o.lines
        ],
        "subtotal_cents": o.subtotal_cents,
        "delivery_fee_cents": o.delivery_fee_cents,
        "total_cents": o.total_cents,
        "placed_at": o.placed_at.isoformat(),
        "pay_by": o.pay_by.isoformat() if o.pay_by else None,
        "events": [{"status": e.status, "at": e.at.isoformat()} for e in o.events],
    }
