"""
Device -- a phone's signing key. The phone makes an Ed25519 key pair and
sends only the PUBLIC key; the private key never leaves the phone.

ONE ACTIVE DEVICE PER USER: registering a new phone revokes the previous
one, so a lost or stolen phone can no longer confirm anything.
"""
from __future__ import annotations

import uuid

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import utcnow
from src.extensions import db


class Device(db.Model):
    __tablename__ = "devices"
    __table_args__ = (
        # At most one active (not revoked) device per user, enforced by the database.
        db.Index("uq_devices_one_active_per_user", "user_id", unique=True, postgresql_where=db.text("revoked_at IS NULL")),
        {"schema": "identity"},
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, index=True)
    #: Raw 32-byte Ed25519 public key, base64url. Validated before storing.
    public_key = db.Column(db.String(64), nullable=False)
    platform = db.Column(db.String(20), nullable=True)  # android / ios / web
    label = db.Column(db.String(80), nullable=True)  # e.g. "Samsung A14"
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    revoked_at = db.Column(db.DateTime(timezone=True), nullable=True)
