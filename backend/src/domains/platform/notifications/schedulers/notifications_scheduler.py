"""
Notifications' scheduled job. Declares only -- the logic lives in jobs/.
Once a day: alerts older than 90 days go.
"""
from __future__ import annotations

from src.master_scheduler.interfaces import JobSpec

from ..jobs import cleanup_old

JOB_SPECS: list[JobSpec] = [
    JobSpec(name="notifications_cleanup_old", func=cleanup_old.run, interval_seconds=86_400),
]
