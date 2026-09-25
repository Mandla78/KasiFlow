"""
One way for orders to write to the audit trail. Never raises: auditing
must not break the action being audited. Ids, references, amounts and
codes only -- never names, phone numbers or addresses.
"""
from __future__ import annotations

import uuid
from typing import Any, Optional

from src.shared.audit.audit import publish
from src.shared.audit.audit_types import ActorType, AuditCategory, AuditDomain, AuditEvent, AuditSeverity, AuditStatus
from src.shared.audit.event_types.commerce import CommerceAuditEvent

_ACTORS = {"trader": ActorType.USER, "supplier": ActorType.INTEGRATION, "system": ActorType.SYSTEM}


def record(
    event: CommerceAuditEvent, ok: bool = True, *, user_id: Optional[Any] = None, reason: Optional[str] = None,
    actor: str = "trader", **metadata: Any,
) -> None:
    publish(
        AuditEvent(
            event_name=event,
            domain=AuditDomain.COMMERCE,
            status=AuditStatus.SUCCESS if ok else AuditStatus.FAILURE,
            category=AuditCategory.DATA_ACCESS,
            severity=AuditSeverity.INFO if ok else AuditSeverity.LOW,
            module="commerce.orders",
            actor_type=_ACTORS.get(actor, ActorType.USER),
            user_id=str(user_id) if user_id else None,
            failure_reason=reason,
            metadata={k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in metadata.items() if v is not None},
        )
    )
