"""All database access for orders. Only this feature's services call this.
Every query a trader triggers takes their user_id: an order that isn't
theirs is simply not found."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import func, text

from src.extensions import db

from ..constants import OPEN
from ..models import Order

LIST_LIMIT = 100


def next_number() -> int:
    """From a database sequence: unique even when two orders land at once."""
    return int(db.session.execute(text("SELECT nextval('commerce.order_number_seq')")).scalar_one())


def add(order: Order) -> Order:
    db.session.add(order)
    return order


def for_user(user_id: uuid.UUID, order_id: uuid.UUID, *, lock: bool = False) -> Optional[Order]:
    query = Order.query.filter_by(id=order_id, user_id=user_id, is_deleted=False)
    if lock:
        query = query.with_for_update(of=Order)
    return query.first()


def by_id(order_id: uuid.UUID, *, lock: bool = False) -> Optional[Order]:
    """For the supplier's side and jobs, never for a trader's request."""
    query = Order.query.filter_by(id=order_id, is_deleted=False)
    if lock:
        query = query.with_for_update(of=Order)
    return query.first()


def by_reference(reference: str) -> Optional[Order]:
    return Order.query.filter_by(reference=reference, is_deleted=False).first()


def list_for_user(user_id: uuid.UUID) -> list[Order]:
    return Order.query.filter_by(user_id=user_id, is_deleted=False).order_by(Order.placed_at.desc()).limit(LIST_LIMIT).all()


def all_for_user(user_id: uuid.UUID) -> list[Order]:
    """Every order of this trader (for money totals; no limit)."""
    return Order.query.filter_by(user_id=user_id, is_deleted=False).all()


def open_cash_count(user_id: uuid.UUID) -> int:
    return (
        db.session.query(func.count(Order.id))
        .filter(Order.user_id == user_id, Order.payment_method == "cash", Order.status.in_(OPEN), Order.is_deleted.is_(False))
        .scalar()
    )


def unpaid_past(now: datetime) -> list[Order]:
    return (
        Order.query.filter(Order.status == "awaiting_payment", Order.pay_by <= now, Order.is_deleted.is_(False))
        .with_for_update(skip_locked=True)
        .all()
    )
