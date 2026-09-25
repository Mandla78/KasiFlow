"""
"A retried request lands exactly once" for any write route (the credit
book's sales and payments, placing an order...). Written by Risuna for the
credit book; moved here so every feature shares one implementation.

A phone on a bad signal sends "new credit sale", the answer never arrives,
and the app tries again. With the same Idempotency-Key header the second
try gets the first answer instead of adding the sale twice. Uses
src/shared/idempotency (claim -> run -> store; 5xx releases the claim).
Without the header the request simply runs.
"""
from __future__ import annotations

from typing import Callable

from flask import jsonify, request

from src.core.decorators import current_user
from src.core.exceptions import AppError, ConflictError, ValidationError
from src.core.responses import error_response
from src.shared.idempotency import service as idempotency

HEADER = "Idempotency-Key"


def run_once(handler: Callable):
    """Run handler() (returning a (response, status) pair) at most once per key."""
    key = request.headers.get(HEADER)
    if key is None:
        return handler()
    if not 8 <= len(key) <= 255 or not key.isprintable():
        raise ValidationError("Please check the highlighted fields.", errors=[{HEADER: ["Send 8 to 255 printable characters."]}])

    try:
        claim = idempotency.claim(key, current_user().id, f"{request.method} {request.path}", idempotency.fingerprint(request.get_data()))
    except idempotency.IdempotencyConflict:
        raise ValidationError("This Idempotency-Key was already used for a different request.", code="IDEMPOTENCY_KEY_REUSED") from None
    except idempotency.IdempotencyInFlight:
        raise ConflictError("This request is still being saved. Try again in a moment.", code="REQUEST_IN_PROGRESS") from None

    if claim.is_complete:
        return jsonify(claim.response_body), claim.status_code

    try:
        response, status = handler()
    except AppError as e:
        # A refusal is a deterministic answer about the request: store it too.
        response, status = error_response(e.message, errors=e.errors, status_code=e.status_code, code=e.code, data=e.data)
    except Exception:
        idempotency.release(claim)
        raise
    if status >= 500:
        idempotency.release(claim)
    else:
        idempotency.complete(claim, status, response.get_json())
    return response, status
