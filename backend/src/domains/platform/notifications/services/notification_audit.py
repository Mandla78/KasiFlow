"""
One way for notifications to write to the audit trail: which switch was
turned on or off. Reading alerts isn't audited (too noisy, not
disputable). Never raises.
"""
from __future__ import annotations

from typing import Any, Optional

from src.shared.audit.audit import publish
from src.shared.audit.audit_types import AuditCategory, AuditDomain, AuditEvent, AuditSeverity, AuditStatus
from src.shared.audit.event_types.platform import PlatformAuditEvent


def record(event: PlatformAuditEvent, *, user_id: Optional[Any] = None, **metadata: Any) -> None:
    publish(
        AuditEvent(
            event_name=event,
            domain=AuditDomain.PLATFORM,
            status=AuditStatus.SUCCESS,
            category=AuditCategory.DATA_ACCESS,
            severity=AuditSeverity.INFO,
            module="platform.notifications",
            user_id=str(user_id) if user_id else None,
            metadata={k: v for k, v in metadata.items() if v is not None},
        )
    )
