"""
One way for supplier_profile to write to the audit trail. Never raises:
auditing must not break the action being audited.
"""
from __future__ import annotations

from typing import Any, Optional

from src.shared.audit.audit import publish
from src.shared.audit.audit_types import ActorType, AuditCategory, AuditDomain, AuditEvent, AuditSeverity, AuditStatus
from src.shared.audit.event_types.supplier import SupplierAuditEvent

_ACTORS = {"seed": ActorType.SYSTEM, "feed": ActorType.INTEGRATION, "trader": ActorType.USER}


def record(event: SupplierAuditEvent, *, actor: str = "feed", user_id: Optional[str] = None, **metadata: Any) -> None:
    publish(
        AuditEvent(
            event_name=event,
            domain=AuditDomain.SUPPLIER,
            status=AuditStatus.SUCCESS,
            category=AuditCategory.CONFIGURATION,
            severity=AuditSeverity.INFO,
            module="supplier.supplier_profile",
            actor_type=_ACTORS.get(actor, ActorType.INTEGRATION),
            user_id=user_id,
            metadata={k: v for k, v in metadata.items() if v is not None},
        )
    )
