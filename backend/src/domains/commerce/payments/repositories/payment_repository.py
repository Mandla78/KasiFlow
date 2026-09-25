"""All database access for payments. Only this feature's services call this."""
from __future__ import annotations

import uuid
from typing import Optional

from src.extensions import db

from ..models import Payment


def add(payment: Payment) -> Payment:
    db.session.add(payment)
    return payment


def by_ticket_hash(ticket_hash: str) -> Optional[Payment]:
    return Payment.query.filter_by(ticket_hash=ticket_hash, is_deleted=False).first()


def by_id(payment_id: uuid.UUID, *, lock: bool = False) -> Optional[Payment]:
    query = Payment.query.filter_by(id=payment_id, is_deleted=False)
    if lock:
        query = query.with_for_update()
    return query.first()


def pending_for_order(order_id: uuid.UUID) -> list[Payment]:
    return Payment.query.filter_by(order_id=order_id, status="pending", is_deleted=False).all()
