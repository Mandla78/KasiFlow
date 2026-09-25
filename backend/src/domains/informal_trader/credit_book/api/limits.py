"""
Rate limits for the credit book, counted PER TRADER, not per IP.

A spaza's owner and helper, or two traders on one shop Wi-Fi, share an IP;
keyed on the IP they'd use up each other's allowance. The limiter checks
before @auth_required runs, so the key reads the signed-in user from the
token itself; a missing or bad token falls back to the IP (that request is
refused by @auth_required anyway).
"""
from __future__ import annotations

from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from flask_limiter.util import get_remote_address

READ = "120 per minute"
#: The app searches customers as you type (200 ms pause between searches).
SEARCH = "120 per minute"
WRITE = "60 per minute"
CHANGE = "30 per minute"


def per_user() -> str:
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
    except Exception:  # noqa: BLE001 -- expired or broken token: count by IP
        identity = None
    return f"user:{identity}" if identity else f"ip:{get_remote_address()}"
