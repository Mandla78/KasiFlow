"""
The trader's counter menu.

  menu(user)                the items on the menu now, in order
  save_menu(user, items)    the whole menu as it should be now
  price_at(item, when)      what an item cost at a moment (offline orders)

Saving the whole menu keeps it simple for two phones: what you see is what
is saved. An item left out is hidden, never deleted (past orders keep their
own copy of its name and price, and an order taken offline before the
change is still accepted for a while). A new price is a new row with the
time it starts, so the old one stays true for orders taken before it.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from src.core.base_model import utcnow
from src.core.exceptions import ValidationError
from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E

from ..models import OrderBookItem, OrderBookItemPrice
from ..repositories import order_book_repository as repo
from . import order_book_audit


def menu(user) -> list[dict]:
    return [view(i) for i in repo.items(user.id) if i.active]


def save_menu(user, items: list[dict]) -> list[dict]:
    repo.lock_menu(user.id)
    existing = {i.id: i for i in repo.items(user.id)}
    now = utcnow()
    kept: set[uuid.UUID] = set()
    for position, data in enumerate(items):
        if data["id"] is not None:
            row = existing.get(data["id"])
            if row is None:
                db.session.rollback()
                # Someone else's item, or one that never was: the same answer.
                raise ValidationError("That item isn't on your menu. Pull down to refresh.", errors=[{"items": ["That item isn't on your menu."]}])
        else:
            row = OrderBookItem(user_id=user.id, prices=[])
            repo.add(row)
        row.name = data["name"]
        row.ingredients = list(dict.fromkeys(data["ingredients"]))
        row.position = position
        row.active = True
        row.hidden_at = None
        if not row.prices or row.prices[-1].price_cents != data["price_cents"]:
            row.prices.append(OrderBookItemPrice(price_cents=data["price_cents"], valid_from=now))
        if row.id is not None:
            kept.add(row.id)
    for row in existing.values():
        if row.id not in kept and row.active:
            row.active = False
            row.hidden_at = now
    db.session.commit()
    order_book_audit.record(E.ORDER_BOOK_MENU_SAVED, user_id=user.id, items=len(items))
    return menu(user)


def price_at(item: OrderBookItem, when: datetime) -> int:
    """The price that was valid when the order was taken. An order taken a
    moment before the item existed (a phone clock a little behind) gets
    its first price."""
    price = item.prices[0].price_cents
    for p in item.prices:
        if p.valid_from <= when:
            price = p.price_cents
    return price


def view(item: OrderBookItem) -> dict:
    return {"id": str(item.id), "name": item.name, "price_cents": item.prices[-1].price_cents, "ingredients": list(item.ingredients)}
