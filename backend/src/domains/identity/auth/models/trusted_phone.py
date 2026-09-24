"""
TrustedPhone -- a phone that has passed the email code once (2FA).

TWO FACTORS AT SIGN-IN: the password (something you know) and either a
trusted phone (something you have) or a fresh code sent to your email.
After the code, the phone gets a random 256-bit token kept in its secure
storage; only the HMAC of it is stored here. Presenting it later skips
the code, until it expires (unused for TRUSTED_PHONE_DAYS) or is revoked
("sign out other phones", closing the account).
"""
from __future__ import annotations

import uuid

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import utcnow
from src.extensions import db


class TrustedPhone(db.Model):
    __tablename__ = "trusted_phones"
    __table_args__ = {"schema": "identity"}

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = db.Column(db.String(64), nullable=False, unique=True)
    platform = db.Column(db.String(20), nullable=True)  # android / ios / web
    label = db.Column(db.String(80), nullable=True)  # e.g. "Samsung A14"
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    last_used_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    #: Slides forward on every use: a phone left unused for long must prove itself again.
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    revoked_at = db.Column(db.DateTime(timezone=True), nullable=True)
    revoked_reason = db.Column(db.String(30), nullable=True)
