"""All database access for delivery addresses. Only this feature's services
call this. Every query takes the trader's user_id."""
from __future__ import annotations

import uuid
from typing import Optional

from src.extensions import db

from ..models import DeliveryAddress


def live_for_user(user_id: uuid.UUID) -> list[DeliveryAddress]:
    return (
        DeliveryAddress.query.filter_by(user_id=user_id, is_deleted=False)
        .order_by(DeliveryAddress.is_default.desc(), DeliveryAddress.created_at)
        .all()
    )


def mine(user_id: uuid.UUID, address_id: uuid.UUID, lock: bool = False) -> Optional[DeliveryAddress]:
    q = DeliveryAddress.query.filter_by(id=address_id, user_id=user_id, is_deleted=False)
    return q.with_for_update().first() if lock else q.first()


def count_live(user_id: uuid.UUID, lock: bool = False) -> int:
    q = DeliveryAddress.query.filter_by(user_id=user_id, is_deleted=False)
    # Locking the trader's rows makes two quick "add" taps count one after the other.
    return len(q.with_for_update().all()) if lock else q.count()


def clear_default(user_id: uuid.UUID) -> None:
    DeliveryAddress.query.filter_by(user_id=user_id, is_deleted=False, is_default=True).update({"is_default": False})
    db.session.flush()


def add(address: DeliveryAddress) -> DeliveryAddress:
    db.session.add(address)
    return address
