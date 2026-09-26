"""
One way for delivery addresses to write to the audit trail. Ids only:
never the address text or the pin (where someone lives is personal data).
Never raises: auditing must not break the action.
"""
from __future__ import annotations

from typing import Any, Optional

from src.shared.audit.audit import publish
from src.shared.audit.audit_types import AuditCategory, AuditDomain, AuditEvent, AuditSeverity, AuditStatus
from src.shared.audit.event_types.business import BusinessAuditEvent


def record(event: BusinessAuditEvent, *, user_id: Optional[Any] = None, **metadata: Any) -> None:
    publish(
        AuditEvent(
            event_name=event,
            domain=AuditDomain.BUSINESS,
            status=AuditStatus.SUCCESS,
            category=AuditCategory.DATA_ACCESS,
            severity=AuditSeverity.INFO,
            module="informal_trader.delivery_addresses",
            user_id=str(user_id) if user_id else None,
            metadata={k: (str(v) if k.endswith("_id") else v) for k, v in metadata.items() if v is not None},
        )
    )
