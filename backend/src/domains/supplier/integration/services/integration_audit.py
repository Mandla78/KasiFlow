"""
One way for integration to write to the audit trail. Never raises:
auditing must not break the action being audited.
"""
from __future__ import annotations

from typing import Any, Optional

from src.shared.audit.audit import publish
from src.shared.audit.audit_types import ActorType, AuditCategory, AuditDomain, AuditEvent, AuditSeverity, AuditStatus
from src.shared.audit.event_types.catalogue import CatalogueAuditEvent

_ACTORS = {"seed": ActorType.SYSTEM, "integration_api": ActorType.INTEGRATION}


def record(event: CatalogueAuditEvent, ok: bool = True, *, actor: str, reason: Optional[str] = None, **metadata: Any) -> None:
    publish(
        AuditEvent(
            event_name=event,
            domain=AuditDomain.CATALOGUE,
            status=AuditStatus.SUCCESS if ok else AuditStatus.FAILURE,
            category=AuditCategory.DATA_ACCESS,
            severity=AuditSeverity.INFO if ok else AuditSeverity.LOW,
            module="supplier.integration",
            actor_type=_ACTORS.get(actor, ActorType.INTEGRATION),
            failure_reason=reason,
            metadata={k: v for k, v in metadata.items() if v is not None},
        )
    )
