"""
CreditPayment -- money paid back on an entry, recorded by the trader.
NEVER updated or deleted: a payment typed by mistake is fixed with a
correction on the entry, and both stay in the history.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db


class CreditPayment(BaseModel):
    __tablename__ = "credit_payments"
    __table_args__ = (
        db.CheckConstraint("amount_cents > 0", name="ck_credit_payments_amount"),
        db.Index("ix_credit_payments_entry_id", "entry_id"),
        {"schema": "trader"},
    )

    entry_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trader.credit_entries.id", ondelete="RESTRICT"), nullable=False)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
    amount_cents = db.Column(db.BigInteger, nullable=False)
    paid_on = db.Column(db.Date, nullable=False)
