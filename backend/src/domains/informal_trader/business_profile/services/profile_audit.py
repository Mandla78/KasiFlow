"""
One way for business_profile to write to the audit trail. Never raises:
auditing must not break the action being audited.
"""
from __future__ import annotations

from typing import Any, Optional

from src.shared.audit.audit import publish
from src.shared.audit.audit_types import AuditCategory, AuditDomain, AuditEvent, AuditSeverity, AuditStatus
from src.shared.audit.event_types.business import BusinessAuditEvent


def record(event: BusinessAuditEvent, ok: bool = True, *, user_id: Optional[Any] = None, reason: Optional[str] = None, **metadata: Any) -> None:
    publish(
        AuditEvent(
            event_name=event,
            domain=AuditDomain.BUSINESS,
            status=AuditStatus.SUCCESS if ok else AuditStatus.FAILURE,
            category=AuditCategory.ACCOUNT_MANAGEMENT,
            severity=AuditSeverity.INFO if ok else AuditSeverity.LOW,
            module="informal_trader.business_profile",
            user_id=str(user_id) if user_id else None,
            failure_reason=reason,
            metadata={k: v for k, v in metadata.items() if v is not None},
        )
    )
