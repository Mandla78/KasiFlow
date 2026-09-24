"""
Wires flask-jwt-extended into our rules:
  * every token must belong to a live session (instant logout/revocation)
  * token errors use our standard JSON envelope with stable codes,
    and never say WHY a token was rejected beyond "sign in again"
"""
from __future__ import annotations

from flask_jwt_extended import JWTManager

from src.core.responses import error_response

from . import session_service


def register(jwt: JWTManager) -> None:
    @jwt.token_in_blocklist_loader
    def _revoked(_header: dict, payload: dict) -> bool:
        return not session_service.is_alive(session_service.get(payload.get("sid", "")))

    @jwt.unauthorized_loader
    def _missing(_reason: str):
        return error_response("Please sign in.", status_code=401, code="UNAUTHENTICATED")

    @jwt.invalid_token_loader
    def _invalid(_reason: str):
        return error_response("Please sign in again.", status_code=401, code="UNAUTHENTICATED")

    @jwt.expired_token_loader
    def _expired(_header: dict, _payload: dict):
        return error_response("Your session expired. Please sign in again.", status_code=401, code="TOKEN_EXPIRED")

    @jwt.revoked_token_loader
    def _revoked_response(_header: dict, _payload: dict):
        return error_response("Please sign in again.", status_code=401, code="SESSION_ENDED")
