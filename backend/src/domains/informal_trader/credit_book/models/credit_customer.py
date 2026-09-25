"""
CreditCustomer -- someone who takes goods now and pays later.

The trader's own data: a name they choose (a nickname is fine) and,
optionally, a cellphone used only to open WhatsApp on the trader's phone.
No ID numbers, no addresses. Never shown to suppliers or on a shared
record.

Deleting a customer anonymises them (name -> "Deleted customer", phone
gone, soft-deleted); their entries and payments stay so the book still
adds up.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db


class CreditCustomer(BaseModel):
    __tablename__ = "credit_customers"
    __table_args__ = (
        db.CheckConstraint("phone IS NULL OR phone ~ '^0[6-8][0-9]{8}$'", name="ck_credit_customers_phone"),
        db.Index("ix_credit_customers_user_id", "user_id"),
        {"schema": "trader"},
    )

    #: The trader (identity.users) whose book this is.
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.String(60), nullable=False)
    phone = db.Column(db.String(10), nullable=True)
