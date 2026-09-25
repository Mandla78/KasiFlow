"""
One way for the credit book to write to the audit trail. Ids and amounts
only: never a customer's name, phone number, what they took, or a reason
typed by the trader. Never raises: auditing must not break the action.
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
            module="informal_trader.credit_book",
            user_id=str(user_id) if user_id else None,
            metadata={k: (str(v) if k.endswith("_id") else v) for k, v in metadata.items() if v is not None},
        )
    )
