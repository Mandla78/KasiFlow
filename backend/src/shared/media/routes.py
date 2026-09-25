"""
POST /api/v1/media/webhooks/cloudinary-notifications -- Cloudinary calls
this itself (no signed-in user); the signature check in notifications.py
is its only authorisation.

Answers 200 for anything genuine, even a callback we don't act on:
senders retry on errors, and retrying those helps nobody.
"""
from __future__ import annotations

from flask import Blueprint, request

from src.core.responses import error_response, success_response

from . import notifications

media_webhooks_bp = Blueprint("media_webhooks", __name__)


@media_webhooks_bp.post("/api/v1/media/webhooks/cloudinary-notifications")
def cloudinary_notifications():
    try:
        verdict = notifications.receive(
            request.get_data(as_text=True),
            request.headers.get("X-Cld-Timestamp", ""),
            request.headers.get("X-Cld-Signature", ""),
        )
    except notifications.ForgedCallback:
        return error_response(message="Invalid signature.", status_code=401, code="INVALID_SIGNATURE")
    except (ValueError, TypeError):
        return error_response(message="Malformed callback.", status_code=400, code="BAD_CALLBACK")
    return success_response({"outcome": verdict.outcome})
