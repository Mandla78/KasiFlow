"""
Payment -- one attempt to pay an order through PayFast.

The app gets a pay link holding a random TICKET (stored only as a keyed
hash, like password resets): opening it sends the trader to PayFast with
a form our server signed. The order becomes paid ONLY from PayFast's
notification (ITN) after all four checks (services/payfast.py); coming
back from PayFast's page proves nothing.

m_payment_id sent to PayFast is this row's id, so a notification maps to
exactly one payment. itn_payload keeps what PayFast sent, minus the
signature and personal details.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import JSONB, UUID

from src.core.base_model import BaseModel
from src.extensions import db

STATUSES = ("pending", "complete", "failed", "cancelled")


class Payment(BaseModel):
    __tablename__ = "payments"
    __table_args__ = (
        db.CheckConstraint(f"status IN ({', '.join(repr(s) for s in STATUSES)})", name="ck_payments_status"),
        db.CheckConstraint("amount_cents > 0", name="ck_payments_amount"),
        {"schema": "commerce"},
    )

    order_id = db.Column(UUID(as_uuid=True), db.ForeignKey("commerce.orders.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="RESTRICT"), nullable=False)
    provider = db.Column(db.String(10), nullable=False, default="payfast")
    amount_cents = db.Column(db.BigInteger, nullable=False)
    status = db.Column(db.String(10), nullable=False, default="pending")
    ticket_hash = db.Column(db.String(64), nullable=False, unique=True)
    ticket_expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    #: PayFast's own id for the payment (from the ITN).
    provider_reference = db.Column(db.String(40), nullable=True)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    itn_payload = db.Column(JSONB, nullable=True)
    failure_reason = db.Column(db.String(120), nullable=True)
