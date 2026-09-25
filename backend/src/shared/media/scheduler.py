"""Media's scheduled job, collected by src/master_scheduler/registry.py."""
from __future__ import annotations

from src.master_scheduler.interfaces import JobSpec

from . import sweep

JOB_SPECS: list[JobSpec] = [
    # Every 30 minutes: uploads get 60 minutes to finish, so checking more
    # often would only find rows that can't have expired yet.
    JobSpec(name="media_abandoned_upload_sweep", func=sweep.run, interval_seconds=1800),
]
