"""
Platform's own audit event vocabulary (cross-cutting system/scheduler
events, not owned by any one business domain) -- moved here from the
single flat AuditEventName enum, same reasoning as event_types/auth.py's
own docstring.
"""
from __future__ import annotations

import enum


class PlatformAuditEvent(str, enum.Enum):
    SCHEDULED_JOB_COMPLETED = "platform.scheduled_job_completed"
    SCHEDULED_JOB_FAILED = "platform.scheduled_job_failed"
    # Media (shared/media/sweep.py): uploads started but never finished
    # (app closed mid-upload); their files were deleted.
    MEDIA_ABANDONED_UPLOADS_DELETED = "platform.media_abandoned_uploads_deleted"
