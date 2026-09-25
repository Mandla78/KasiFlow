"""
Media's own scheduled jobs. Same convention as
network/connections/schedulers/connections_scheduler.py: this file
only DECLARES jobs -- the logic lives in jobs/, master_scheduler/
registry.py decides how they actually run.

AKAYZA: only the orphan-upload sweep lives here. A stuck-scan sweep reads
a feature's own image table, so each feature that turns malware scanning
on adds its own (shared code never imports a domain).

Orphan upload sweep runs every 30 minutes -- its own grace
period (intents/services.py's own INTENT_GRACE_PERIOD_MINUTES, 60
minutes) is already generous, so checking every 10 minutes would just
be wasted queries against rows that can't have expired yet.
"""
from __future__ import annotations

from src.master_scheduler.interfaces import JobSpec
from src.shared.media.jobs import orphan_upload_sweep

JOB_SPECS: list[JobSpec] = [
    JobSpec(
        name="media_orphan_upload_sweep",
        func=orphan_upload_sweep.run,
        interval_seconds=1800,
    ),
]
