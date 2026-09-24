"""
The Master Scheduler's registry -- collects every domain's own declared
jobs and hands them to the engine. Defines NO jobs itself; "does the
Master Scheduler run business jobs? No -- its responsibility is to
coordinate child schedulers" is enforced here structurally, not just by
convention: this file has no JobSpec literal of its own anywhere in it.

To add a new scheduled job:
    1. Write the job service in its owning domain (a run() function,
       takes no arguments, returns a JobResult) -- unchanged from before.
    2. Declare it in that domain's OWN scheduler file (e.g.
       domains/<area>/<feature>/schedulers/<feature>_scheduler.py), which exports it as
       part of that file's JOB_SPECS list.
    3. Add that domain's JOB_SPECS to ALL_JOB_SPECS below, if this is the
       first job for a brand-new domain (existing domains need no change
       here at all -- adding a job to an existing domain's own scheduler
       file is invisible to this file).
"""

from __future__ import annotations

from typing import Callable, Optional

from src.shared.idempotency.schedulers.idempotency_scheduler import (
    JOB_SPECS as IDEMPOTENCY_JOB_SPECS,
)
from src.domains.identity.auth.schedulers.identity_scheduler import (
    JOB_SPECS as IDENTITY_JOB_SPECS,
)
from src.master_scheduler import runner
from src.master_scheduler.interfaces import JobSpec, SchedulerEngine

# The Master's one and only list of "everyone's jobs, concatenated" --
# every entry originates in a domain's own scheduler file, never here.
ALL_JOB_SPECS: list[JobSpec] = [
    *IDEMPOTENCY_JOB_SPECS,
    *IDENTITY_JOB_SPECS,
    # Each Akayza domain adds its own JOB_SPECS here the same way, e.g.
    # *CREDIT_BOOK_JOB_SPECS from
    # domains/informal_trader/credit_book/schedulers/credit_book_scheduler.py
]


def register_all(engine: SchedulerEngine, context_factory: Optional[Callable] = None) -> None:
    """
    Wrap every declared job with runner.make_safe() and hand it to the
    engine. `context_factory`, if given, is threaded through to every
    job (e.g. Flask app-context wrapping) -- see trigger.py, the only
    caller that knows about Flask.
    """
    for spec in ALL_JOB_SPECS:
        safe_func = runner.make_safe(spec.name, spec.func, context_factory=context_factory)
        engine.add_job(spec.name, safe_func, spec.interval_seconds)
