"""
jobs -- a builder's jobs, paid in stages.

  list_jobs(user)            active first (newest first), then done
  get_job(user, id)
  create_job(user, data)     with stages that add up to the total
  summary(user)              for Home and the Account tile
  money_for_month(user, s, e) stages confirmed and amounts that don't match, for My record
  seal_records(user)         confirmed stages and sign-off answers, for a record seal
  history(user, q)           done jobs (search)
  bin_jobs(user)             deleted in the last 30 days
  move_to_bin(user, id)      "delete": hidden from the builder; open sign-off links stop working
  restore(user, id)          back from the bin (old links stay off)
  demand_signals(user)       what the open work needs (supplier engine; jobs_signals.py)
  view(job)                  a job as the app sees it

Every call acts on the signed-in user only; "not yours" is the same 404 as
"doesn't exist". Photos: job_photo_service. Sign-offs: sign_off_service.
A binned job (CONTRACT_bin.txt) is not there for any other call.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from src.core.base_model import utcnow
from src.core.exceptions import NotFoundError
from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E

from ..constants import BIN_DAYS
from ..models import Job, JobStage
from ..repositories import jobs_repository as repo
from . import jobs_audit
from .jobs_signals import demand_signals  # noqa: F401 -- the supplier engine reads it here
from .jobs_seal import seal_records  # noqa: F401 -- proof/integrity reads it here


def job_or_404(user, job_id: uuid.UUID) -> Job:
    job = repo.job(user.id, job_id)
    if job is None:
        raise NotFoundError("We couldn't find that job.")
    return job


def stage_or_404(user, job_id: uuid.UUID, stage_id: uuid.UUID, *, lock: bool = False) -> JobStage:
    stage = repo.stage(user.id, job_id, stage_id, lock=lock)
    if stage is None:
        raise NotFoundError("We couldn't find that job.")
    return stage


def list_jobs(user) -> list[dict]:
    rows = repo.jobs(user.id)
    return [view(j) for j in sorted(rows, key=lambda j: j.status != "active")]


def get_job(user, job_id: uuid.UUID) -> dict:
    return view(job_or_404(user, job_id))


def create_job(user, data: dict) -> dict:
    job = Job(
        user_id=user.id,
        title=data["title"],
        client_name=data["client_name"],
        client_phone=data["client_phone"],
        place=data.get("place", ""),
        total_cents=data["total_cents"],
        status="active",
    )
    job.stages = [JobStage(position=i, name=s["name"], amount_cents=s["amount_cents"], status="not_started") for i, s in enumerate(data["stages"])]
    repo.add(job)
    db.session.commit()
    jobs_audit.record(E.JOB_CREATED, user_id=user.id, job_id=job.id, total_cents=job.total_cents, stages=len(job.stages))
    return view(job)


def summary(user) -> dict:
    active = [j for j in repo.jobs(user.id) if j.status == "active"]
    stages = [s for j in active for s in j.stages]
    return {
        "active_jobs": len(active),
        "waiting_on_clients_cents": sum(s.amount_cents for s in stages if s.status == "waiting"),
        "needs_sign_off": sum(1 for s in stages if s.status in ("photo_taken", "amounts_dont_match")),
    }


def history(user, q: str) -> list[dict]:
    return [view(j) for j in repo.history(user.id, q)]


def bin_jobs(user) -> list[dict]:
    return [view(j) for j in repo.binned(user.id, _bin_since())]


def move_to_bin(user, job_id: uuid.UUID) -> None:
    """Hidden from the builder, never removed. A job binned by mistake must
    not be confirmed by a client, so every link the client hasn't answered
    stops working (like an expired one) and those stages stop waiting.
    Confirmed stages, their sign-offs and photos stay as they are."""
    job = job_or_404(user, job_id)
    # Links, then stages: the order a client's answer locks them in, so a
    # delete and an answer at the same moment queue instead of deadlocking.
    # An answer that got there first has used its link and stays in the record.
    now = utcnow()
    links = repo.open_sign_offs_for_job(job.id)
    for link in links:
        link.revoked_at = now
    stages = repo.lock_stages(job.id)
    for s in stages:
        if s.status == "waiting":
            s.status = "photo_taken" if s.photo_url else "not_started"
    job.soft_delete()
    db.session.commit()
    jobs_audit.record(E.JOB_BINNED, user_id=user.id, job_id=job.id, links_turned_off=len(links))


def restore(user, job_id: uuid.UUID) -> dict:
    """Back as it was when binned. Links turned off by the bin stay off:
    the builder sends a new one."""
    job = repo.binned_job(user.id, job_id, _bin_since())
    if job is None:
        db.session.rollback()
        raise NotFoundError("We couldn't find that job.")
    job.is_deleted = False
    job.deleted_at = None
    db.session.commit()
    jobs_audit.record(E.JOB_RESTORED, user_id=user.id, job_id=job.id)
    return view(job)


def _bin_since() -> datetime:
    """Older than this, a deleted job is out of the bin's view (still in the database)."""
    return utcnow() - timedelta(days=BIN_DAYS)


def money_for_month(user, start: datetime, end: datetime) -> dict:
    """My record's jobs block for [start, end): what clients confirmed (the
    cash both sides typed), how many stages, and how many answers still
    don't match. The builder's own record, never proof."""
    stages = repo.confirmed_between(user.id, start, end)
    return {
        "confirmed_cents": sum(s.client_amount_cents or 0 for s in stages),
        "confirmed_stages": len(stages),
        "amounts_dont_match": repo.mismatched_between(user.id, start, end),
    }


def mark_done_if_complete(job: Job) -> bool:
    """A job is done when every stage is confirmed by both."""
    if job.status == "active" and job.stages and all(s.status == "confirmed" for s in job.stages):
        job.status = "done"
        return True
    return False


def view(job: Job) -> dict:
    return {
        "id": str(job.id),
        "title": job.title,
        "client_name": job.client_name,
        "client_phone": job.client_phone,
        "place": job.place,
        "total_cents": job.total_cents,
        "status": job.status,
        "created_at": job.created_at.isoformat(),
        "binned_at": job.deleted_at.isoformat() if job.is_deleted and job.deleted_at else None,
        "stages": [_stage_view(s) for s in job.stages],
    }


def _stage_view(s: JobStage) -> dict:
    answered = s.status in ("confirmed", "amounts_dont_match")
    return {
        "id": str(s.id),
        "position": s.position,
        "name": s.name,
        "amount_cents": s.amount_cents,
        "status": s.status,
        "photo": {"url": s.photo_url, "taken_at": s.photo_taken_at.isoformat(), "sha256": s.photo_sha256} if s.photo_url and s.photo_taken_at else None,
        "builder_amount_cents": s.builder_amount_cents,
        # The builder sees the client's number only once both are in.
        "client_amount_cents": s.client_amount_cents if answered else None,
        "client_note": s.client_note if s.status == "photo_taken" else None,
        "sign_off_sent_at": s.sign_off_sent_at.isoformat() if s.sign_off_sent_at else None,
        "confirmed_at": s.confirmed_at.isoformat() if s.confirmed_at else None,
    }

