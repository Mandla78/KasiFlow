"""
Application errors. (Hierarchy reused from TruConnect; see REUSE.md.)

Services raise these instead of returning error tuples. The app
factory's single handler turns any AppError into the standard JSON
envelope, so routes never catch them individually.

`code` is stable and machine-readable (e.g. "EMAIL_NOT_VERIFIED"); the
app switches on it instead of parsing the human message. `data` carries
structured detail alongside a failure (e.g. when a code can be resent).
"""
from __future__ import annotations

from typing import Optional


class AppError(Exception):
    """Base class for all application-level errors."""

    status_code = 400
    code: Optional[str] = None

    def __init__(
        self,
        message: str,
        errors: Optional[list] = None,
        status_code: Optional[int] = None,
        code: Optional[str] = None,
        data: Optional[dict] = None,
    ):
        super().__init__(message)
        self.message = message
        self.errors = errors or []
        self.data = data
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ValidationError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHENTICATED"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class EmailNotVerifiedError(ForbiddenError):
    code = "EMAIL_NOT_VERIFIED"


class AccountInactiveError(ForbiddenError):
    code = "ACCOUNT_INACTIVE"


class AccountLockedError(AppError):
    """Temporary lockout after repeated failed sign-in attempts."""

    status_code = 423
    code = "ACCOUNT_LOCKED"


class InvalidApiKeyError(UnauthorizedError):
    """A supplier-integration key that is missing, unknown, revoked or
    expired. ONE error for all of them on purpose: telling an
    unauthenticated caller which case it is confirms a key exists."""

    code = "INVALID_API_KEY"


class ApiKeyScopeError(ForbiddenError):
    """A valid integration key that isn't allowed to do this."""

    code = "API_KEY_SCOPE"
