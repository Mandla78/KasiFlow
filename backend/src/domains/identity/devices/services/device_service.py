"""
devices -- which phone speaks for a user.

Registering a phone revokes any previous one (one active device per user,
also enforced by a unique index), so a lost phone stops working the moment
its owner signs in on a new one. The key is checked to be a real Ed25519
public key before it is stored.

PROOF OF POSSESSION: the phone signs "akayza-device:<public_key>" with its
private key. Anyone can copy a public key; only the phone that holds the
private key can produce this signature. It also rejects keys that parse
but aren't usable (any 32 bytes parse as an Ed25519 key).
"""
from __future__ import annotations

import base64
import binascii
import uuid
from typing import Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from src.core.base_model import utcnow
from src.core.exceptions import ValidationError
from src.extensions import db

from ..models import Device

PLATFORMS = {"android", "ios", "web"}


REGISTRATION_MESSAGE = "akayza-device:{public_key}"


def _b64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _verified_public_key(public_key: str, signature: str) -> bytes:
    """The raw key, only if the signature proves the phone holds the private key."""
    try:
        raw = _b64(public_key)
        canonical = base64.urlsafe_b64encode(raw).decode().rstrip("=")
        Ed25519PublicKey.from_public_bytes(raw).verify(_b64(signature), REGISTRATION_MESSAGE.format(public_key=canonical).encode())
        return raw
    except (binascii.Error, ValueError, InvalidSignature):
        raise ValidationError("This phone's security key is not valid.", code="INVALID_DEVICE_KEY") from None


def active_device(user_id: uuid.UUID) -> Optional[Device]:
    return Device.query.filter_by(user_id=user_id, revoked_at=None).first()


def register(
    user_id: uuid.UUID, public_key: str, signature: str, platform: Optional[str], label: Optional[str]
) -> tuple[Device, Optional[uuid.UUID]]:
    """Registers this phone. Returns (device, previous_device_id).

    The same key again (the same phone signing in again) keeps its device.
    A different key revokes the previous device.
    """
    raw = _verified_public_key(public_key, signature)
    canonical = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    current = active_device(user_id)
    if current and current.public_key == canonical:
        return current, None

    previous_id = None
    if current:
        current.revoked_at = utcnow()
        previous_id = current.id
        db.session.flush()  # free the "one active device" slot first

    device = Device(
        user_id=user_id,
        public_key=canonical,
        platform=platform if platform in PLATFORMS else None,
        label=(label or "").strip()[:80] or None,
    )
    db.session.add(device)
    db.session.flush()
    return device, previous_id
