"""
Identity clean-up: keep only what's still needed (POPIA data minimisation)
and keep the tables small.

  email codes, reset links    removed 1 day after they expire or are used
  ended sessions              removed 30 days after they end (the audit
                              trail keeps the history)
  trusted phones              removed 30 days after they expire or are
                              revoked
  never-verified sign-ups     deleted after 7 days: an unconfirmed address
                              proves nothing, and holding it helps no one

Job contract: no arguments, returns a JobResult, doesn't know it's scheduled.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from sqlalchemy import or_

from src.core.base_model import utcnow
from src.extensions import db
from src.shared.audit.audit_types import ActorType
from src.shared.audit.event_types.auth import AuthAuditEvent as E
from src.shared.scheduling.scheduling_types import JobResult

from ..models import EmailCode, PasswordReset, Session, TrustedPhone
from ..services import auth_audit

logger = logging.getLogger("akayza.auth.cleanup")

CODES_GRACE = timedelta(days=1)
SESSIONS_GRACE = timedelta(days=30)
UNVERIFIED_AFTER = timedelta(days=7)


def run() -> JobResult:
    from src.domains.identity.accounts.services import account_service

    try:
        now = utcnow()
        codes = EmailCode.query.filter(
            or_(EmailCode.expires_at < now - CODES_GRACE, EmailCode.used_at < now - CODES_GRACE)
        ).delete(synchronize_session=False)
        resets = PasswordReset.query.filter(
            or_(PasswordReset.expires_at < now - CODES_GRACE, PasswordReset.used_at < now - CODES_GRACE)
        ).delete(synchronize_session=False)
        sessions = Session.query.filter(
            or_(Session.revoked_at < now - SESSIONS_GRACE, Session.expires_at < now - SESSIONS_GRACE)
        ).delete(synchronize_session=False)
        # Sessions first: they point at trusted phones.
        phones = TrustedPhone.query.filter(
            or_(TrustedPhone.revoked_at < now - SESSIONS_GRACE, TrustedPhone.expires_at < now - SESSIONS_GRACE)
        ).delete(synchronize_session=False)
        stale = account_service.unverified_older_than(now - UNVERIFIED_AFTER)
        for user in stale:
            auth_audit.record(E.UNVERIFIED_ACCOUNT_EXPIRED, user_id=user.id, email=user.email, actor_type=ActorType.SCHEDULER)
            account_service.delete_unverified(user)
        db.session.commit()
    except Exception:  # noqa: BLE001 -- a failed sweep must not crash the scheduler
        db.session.rollback()
        logger.exception("identity cleanup failed")
        return JobResult(success=False, detail="identity cleanup failed")
    total = codes + resets + sessions + phones + len(stale)
    return JobResult(
        success=True,
        count=total,
        detail=f"{codes} codes, {resets} reset links, {sessions} sessions, {phones} trusted phones, {len(stale)} unverified sign-ups removed",
    )
