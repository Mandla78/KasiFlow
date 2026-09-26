"""
Orders at the counter, the queue, and the week in numbers.

  orders(user, day)                 a day's orders, by number
  create(user, data)                -> (order, created): idempotent on the
                                       phone's key, so a retry lands once
  step(user, key, status, at)       the queue, one step forward (or cancel)
  week(user, end)                   the 7 days ending on `end`, oldest first

The server prices every line from the menu as it was when the order was
taken, and numbers the day's orders in the order they arrive. "cash" and
"digital" are the trader's own record of how they were paid (their own
card machine, their own EFT): never proof, and never added to anything
the payment provider verified.
"""
from __future__ import annotations

import uuid
from collections import Counter
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError

from src.core.base_model import utcnow
from src.core.exceptions import ConflictError, NotFoundError, ValidationError
from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E

from ..constants import BACK_DAYS, FUTURE_MINUTES, HIDDEN_ITEM_DAYS, NEXT_STATUS, TIMEZONE
from ..models import OrderBookLine, OrderBookOrder
from ..repositories import order_book_repository as repo
from . import order_book_audit
from .menu_service import price_at

SA = ZoneInfo(TIMEZONE)


def today() -> date:
    """The trader's today (South Africa), not the server's or UTC's."""
    return datetime.now(SA).date()


def _invalid(field: str, message: str) -> ValidationError:
    return ValidationError(message, errors=[{field: [message]}])


def _not_found() -> NotFoundError:
    return NotFoundError("We couldn't find that order.")


# -------------------------------------------------------------------- reads


def orders(user, day: date) -> list[dict]:
    return [view(o) for o in repo.orders_on(user.id, day, day)]


def week(user, end: date) -> list[dict]:
    first = end - timedelta(days=6)
    rows = repo.orders_on(user.id, first, end)
    return [day_totals(first + timedelta(days=i), [o for o in rows if o.day == first + timedelta(days=i)]) for i in range(7)]


# ------------------------------------------------------------------- writes


def create(user, data: dict) -> tuple[dict, bool]:
    existing = repo.order(user.id, data["id"])
    if existing is not None:
        return view(existing), False  # a retry: the same order, the same number

    now = utcnow()
    taken = data["created_at"]
    if taken > now + timedelta(minutes=FUTURE_MINUTES):
        raise _invalid("created_at", "The phone's clock is ahead. Check the time and date on the phone.")
    if taken < now - timedelta(days=BACK_DAYS):
        raise _invalid("created_at", f"Orders older than {BACK_DAYS} days can't be added.")
    if data["day"] != taken.astimezone(SA).date():
        raise _invalid("day", "The day doesn't match when the order was taken.")

    items = repo.items_by_id(user.id, [line["item_id"] for line in data["lines"]])
    hidden_ok = now - timedelta(days=HIDDEN_ITEM_DAYS)
    lines = []
    for position, line in enumerate(data["lines"]):
        item = items.get(line["item_id"])
        # Another trader's item is simply not on this menu.
        if item is None or not (item.active or (item.hidden_at and item.hidden_at >= hidden_ok)):
            raise _invalid("lines", "That item isn't on the menu any more.")
        lines.append(OrderBookLine(item_id=item.id, position=position, name=item.name, price_cents=price_at(item, taken), qty=line["qty"]))

    order = OrderBookOrder(
        user_id=user.id,
        client_key=data["id"],
        day=data["day"],
        number=repo.next_number(user.id, data["day"]),
        temp_number=data["temp_number"],
        payment=data["payment"],
        customer_name=data["customer_name"],
        status="new",
        taken_at=taken,
        status_at=taken,
        total_cents=sum(line.price_cents * line.qty for line in lines),
    )
    order.lines = lines
    repo.add(order)
    try:
        db.session.commit()
    except IntegrityError:
        # The same order from the other phone, or a retry, a moment earlier.
        db.session.rollback()
        existing = repo.order(user.id, data["id"])
        if existing is None:
            raise
        return view(existing), False
    order_book_audit.record(E.ORDER_BOOK_ORDER_CREATED, user_id=user.id, order_id=order.id)
    return view(order), True


def step(user, client_key: uuid.UUID, status: str, at: datetime) -> dict:
    """One step forward (new -> preparing -> ready -> collected), or
    cancelled before it's collected. The same status again is a retry."""
    order = repo.order(user.id, client_key, lock=True)
    if order is None:
        db.session.rollback()
        raise _not_found()
    if order.status == status:
        db.session.rollback()
        return view(order)
    allowed = order.status not in ("collected", "cancelled") if status == "cancelled" else NEXT_STATUS.get(order.status) == status
    if not allowed:
        db.session.rollback()
        raise ConflictError(f"This order is already {order.status}.", code="WRONG_STEP")
    if at > utcnow() + timedelta(minutes=FUTURE_MINUTES):
        db.session.rollback()
        raise _invalid("at", "The phone's clock is ahead. Check the time and date on the phone.")
    order.status = status
    # A step can't be before the order was taken (a phone clock changed in between).
    order.status_at = max(at, order.taken_at)
    db.session.commit()
    if status == "cancelled":
        order_book_audit.record(E.ORDER_BOOK_ORDER_CANCELLED, user_id=user.id, order_id=order.id)
    return view(order)


# ------------------------------------------------------------------ helpers


def day_totals(day: date, rows: list[OrderBookOrder]) -> dict:
    """A day in numbers. Cancelled orders don't count; "later" isn't money in."""
    real = [o for o in rows if o.status != "cancelled"]
    by_hour = [0] * 24
    sold: Counter[str] = Counter()
    for o in real:
        by_hour[o.taken_at.astimezone(SA).hour] += 1
        for line in o.lines:
            sold[line.name] += line.qty

    def paid(kind: str) -> int:
        return sum(o.total_cents for o in real if o.payment == kind)

    best = sorted(sold.items(), key=lambda kv: (-kv[1], kv[0]))[:3]
    return {
        "day": day.isoformat(),
        "orders": len(real),
        "cash_cents": paid("cash"),
        "digital_cents": paid("digital"),
        "later_cents": paid("later"),
        "best_sellers": [{"name": name, "qty": qty} for name, qty in best],
        "by_hour": by_hour,
    }


def view(o: OrderBookOrder) -> dict:
    return {
        # The app's own key for the order: its address, the same on every retry.
        "id": str(o.client_key),
        "number": o.number,
        "temp_number": o.temp_number,
        "day": o.day.isoformat(),
        "lines": [{"item_id": str(line.item_id), "name": line.name, "price_cents": line.price_cents, "qty": line.qty} for line in o.lines],
        "total_cents": o.total_cents,
        "payment": o.payment,
        "customer_name": o.customer_name,
        "status": o.status,
        "created_at": o.taken_at.isoformat(),
        "status_at": o.status_at.isoformat(),
    }
