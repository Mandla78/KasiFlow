"""
Background task queue. (Reused from TruConnect; see REUSE.md.)

A bounded pool of in-process daemon threads. Anything slow (sending an
email, writing an audit row, fetching an image) is enqueue()d so an
HTTP request never waits on it.

The pool size (BACKGROUND_WORKER_POOL_SIZE, default 5) is also what
protects the server: however many jobs arrive at once, at most that
many run at the same time; the rest wait their turn.

A real message broker can replace this later by changing only this
file: callers just call enqueue() and don't care how the job runs.
"""
from __future__ import annotations

import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from typing import Callable, Optional

logger = logging.getLogger("akayza.queue")

# How many jobs can genuinely run AT THE SAME TIME. Tune via env var,
# no code change needed -- same "real constant, overridable per
# environment" pattern used throughout this build (e.g.
# CLOUDINARY_MODERATION_ENABLED).
MAX_WORKERS = int(os.environ.get("BACKGROUND_WORKER_POOL_SIZE", "5"))

_executor: Optional[ThreadPoolExecutor] = None
_executor_lock = Lock()

# ThreadPoolExecutor has no built-in "how many tasks are currently
# queued or running" introspection -- tracked explicitly instead of
# reaching into its private internals.
_pending_count = 0
_pending_lock = Lock()


def _ensure_executor_started() -> ThreadPoolExecutor:
    global _executor
    with _executor_lock:
        if _executor is None:
            _executor = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="akayza-worker")
    return _executor


def _run_and_track(job: Callable[[], None]) -> None:
    try:
        job()
    except Exception:  # noqa: BLE001 - a failing job must never kill the worker
        logger.exception("Background job raised an unhandled exception")
    finally:
        global _pending_count
        with _pending_lock:
            _pending_count -= 1


def enqueue(job: Callable[[], None]) -> None:
    """Schedules `job` (a zero-argument callable) to run on the
    background thread pool, and returns immediately. Starts the pool
    lazily on first use. """
    global _pending_count
    executor = _ensure_executor_started()
    with _pending_lock:
        _pending_count += 1
    executor.submit(_run_and_track, job)


def queue_depth() -> int:
    """Approximate number of jobs currently queued or actively
    running, for monitoring."""
    with _pending_lock:
        return _pending_count


def wait_until_idle(timeout: Optional[float] = None) -> None:
    """Blocks until every currently-enqueued job has finished. Exists
    for tests -- production code should never need to wait on the
    queue. Polling-based (ThreadPoolExecutor has no native "wait for
    everything submitted so far" primitive short of shutting the whole
    pool down, which would break future enqueue() calls)."""
    start = time.monotonic()
    while queue_depth() > 0:
        if timeout is not None and (time.monotonic() - start) > timeout:
            raise TimeoutError("Timed out waiting for background jobs to finish")
        time.sleep(0.01)
