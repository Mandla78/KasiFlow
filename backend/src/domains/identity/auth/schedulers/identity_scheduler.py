"""When identity's jobs run. Hourly is plenty: nothing here is urgent."""
from __future__ import annotations

from src.master_scheduler.interfaces import JobSpec

from ..jobs import cleanup

JOB_SPECS: list[JobSpec] = [
    JobSpec(name="identity_cleanup", func=cleanup.run, interval_seconds=3600),
]
