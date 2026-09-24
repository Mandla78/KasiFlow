"""
Route guards.

    @auth_required            a signed-in, active user; g.current_user is set
    @auth_required(dashboard="supplier")   ...and only that kind of account

IDOR RULE: a route never trusts a user id from the URL or body to decide
whose data it returns. It uses current_user() (from the token) and scopes
every query to it.
"""
from __future__ import annotations

from functools import wraps
from typing import Callable, Optional

from flask import g
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from src.core.exceptions import ForbiddenError, UnauthorizedError


def auth_required(fn: Optional[Callable] = None, *, dashboard: Optional[str] = None):
    def decorate(view: Callable) -> Callable:
        @wraps(view)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()  # signature, expiry, and live session (jwt_callbacks)
            from src.domains.identity.accounts.services import account_service

            user = account_service.get(get_jwt_identity())
            if not user or not user.is_active:
                raise UnauthorizedError("Please sign in again.", code="SESSION_ENDED")
            if dashboard and user.dashboard != dashboard:
                raise ForbiddenError("You can't do that with this account.")
            g.current_user = user
            return view(*args, **kwargs)

        return wrapper

    return decorate(fn) if fn else decorate


def current_user():
    """The signed-in user for this request (set by @auth_required)."""
    return g.current_user
