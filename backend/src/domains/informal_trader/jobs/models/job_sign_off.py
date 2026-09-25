"""
JobSignOff -- one sign-off link the builder sent for a stage. NEVER deleted.

The ticket in the link is the client's only key (no app, no login): 256
random bits, stored ONLY as an HMAC (ticket_hash), one use, 7 days, and
revoked when the builder sends a new link for the same stage. Both amounts
of every attempt stay here, so a dispute is never lost.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import SIGN_OFF_OUTCOMES

_outcomes = ", ".join(f"'{o}'" for o in SIGN_OFF_OUTCOMES)


class JobSignOff(BaseModel):
    __tablename__ = "job_sign_offs"
    __table_args__ = (
        db.CheckConstraint(f"outcome IS NULL OR outcome IN ({_outcomes})", name="ck_job_sign_offs_outcome"),
        db.CheckConstraint("builder_amount_cents >= 0", name="ck_job_sign_offs_builder_amount"),
        db.CheckConstraint("client_amount_cents IS NULL OR client_amount_cents >= 0", name="ck_job_sign_offs_client_amount"),
        db.Index("ix_job_sign_offs_stage_id", "stage_id"),
        {"schema": "trader"},
    )

    stage_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trader.job_stages.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
    ticket_hash = db.Column(db.String(64), nullable=False, unique=True)
    builder_amount_cents = db.Column(db.BigInteger, nullable=False)
    client_amount_cents = db.Column(db.BigInteger, nullable=True)
    client_note = db.Column(db.String(200), nullable=True)
    outcome = db.Column(db.String(20), nullable=True)
    sent_at = db.Column(db.DateTime(timezone=True), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)
    revoked_at = db.Column(db.DateTime(timezone=True), nullable=True)
    #: How the client confirmed: honest about a link being weaker than two signed phones.
    via = db.Column(db.String(10), nullable=False, default="link")
