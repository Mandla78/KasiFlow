"""
Job service: alerts older than 90 days are deleted. No arguments, returns
a JobResult, doesn't know it's scheduled.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from src.core.base_model import utcnow
from src.extensions import db
from src.shared.scheduling.scheduling_types import JobResult

from ..constants import RETENTION_DAYS
from ..repositories import notification_repository as repo

logger = logging.getLogger(__name__)


def run() -> JobResult:
    try:
        n = repo.delete_before(utcnow() - timedelta(days=RETENTION_DAYS))
        db.session.commit()
    except Exception:  # noqa: BLE001
        db.session.rollback()
        logger.exception("notifications: clean-up failed")
        return JobResult(success=False, count=0, detail="clean-up failed")
    return JobResult(success=True, count=n, detail=f"{n} alerts older than {RETENTION_DAYS} days deleted")
