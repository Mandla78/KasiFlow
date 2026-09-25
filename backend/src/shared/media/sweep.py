"""
Abandoned-upload clean-up (scheduled; see scheduler.py).

An upload that was started but never finished before expires_at may have
left a file on Cloudinary with nothing pointing at it (app closed mid-way,
connection lost). This deletes exactly those files, the ones recorded in
media_uploads, never anything else in the storage account.

Job contract: no arguments, returns a JobResult, doesn't know it's scheduled.
"""
from __future__ import annotations

import logging

from src.core.base_model import utcnow
from src.extensions import db
from src.shared.audit.audit import publish
from src.shared.audit.audit_types import ActorType, AuditDomain, AuditEvent, AuditStatus
from src.shared.audit.event_types.platform import PlatformAuditEvent
from src.shared.scheduling.scheduling_types import JobResult

from .models import MediaUpload, UploadState
from .provider import get_provider

logger = logging.getLogger("akayza.media.sweep")


def run() -> JobResult:
    try:
        stale = MediaUpload.query.filter(MediaUpload.state == UploadState.STARTED.value, MediaUpload.expires_at < utcnow()).all()
        provider = get_provider()
        for upload in stale:
            try:
                provider.delete(upload.public_id)
            except Exception:  # noqa: BLE001 -- one failed delete must not stop the rest
                logger.exception("media sweep: could not delete %s", upload.public_id)
            upload.state = UploadState.ABANDONED.value
        db.session.commit()
    except Exception:  # noqa: BLE001 -- a failed sweep must not crash the scheduler
        db.session.rollback()
        logger.exception("media sweep failed")
        return JobResult(success=False, detail="media sweep failed")

    if stale:
        publish(
            AuditEvent(
                event_name=PlatformAuditEvent.MEDIA_ABANDONED_UPLOADS_DELETED,
                domain=AuditDomain.PLATFORM,
                status=AuditStatus.SUCCESS,
                actor_type=ActorType.SCHEDULER,
                module="shared.media",
                metadata={"count": len(stale)},
            )
        )
    return JobResult(success=True, count=len(stale), detail=f"{len(stale)} abandoned uploads deleted")
