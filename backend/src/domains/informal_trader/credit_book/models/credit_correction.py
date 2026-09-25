"""
CreditCorrection -- a change to an entry, with what it was before.

kind "correction": new amount / due date / description; the entry shows
the new values, this row keeps the old ones. kind "cancellation": the
entry was made by mistake (only allowed with nothing paid back).
NEVER updated or deleted.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import CORRECTION_KINDS

_kinds = ", ".join(f"'{k}'" for k in CORRECTION_KINDS)


class CreditCorrection(BaseModel):
    __tablename__ = "credit_corrections"
    __table_args__ = (
        db.CheckConstraint(f"kind IN ({_kinds})", name="ck_credit_corrections_kind"),
        db.Index("ix_credit_corrections_entry_id", "entry_id"),
        {"schema": "trader"},
    )

    entry_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trader.credit_entries.id", ondelete="RESTRICT"), nullable=False)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
    kind = db.Column(db.String(12), nullable=False)
    before_amount_cents = db.Column(db.BigInteger, nullable=False)
    after_amount_cents = db.Column(db.BigInteger, nullable=False)
    before_due_on = db.Column(db.Date, nullable=False)
    after_due_on = db.Column(db.Date, nullable=False)
    before_description = db.Column(db.String(120), nullable=False, default="")
    after_description = db.Column(db.String(120), nullable=False, default="")
    reason = db.Column(db.String(120), nullable=False, default="")
