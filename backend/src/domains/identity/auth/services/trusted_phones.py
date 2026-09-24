"""
Trusted phones -- the "something you have" half of two-factor sign-in.

A phone becomes trusted by entering a code we emailed (at sign-up, or on
its first sign-in). It then holds a random token in its secure storage;
we keep only the token's HMAC. With the right password AND a live token
for the same account, sign-in needs no code. Anything else gets a code.

A token is only good for the account it was issued to: a phone shared by
two traders, or a token copied onto another account's sign-in, still
gets a code.
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Optional

from flask import current_app

from src.core.base_model import utcnow
from src.extensions import db

from ..models import TrustedPhone
from . import secrets


class RevokeReason:
    SIGNED_OUT = "others_signed_out"
    ACCOUNT_CLOSED = "account_closed"


def _lifetime() -> timedelta:
    return timedelta(days=current_app.config["TRUSTED_PHONE_DAYS"])


def match(user_id: uuid.UUID, token: Optional[str]) -> Optional[TrustedPhone]:
    """The live trusted phone for this user and token, or None. Using it
    slides its expiry forward."""
    if not token:
        return None
    phone = TrustedPhone.query.filter_by(token_hash=secrets.digest(token)).first()
    now = utcnow()
    if not phone or phone.user_id != user_id or phone.revoked_at is not None or phone.expires_at <= now:
        return None
    phone.last_used_at = now
    phone.expires_at = now + _lifetime()
    return phone


def add(user_id: uuid.UUID, platform: Optional[str], label: Optional[str]) -> tuple[TrustedPhone, str]:
    """Trust this phone. Returns (row, token): the token goes to the phone
    once and is never stored or shown again."""
    token = secrets.new_token()
    now = utcnow()
    phone = TrustedPhone(
        user_id=user_id, token_hash=secrets.digest(token), platform=platform, label=label,
        created_at=now, last_used_at=now, expires_at=now + _lifetime(),
    )
    db.session.add(phone)
    db.session.flush()
    return phone, token


def revoke_all(user_id: uuid.UUID, reason: str, keep_id: Optional[uuid.UUID] = None) -> int:
    """Stop trusting every phone of a user (except keep_id): they need a code next time."""
    now = utcnow()
    count = 0
    for phone in TrustedPhone.query.filter_by(user_id=user_id, revoked_at=None).all():
        if keep_id is not None and phone.id == keep_id:
            continue
        phone.revoked_at = now
        phone.revoked_reason = reason
        count += 1
    return count


def get(phone_id: Optional[uuid.UUID]) -> Optional[TrustedPhone]:
    return db.session.get(TrustedPhone, phone_id) if phone_id else None


def list_live(user_id: uuid.UUID) -> list[TrustedPhone]:
    now = utcnow()
    return (
        TrustedPhone.query.filter(TrustedPhone.user_id == user_id, TrustedPhone.revoked_at.is_(None), TrustedPhone.expires_at > now)
        .order_by(TrustedPhone.last_used_at.desc())
        .all()
    )


def public_view(phone: TrustedPhone) -> dict:
    return {
        "id": str(phone.id),
        "platform": phone.platform,
        "label": phone.label,
        "trusted_since": phone.created_at.isoformat(),
        "last_used_at": phone.last_used_at.isoformat(),
    }
