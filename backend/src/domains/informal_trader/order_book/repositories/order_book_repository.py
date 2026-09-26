"""
All database access for the order book. Only this feature's services call
this, and EVERY query takes the trader's user_id: a row that isn't theirs
is simply not found (IDOR rule). An order is found by (user_id,
client_key), never by the key alone.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Iterable, Optional

from sqlalchemy import text

from src.extensions import db

from ..models import OrderBookItem, OrderBookLine, OrderBookOrder

# ---------------------------------------------------------------------- menu


def items(user_id: uuid.UUID) -> list[OrderBookItem]:
    """Every item the trader ever had, shown and hidden."""
    return OrderBookItem.query.filter_by(user_id=user_id, is_deleted=False).order_by(OrderBookItem.position, OrderBookItem.created_at).all()


def items_by_id(user_id: uuid.UUID, item_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, OrderBookItem]:
    ids = list(set(item_ids))
    if not ids:
        return {}
    rows = OrderBookItem.query.filter(OrderBookItem.user_id == user_id, OrderBookItem.is_deleted.is_(False), OrderBookItem.id.in_(ids))
    return {r.id: r for r in rows}


def lock_menu(user_id: uuid.UUID) -> None:
    """One menu save at a time per trader (two phones saving at once
    would otherwise both add "Cold drink")."""
    db.session.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"order_book_menu:{user_id}"})


# -------------------------------------------------------------------- orders


def order(user_id: uuid.UUID, client_key: uuid.UUID, *, lock: bool = False) -> Optional[OrderBookOrder]:
    query = OrderBookOrder.query.filter_by(user_id=user_id, client_key=client_key, is_deleted=False)
    if lock:
        query = query.with_for_update(of=OrderBookOrder)
    return query.first()


def orders_on(user_id: uuid.UUID, first: date, last: date) -> list[OrderBookOrder]:
    return (
        OrderBookOrder.query.filter(OrderBookOrder.user_id == user_id, OrderBookOrder.is_deleted.is_(False), OrderBookOrder.day >= first, OrderBookOrder.day <= last)
        .order_by(OrderBookOrder.day, OrderBookOrder.number)
        .all()
    )


def next_number(user_id: uuid.UUID, day: date) -> int:
    """The day's next number, in one atomic statement: two phones never get
    the same one. The row stays locked until commit, so a rolled-back order
    gives its number back."""
    row = db.session.execute(
        text(
            """
            INSERT INTO trader.order_book_days (id, user_id, day, last_number, created_at, updated_at, is_deleted)
            VALUES (:id, :user_id, :day, 1, now(), now(), false)
            ON CONFLICT (user_id, day) DO UPDATE
               SET last_number = trader.order_book_days.last_number + 1, updated_at = now()
            RETURNING last_number
            """
        ),
        {"id": uuid.uuid4(), "user_id": user_id, "day": day},
    ).one()
    return int(row[0])


def lines_since(user_id: uuid.UUID, since: datetime) -> list[tuple[OrderBookLine, OrderBookOrder]]:
    """Lines of orders taken since `since` that weren't cancelled."""
    return (
        db.session.query(OrderBookLine, OrderBookOrder)
        .join(OrderBookOrder, OrderBookOrder.id == OrderBookLine.order_id)
        .filter(OrderBookOrder.user_id == user_id, OrderBookOrder.is_deleted.is_(False), OrderBookOrder.status != "cancelled", OrderBookOrder.taken_at >= since)
        .all()
    )


def orders_since(user_id: uuid.UUID, since: datetime) -> int:
    return OrderBookOrder.query.filter(
        OrderBookOrder.user_id == user_id, OrderBookOrder.is_deleted.is_(False), OrderBookOrder.status != "cancelled", OrderBookOrder.taken_at >= since
    ).count()


def add(row) -> None:
    db.session.add(row)
