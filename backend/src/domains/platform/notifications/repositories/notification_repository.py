"""
All database access for notifications. Only this feature's services call
this, and every query about someone's alerts takes their user_id: a row
that isn't theirs is simply not found (IDOR rule).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import func, tuple_
from sqlalchemy.dialects.postgresql import insert

from src.extensions import db

from ..models import Notification, NotificationSettings


def insert_once(values: dict) -> bool:
    """Write one alert in its own transaction (the listener runs on the
    background queue, after the action's own commit). The same
    (user_id, dedupe_key) again is ignored. True when a row was written."""
    stmt = (
        insert(Notification.__table__)
        .values(id=uuid.uuid4(), created_at=func.now(), updated_at=func.now(), is_deleted=False, **values)
        .on_conflict_do_nothing(index_elements=["user_id", "dedupe_key"])
    )
    with db.engine.begin() as conn:
        return conn.execute(stmt).rowcount == 1


def settings(user_id: uuid.UUID) -> Optional[NotificationSettings]:
    return NotificationSettings.query.filter_by(user_id=user_id, is_deleted=False).first()


def add(row) -> None:
    db.session.add(row)


def one(user_id: uuid.UUID, notification_id: uuid.UUID) -> Optional[Notification]:
    return Notification.query.filter_by(id=notification_id, user_id=user_id, is_deleted=False).first()


def page(user_id: uuid.UUID, tab: str, before: Optional[Notification], limit: int) -> list[Notification]:
    """Newest first; `before` is the last row of the previous page."""
    query = Notification.query.filter_by(user_id=user_id, tab=tab, is_deleted=False)
    if before is not None:
        query = query.filter(tuple_(Notification.created_at, Notification.id) < tuple_(before.created_at, before.id))
    return query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).all()


def unread_counts(user_id: uuid.UUID) -> dict[str, int]:
    rows = (
        db.session.query(Notification.tab, func.count(Notification.id))
        .filter(Notification.user_id == user_id, Notification.read_at.is_(None), Notification.is_deleted.is_(False))
        .group_by(Notification.tab)
        .all()
    )
    return {tab: int(n) for tab, n in rows}


def latest(user_id: uuid.UUID) -> Optional[Notification]:
    return (
        Notification.query.filter_by(user_id=user_id, is_deleted=False)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .first()
    )


def mark_all_read(user_id: uuid.UUID, tab: str, at: datetime) -> int:
    return (
        Notification.query.filter(
            Notification.user_id == user_id, Notification.tab == tab, Notification.read_at.is_(None), Notification.is_deleted.is_(False)
        ).update({Notification.read_at: at}, synchronize_session=False)
    )


def delete_before(cutoff: datetime) -> int:
    """Hard delete: old alerts are copies of things kept elsewhere (orders,
    jobs, the audit trail), not a record of their own."""
    return Notification.query.filter(Notification.created_at < cutoff).delete(synchronize_session=False)
