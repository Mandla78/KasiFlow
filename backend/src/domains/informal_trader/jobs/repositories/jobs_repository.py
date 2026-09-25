"""
All database access for jobs. Only this feature's services call this.
Every trader query takes user_id: a row that isn't theirs is simply not
found (IDOR rule). The public sign-off page finds its row by the ticket's
HMAC alone -- the ticket is the credential there.
"""
from __future__ import annotations

import uuid
from typing import Optional

from src.extensions import db

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
