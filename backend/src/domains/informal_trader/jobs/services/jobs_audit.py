"""
One way for jobs to write to the audit trail. Ids, amounts, outcomes and
photo hashes only: never a client's name or phone number, a note, a
ticket or a photo URL. Never raises: auditing must not break the action.
"""
from __future__ import annotations

from typing import Any, Optional

from src.shared.audit.audit import publish
from src.shared.audit.audit_types import AuditCategory, AuditDomain, AuditEvent, AuditSeverity, AuditStatus
from src.shared.audit.event_types.business import BusinessAuditEvent


def record(event: BusinessAuditEvent, *, user_id: Optional[Any] = None, ok: bool = True, **metadata: Any) -> None:
    publish(
        AuditEvent(
            event_name=event,
            domain=AuditDomain.BUSINESS,
            status=AuditStatus.SUCCESS if ok else AuditStatus.FAILURE,
            category=AuditCategory.DATA_ACCESS,
            severity=AuditSeverity.INFO if ok else AuditSeverity.LOW,
            module="informal_trader.jobs",
            user_id=str(user_id) if user_id else None,
            metadata={k: (str(v) if k.endswith("_id") else v) for k, v in metadata.items() if v is not None},
        )
    )
