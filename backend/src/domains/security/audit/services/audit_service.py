"""
Subscribes to src/shared/audit and stores every event.

Writes are synchronous (on their own connection, see the repository):
identity events are low-volume and must not be lost to a crashed
background thread. When a high-volume domain arrives, route its events
through src/shared/queue with an app context (TruConnect's pattern).

NEVER RAISES into the audited action: a failed audit write is logged,
and the login (or whatever was audited) still completes.
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from flask import Flask

from src.shared.audit import audit
from src.shared.audit.audit_types import AuditEvent

from ..repositories import audit_repository

logger = logging.getLogger("akayza.audit")

_registered = False


def _uuid_or_none(value) -> Optional[uuid.UUID]:
    if value is None:
        return None
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None


def to_values(event: AuditEvent) -> dict:
    return {
        "timestamp": event.timestamp,
        "domain": event.domain.value,
        "module": event.module,
        "event_name": event.event_name.value,
        "category": event.category.value if event.category else None,
        "severity": event.severity.value if event.severity else None,
        "status": event.status.value,
        "failure_reason": (event.failure_reason or None) and event.failure_reason[:255],
        "actor_type": event.actor_type.value,
        "user_id": _uuid_or_none(event.user_id),
        "email": event.email,
        "role": event.role,
        "tenant_id": _uuid_or_none(event.tenant_id),
        "ip_address": event.ip_address,
        "user_agent": event.user_agent,
        "browser": event.browser,
        "operating_system": event.operating_system,
        "platform": event.platform,
        "device_id": event.device_id,
        "session_id": event.session_id,
        "correlation_id": event.correlation_id,
        "request_id": event.request_id,
        "http_method": event.http_method,
        "endpoint": event.endpoint,
        "http_status_code": event.http_status_code,
        "metadata": event.metadata or {},  # the DB column name (event_metadata in Python)
    }


def register(app: Flask) -> None:
    """Called once from create_app()."""
    global _registered
    if _registered:
        return

    def _persist(event: AuditEvent) -> None:
        try:
            audit_repository.insert(to_values(event))
        except Exception:  # noqa: BLE001 -- auditing must never break the audited action
            logger.exception("failed to store audit event=%s", event.event_name.value)

    audit.register_listener(_persist)
    _registered = True
