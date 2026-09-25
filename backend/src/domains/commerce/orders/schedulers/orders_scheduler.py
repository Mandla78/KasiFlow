"""
Orders' scheduled job. Declares only -- the logic lives in jobs/.
Every 10 minutes: an unpaid order holds stock, so it shouldn't linger
long past its 24 hours.
"""
from __future__ import annotations

from src.master_scheduler.interfaces import JobSpec

from ..jobs import expire_unpaid

JOB_SPECS: list[JobSpec] = [
    JobSpec(name="orders_expire_unpaid", func=expire_unpaid.run, interval_seconds=600),
]
