"""
Writes audit rows on a SEPARATE connection from the request's session:
the row survives even if the request's own transaction rolls back, and
inserting it never commits the request's unfinished work.
"""
from __future__ import annotations

import uuid
from typing import Optional

from src.extensions import db

from ..models import AuditEventRecord


def insert(values: dict) -> None:
    table = AuditEventRecord.__table__
    with db.engine.begin() as conn:  # own transaction, committed immediately
        conn.execute(table.insert().values(id=uuid.uuid4(), **values))


def recent(user_id: Optional[uuid.UUID] = None, event_name: Optional[str] = None, limit: int = 100) -> list[AuditEventRecord]:
    q = AuditEventRecord.query
    if user_id is not None:
        q = q.filter_by(user_id=user_id)
    if event_name is not None:
        q = q.filter_by(event_name=event_name)
    return q.order_by(AuditEventRecord.timestamp.desc()).limit(limit).all()
