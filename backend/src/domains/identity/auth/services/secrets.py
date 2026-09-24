"""
Making and checking one-time secrets (email codes, reset tokens).

Stored values are HMAC-SHA256 keyed with SECRET_KEY: a copy of the
database alone is not enough to test guesses offline. Comparisons are
constant-time so response timing doesn't leak how close a guess was.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets

from flask import current_app


def new_code() -> str:
    """A 6-digit code, uniformly random (never starting-digit biased)."""
    return f"{secrets.randbelow(1_000_000):06d}"


def new_token() -> str:
    """A 256-bit URL-safe token for links."""
    return secrets.token_urlsafe(32)


def digest(value: str) -> str:
    key = current_app.config["SECRET_KEY"].encode()
    return hmac.new(key, value.encode(), hashlib.sha256).hexdigest()


def matches(value: str, stored_digest: str) -> bool:
    return hmac.compare_digest(digest(value), stored_digest)
