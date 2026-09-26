"""
All database access for jobs. Only this feature's services call this.
Every trader query takes user_id: a row that isn't theirs is simply not
found (IDOR rule), and neither is a binned job (is_deleted), except by the
history and bin queries at the end. The public sign-off page finds its row
by the ticket's HMAC alone -- the ticket is the credential there.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import func, or_, select

from src.extensions import db

from ..constants import HISTORY_LIMIT
from ..models import Job, JobSignOff, JobStage


def jobs(user_id: uuid.UUID) -> list[Job]:
    return Job.query.filter_by(user_id=user_id, is_deleted=False).order_by(Job.created_at.desc()).all()


def job(user_id: uuid.UUID, job_id: uuid.UUID) -> Optional[Job]:
    return Job.query.filter_by(id=job_id, user_id=user_id, is_deleted=False).first()


def stage(user_id: uuid.UUID, job_id: uuid.UUID, stage_id: uuid.UUID, *, lock: bool = False) -> Optional[JobStage]:
    """The stage, only if its job is this trader's. lock=True holds the row
    until commit, so two sign-offs (or a photo and a sign-off) queue."""
    query = JobStage.query.join(Job).filter(JobStage.id == stage_id, JobStage.job_id == job_id, Job.user_id == user_id, Job.is_deleted.is_(False))
    if lock:
        query = query.with_for_update(of=JobStage)
    return query.first()


def stage_by_id(stage_id: uuid.UUID, *, lock: bool = False) -> Optional[JobStage]:
    """For the public page, after its ticket was checked."""
    query = JobStage.query.filter_by(id=stage_id)
    if lock:
        query = query.with_for_update(of=JobStage)
    return query.first()


def open_sign_offs(stage_id: uuid.UUID) -> list[JobSignOff]:
    return JobSignOff.query.filter_by(stage_id=stage_id, used_at=None, revoked_at=None).all()


def sign_off_by_hash(ticket_hash: str, *, lock: bool = False) -> Optional[JobSignOff]:
    query = JobSignOff.query.filter_by(ticket_hash=ticket_hash)
    if lock:
        query = query.with_for_update()
    return query.first()


def add(row) -> None:
    db.session.add(row)


def confirmed_between(user_id: uuid.UUID, start: datetime, end: datetime) -> list[JobStage]:
    """Stages the client confirmed in [start, end), on jobs not in the bin."""
    return (
        JobStage.query.join(Job)
        .filter(Job.user_id == user_id, Job.is_deleted.is_(False), JobStage.status == "confirmed", JobStage.confirmed_at >= start, JobStage.confirmed_at < end)
        .all()
    )


def mismatched_between(user_id: uuid.UUID, start: datetime, end: datetime) -> int:
    """Stages whose amounts still don't match, answered that way in [start, end)."""
    return (
        db.session.query(func.count(func.distinct(JobStage.id)))
        .join(Job, Job.id == JobStage.job_id)
        .join(JobSignOff, JobSignOff.stage_id == JobStage.id)
        .filter(
            Job.user_id == user_id, Job.is_deleted.is_(False), JobStage.status == "amounts_dont_match",
            JobSignOff.outcome == "amounts_dont_match", JobSignOff.used_at >= start, JobSignOff.used_at < end,
        )
        .scalar()
    )  # fmt: skip


def open_sign_offs_for_job(job_id: uuid.UUID) -> list[JobSignOff]:
    """Links the client hasn't answered yet, held until commit (the client's
    answer locks the same rows, so an answer and a delete queue)."""
    return (
        JobSignOff.query.join(JobStage, JobStage.id == JobSignOff.stage_id)
        .filter(JobStage.job_id == job_id, JobSignOff.used_at.is_(None), JobSignOff.revoked_at.is_(None))
        .with_for_update(of=JobSignOff)
        .all()
    )


def lock_stages(job_id: uuid.UUID) -> list[JobStage]:
    """The job's stages, held until commit and re-read (a client may have
    answered since the job was loaded)."""
    return JobStage.query.filter_by(job_id=job_id).order_by(JobStage.position).with_for_update().populate_existing().all()


# ----------------------------------------------------------- history and bin


def _contains(q: str) -> str:
    """q as a plain "contains" pattern: % and _ are letters, not wildcards."""
    return "%" + q.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def history(user_id: uuid.UUID, q: str) -> list[Job]:
    """Done jobs, not binned, the latest confirmed stage first. q: the
    job's title or the client's name."""
    last_confirmed = select(func.max(JobStage.confirmed_at)).where(JobStage.job_id == Job.id).scalar_subquery()
    query = Job.query.filter(Job.user_id == user_id, Job.is_deleted.is_(False), Job.status == "done")
    if q:
        pattern = _contains(q)
        query = query.filter(or_(func.lower(Job.title).like(pattern, escape="\\"), func.lower(Job.client_name).like(pattern, escape="\\")))
    return query.order_by(func.greatest(Job.created_at, last_confirmed).desc(), Job.id).limit(HISTORY_LIMIT).all()


def binned(user_id: uuid.UUID, since: datetime) -> list[Job]:
    """In the bin: deleted at `since` or later, newest first."""
    return (
        Job.query.filter(Job.user_id == user_id, Job.is_deleted.is_(True), Job.deleted_at >= since)
        .order_by(Job.deleted_at.desc())
        .limit(HISTORY_LIMIT)
        .all()
    )


def binned_job(user_id: uuid.UUID, job_id: uuid.UUID, since: datetime) -> Optional[Job]:
    return Job.query.filter_by(id=job_id, user_id=user_id, is_deleted=True).filter(Job.deleted_at >= since).with_for_update(of=Job).first()
