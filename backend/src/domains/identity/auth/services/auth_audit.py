"""
One way for identity to write to the audit trail, so every event carries
the same fields (who, which session, which phone, why it failed).

Published through src/shared/audit; the security/audit feature stores it.
Never raises: auditing must not break the action being audited.
"""
from __future__ import annotations

from typing import Any, Optional

from src.shared.audit.audit import publish
from src.shared.audit.audit_types import ActorType, AuditCategory, AuditDomain, AuditEvent, AuditSeverity, AuditStatus
from src.shared.audit.event_types.auth import AuthAuditEvent

# Default severity when an event fails; successes are "info".
_FAILURE_SEVERITY = {
    AuthAuditEvent.TOKEN_REVOKED: AuditSeverity.HIGH,  # e.g. stolen refresh token replayed
    AuthAuditEvent.LOGIN_LOCKED: AuditSeverity.HIGH,
    AuthAuditEvent.LOGIN_BLOCKED: AuditSeverity.MEDIUM,
    AuthAuditEvent.PASSWORD_RESET_FAILED: AuditSeverity.MEDIUM,
    AuthAuditEvent.OTP_EXPIRED: AuditSeverity.MEDIUM,  # code burnt by too many wrong tries
}

_CATEGORY = {
    AuthAuditEvent.REGISTER_SUCCESS: AuditCategory.ACCOUNT_MANAGEMENT,
    AuthAuditEvent.REGISTER_FAILED: AuditCategory.ACCOUNT_MANAGEMENT,
    AuthAuditEvent.REGISTER_RESUMED: AuditCategory.ACCOUNT_MANAGEMENT,
    AuthAuditEvent.EMAIL_VERIFIED: AuditCategory.ACCOUNT_MANAGEMENT,
    AuthAuditEvent.PASSWORD_RESET_SUCCESS: AuditCategory.ACCOUNT_MANAGEMENT,
}


def record(
    event: AuthAuditEvent,
    ok: bool = True,
    *,
    user_id: Optional[Any] = None,
    email: Optional[str] = None,
    reason: Optional[str] = None,
    session_id: Optional[Any] = None,
    device_id: Optional[Any] = None,
    severity: Optional[AuditSeverity] = None,
    actor_type: ActorType = ActorType.USER,
    **metadata: Any,
) -> None:
    publish(
        AuditEvent(
            event_name=event,
            domain=AuditDomain.AUTH,
            status=AuditStatus.SUCCESS if ok else AuditStatus.FAILURE,
            category=_CATEGORY.get(event, AuditCategory.AUTHENTICATION),
            severity=severity or (AuditSeverity.INFO if ok else _FAILURE_SEVERITY.get(event, AuditSeverity.LOW)),
            module="identity.auth",
            actor_type=actor_type,
            user_id=str(user_id) if user_id else None,
            email=email,
            failure_reason=reason,
            session_id=str(session_id) if session_id else None,
            device_id=str(device_id) if device_id else None,
            metadata={k: v for k, v in metadata.items() if v is not None},
        )
    )
