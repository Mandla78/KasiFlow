"""
Sessions and tokens.

  access token   15 min, carries "sid" (the session id)
  refresh token  30 days, carries "sid"; rotated on every use

Every request checks that its session is still alive (see jwt_callbacks),
so logging out, resetting a password or switching phones cuts access off
immediately rather than when the token happens to expire.
"""
from __future__ import annotations

import uuid
from typing import Optional

from flask import current_app, request
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token

from src.core.base_model import utcnow
from src.extensions import db
from src.shared.net.client_ip import client_ip

from ..models import Session


class RevokeReason:
    LOGOUT = "logout"
    PASSWORD_RESET = "password_reset"
    NEW_DEVICE = "new_device"
    REFRESH_REUSE = "refresh_reuse"
    PASSWORD_CHANGE = "password_change"
    OTHERS_SIGNED_OUT = "others_signed_out"
    ACCOUNT_CLOSED = "account_closed"


def _issue(user_id: uuid.UUID, sid: uuid.UUID) -> tuple[str, str, str]:
    claims = {"sid": str(sid)}
    access = create_access_token(identity=str(user_id), additional_claims=claims)
    refresh = create_refresh_token(identity=str(user_id), additional_claims=claims)
    jti = decode_token(refresh)["jti"]
    return access, refresh, jti


def start(user_id: uuid.UUID, device_id: Optional[uuid.UUID], trusted_phone_id: Optional[uuid.UUID] = None) -> tuple[dict, uuid.UUID]:
    """A new signed-in session. Returns (tokens for the app, session id)."""
    sid = uuid.uuid4()
    access, refresh, jti = _issue(user_id, sid)
    db.session.add(
        Session(
            id=sid,
            user_id=user_id,
            device_id=device_id,
            trusted_phone_id=trusted_phone_id,
            refresh_jti=jti,
            expires_at=utcnow() + current_app.config["JWT_REFRESH_TOKEN_EXPIRES"],
            ip_address=client_ip(),
            user_agent=(request.headers.get("User-Agent") or "")[:300] or None,
        )
    )
    return {"access_token": access, "refresh_token": refresh, "token_type": "Bearer"}, sid


def get(sid: str) -> Optional[Session]:
    try:
        return db.session.get(Session, uuid.UUID(sid))
    except (ValueError, TypeError):
        return None


def is_alive(session: Optional[Session]) -> bool:
    return session is not None and session.revoked_at is None and session.expires_at > utcnow()


def rotate(session: Session, presented_jti: str) -> Optional[dict]:
    """New tokens for a refresh. If the refresh token isn't the latest one
    issued for this session, someone kept an old copy: kill the session."""
    if presented_jti != session.refresh_jti:
        revoke(session, RevokeReason.REFRESH_REUSE)
        return None
    access, refresh, jti = _issue(session.user_id, session.id)
    session.refresh_jti = jti
    session.last_used_at = utcnow()
    return {"access_token": access, "refresh_token": refresh, "token_type": "Bearer"}


def revoke(session: Session, reason: str) -> None:
    if session.revoked_at is None:
        session.revoked_at = utcnow()
        session.revoked_reason = reason


def revoke_all(user_id: uuid.UUID, reason: str, device_id: Optional[uuid.UUID] = None) -> int:
    """Revoke every live session of a user (or only those on one device)."""
    q = Session.query.filter_by(user_id=user_id, revoked_at=None)
    if device_id is not None:
        q = q.filter_by(device_id=device_id)
    count = 0
    for s in q.all():
        revoke(s, reason)
        count += 1
    return count


def revoke_all_except(user_id: uuid.UUID, keep_sid: str, reason: str) -> int:
    """Sign out every other phone, keep this one."""
    keep = get(keep_sid)
    count = 0
    for s in Session.query.filter_by(user_id=user_id, revoked_at=None).all():
        if keep is None or s.id != keep.id:
            revoke(s, reason)
            count += 1
    return count


def live_for(user_id: uuid.UUID) -> list[Session]:
    now = utcnow()
    return (
        Session.query.filter(Session.user_id == user_id, Session.revoked_at.is_(None), Session.expires_at > now)
        .order_by(Session.last_used_at.desc())
        .all()
    )
