"""
The server's two seal-signing keys, and signing and checking with both.

  Ed25519     RFC 8032, through `cryptography`
  ML-DSA-65   NIST FIPS 204, the post-quantum signature standard, through
              dilithium-py (pure Python, MIT)

A seal carries both signatures, so it stays checkable even if one of the
two schemes is ever broken -- in particular by a quantum computer, which
would break Ed25519 but not ML-DSA.

Both keys are derived from one secret (SEAL_SECRET, else SECRET_KEY) with
HKDF-SHA256 and a separate label each: nothing to store, the same keys
after a restart. Changing the secret retires the keys, so older seals can
no longer be checked -- give production its own SEAL_SECRET and keep it.

If dilithium-py isn't installed, seals are signed with Ed25519 alone and
say so; nothing else breaks.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import os
from functools import lru_cache
from typing import Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from flask import current_app

try:
    from dilithium_py.ml_dsa import ML_DSA_65
except ImportError:  # pragma: no cover -- the switch is tested by patching ML_DSA_65
    ML_DSA_65 = None

ED25519, ML_DSA = "Ed25519", "ML-DSA-65"


def _derive(secret: bytes, label: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=b"akayza-record-seal", info=label).derive(secret)


@lru_cache(maxsize=4)
def _keys(secret: bytes, with_ml_dsa: bool):
    ed = Ed25519PrivateKey.from_private_bytes(_derive(secret, b"ed25519 v1"))
    ed_pub = ed.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    ml = ML_DSA_65.key_derive(_derive(secret, b"ml-dsa-65 v1")) if with_ml_dsa else None  # (public, private)
    return ed, ed_pub, ml


def _current():
    secret = current_app.config.get("SEAL_SECRET") or os.environ.get("SEAL_SECRET") or current_app.config["SECRET_KEY"]
    return _keys(secret.encode(), ML_DSA_65 is not None)


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def key_id(public_key: bytes) -> str:
    return hashlib.sha256(public_key).hexdigest()[:16]


def algorithms() -> list[str]:
    return [ED25519, ML_DSA] if ML_DSA_65 is not None else [ED25519]


def public_keys() -> dict:
    """What anyone needs to check a seal's signatures without us."""
    _, ed_pub, ml = _current()
    keys = {"ed25519": {"algorithm": ED25519, "standard": "RFC 8032", "id": key_id(ed_pub), "public_key": _b64(ed_pub)}}
    if ml:
        keys["ml_dsa_65"] = {"algorithm": ML_DSA, "standard": "NIST FIPS 204", "id": key_id(ml[0]), "public_key": _b64(ml[0])}
    return keys


def sign(message: bytes) -> dict:
    ed, ed_pub, ml = _current()
    return {
        "sig": {"ed25519": _b64(ed.sign(message)), "ml_dsa_65": _b64(ML_DSA_65.sign(ml[1], message)) if ml else None},
        "key_ids": {"ed25519": key_id(ed_pub), "ml_dsa_65": key_id(ml[0]) if ml else None},
    }


def _decode(value: Optional[str]) -> Optional[bytes]:
    try:
        return base64.b64decode(value, validate=True) if value else None
    except (binascii.Error, ValueError):
        return None


def verify(message: bytes, sig: dict, key_ids: dict, alg: list[str]) -> dict:
    """Each signature: "valid", "invalid", "old_key" (made with a key we no
    longer hold), "absent" (the seal has none) or "unavailable" (ML-DSA
    can't be checked on this server)."""
    _, ed_pub, ml = _current()
    out: dict = {}

    if key_ids.get("ed25519") != key_id(ed_pub):
        out["ed25519"] = "old_key"
    else:
        raw = _decode(sig.get("ed25519"))
        try:
            Ed25519PublicKey.from_public_bytes(ed_pub).verify(raw or b"", message)
            out["ed25519"] = "valid" if raw else "invalid"
        except InvalidSignature:
            out["ed25519"] = "invalid"

    if ML_DSA not in alg:
        out["ml_dsa_65"] = "absent"
    elif not ml:
        out["ml_dsa_65"] = "unavailable"
    elif key_ids.get("ml_dsa_65") != key_id(ml[0]):
        out["ml_dsa_65"] = "old_key"
    else:
        raw = _decode(sig.get("ml_dsa_65"))
        try:
            out["ml_dsa_65"] = "valid" if raw and ML_DSA_65.verify(ml[0], message, raw) else "invalid"
        except Exception:  # a malformed signature is simply not valid
            out["ml_dsa_65"] = "invalid"
    return out
