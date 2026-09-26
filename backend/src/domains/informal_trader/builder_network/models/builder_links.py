"""
Between two builders, one way: a save (a private bookmark: they aren't
told), a block (they disappear for each other), a report (we review it;
no admin screen yet).
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import NOTE_MAX, REPORT_REASONS

_reasons = ", ".join(f"'{r}'" for r in REPORT_REASONS)


def _user(**kw):
    return db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, **kw)


class BuilderSave(BaseModel):
    __tablename__ = "builder_saves"
    __table_args__ = (db.UniqueConstraint("user_id", "builder_id", name="uq_builder_saves"), {"schema": "trader"})

    user_id = _user()
    builder_id = _user()


class BuilderBlock(BaseModel):
    __tablename__ = "builder_blocks"
    __table_args__ = (db.UniqueConstraint("blocker_id", "blocked_id", name="uq_builder_blocks"), {"schema": "trader"})

    blocker_id = _user()
    blocked_id = _user(index=True)


class BuilderReport(BaseModel):
    __tablename__ = "builder_reports"
    __table_args__ = (db.CheckConstraint(f"reason IN ({_reasons})", name="ck_builder_reports_reason"), {"schema": "trader"})

    reporter_id = _user()
    reported_id = _user(index=True)
    reason = db.Column(db.String(20), nullable=False)
    note = db.Column(db.String(NOTE_MAX), nullable=False, default="")
