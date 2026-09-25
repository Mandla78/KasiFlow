"""
CreditEntry -- one credit sale: a customer took goods and pays back later.

NEVER DELETED, not even softly. The columns hold the CURRENT values; a
correction (credit_correction.py) keeps what they were before, so the
history always adds up. Paid-back money is in credit_payment.py.

status: open until the payments reach the amount, then paid; cancelled
only for an entry made by mistake with nothing paid back.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import MAX_AMOUNT_CENTS, STATUSES

_statuses = ", ".join(f"'{s}'" for s in STATUSES)


class CreditEntry(BaseModel):
    __tablename__ = "credit_entries"
    __table_args__ = (
        db.CheckConstraint(f"amount_cents > 0 AND amount_cents <= {MAX_AMOUNT_CENTS}", name="ck_credit_entries_amount"),
        db.CheckConstraint(f"status IN ({_statuses})", name="ck_credit_entries_status"),
        db.CheckConstraint("due_on >= given_on", name="ck_credit_entries_due_after_given"),
        db.Index("ix_credit_entries_user_status_due", "user_id", "status", "due_on"),
        {"schema": "trader"},
    )

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
    customer_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trader.credit_customers.id", ondelete="RESTRICT"), nullable=False)
    amount_cents = db.Column(db.BigInteger, nullable=False)
    description = db.Column(db.String(120), nullable=False, default="")
    given_on = db.Column(db.Date, nullable=False)
    due_on = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(10), nullable=False, default="open")

    customer = db.relationship("CreditCustomer", lazy="joined")
