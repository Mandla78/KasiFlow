"""
Auth tables: how a user proves who they are.

SECRETS ARE NEVER STORED, ONLY THEIR HASHES:
  - passwords: bcrypt (slow on purpose)
  - email codes and reset tokens: HMAC-SHA256 keyed with SECRET_KEY, so a
    leaked database alone can't be used to guess them
"""
from __future__ import annotations

import enum
import uuid

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import utcnow
from src.extensions import db


class PasswordCredential(db.Model):
    """One per user who signs in with a password (Google-only users have none)."""

    __tablename__ = "password_credentials"
    __table_args__ = {"schema": "identity"}

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), primary_key=True)
    password_hash = db.Column(db.String(100), nullable=False)
    failed_attempts = db.Column(db.Integer, nullable=False, default=0)
    #: Set after too many wrong passwords; sign-in refused until then.
    locked_until = db.Column(db.DateTime(timezone=True), nullable=True)
    changed_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)


class CodePurpose(str, enum.Enum):
    VERIFY_EMAIL = "verify_email"


class EmailCode(db.Model):
    """A 6-digit code sent by email. One use; limited attempts; short life."""

    __tablename__ = "email_codes"
    __table_args__ = (
        db.CheckConstraint("purpose IN ('verify_email')", name="ck_email_codes_purpose"),
        {"schema": "identity"},
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, index=True)
    purpose = db.Column(db.String(20), nullable=False)
    code_hash = db.Column(db.String(64), nullable=False)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)


class Session(db.Model):
    """
    One signed-in phone. Access tokens carry its id ("sid"), so revoking the
    session ends access immediately, not when the token expires.

    REFRESH ROTATION WITH THEFT DETECTION: each refresh issues a new refresh
    token and records its jti here. Presenting an OLDER refresh token means
    someone kept a copy, so the whole session is revoked.
    """

    __tablename__ = "sessions"
    __table_args__ = {"schema": "identity"}

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.devices.id", ondelete="SET NULL"), nullable=True)
    refresh_jti = db.Column(db.String(64), nullable=False, unique=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    last_used_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    revoked_at = db.Column(db.DateTime(timezone=True), nullable=True)
    #: Why it ended: logout, password_reset, new_device, refresh_reuse.
    revoked_reason = db.Column(db.String(30), nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(300), nullable=True)


class PasswordReset(db.Model):
    """A one-use password reset link. Only the hash of the token is kept."""

    __tablename__ = "password_resets"
    __table_args__ = {"schema": "identity"}

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = db.Column(db.String(64), nullable=False, unique=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
