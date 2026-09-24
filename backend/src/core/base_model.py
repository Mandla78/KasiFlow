"""
Base model: UUID primary keys, timezone-aware timestamps and soft
delete on every table. (Reused from TruConnect; see REUSE.md.)

Every model inherits from BaseModel instead of redeclaring these
columns, and sets __table_args__ = {"schema": "<schema>"}, one of
config.DB_SCHEMAS. Schemas group tables; they don't have to match the
code's domains one-to-one.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import UUID

from src.extensions import db


def utcnow() -> datetime:
    """Timezone-aware "now". Never use naive datetimes in this codebase."""
    return datetime.now(timezone.utc)


class BaseModel(db.Model):
    __abstract__ = True

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)

    def soft_delete(self) -> None:
        """Marks the row deleted without removing it. Repositories filter
        is_deleted=False instead of relying on the row being gone."""
        self.is_deleted = True
        self.deleted_at = utcnow()
