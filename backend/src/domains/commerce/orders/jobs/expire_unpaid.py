"""
Job service: unpaid digital orders lapse after 24 hours and give their
stock back. No arguments, returns a JobResult, doesn't know it's scheduled.
"""
from __future__ import annotations

import logging

from src.extensions import db
from src.shared.scheduling.scheduling_types import JobResult

from ..services import order_service

logger = logging.getLogger(__name__)


def run() -> JobResult:
    try:
        n = order_service.expire_unpaid()
    except Exception:  # noqa: BLE001
        db.session.rollback()
        logger.exception("orders: expire unpaid failed")
        return JobResult(success=False, count=0, detail="expire failed")
    return JobResult(success=True, count=n, detail=f"{n} unpaid orders lapsed")
