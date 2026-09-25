"""
All database access for the builder network. Only this feature's
services call this. Reads the jobs and business-profile TABLES (never
their repositories): a builder's builds are their done jobs, and their
name, suburb, pin and phone are their business profile.

Every query about "my" things takes my user_id; a row that isn't mine is
simply not found (IDOR rule).
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime
from typing import Iterable, Optional

from sqlalchemy import func, or_

from src.domains.informal_trader.business_profile.models import BusinessProfile
from src.domains.informal_trader.jobs.models import Job, JobStage
from src.extensions import db

from ..models import BuilderBlock, BuilderProfile, BuilderReport, BuilderSave, HelpPost, HelpResponse, JobPartner, PartnerPayment

Ids = Iterable[uuid.UUID]


def add(row) -> None:
    db.session.add(row)


# ------------------------------------------------------------------ people


def profile(user_id: uuid.UUID) -> Optional[BuilderProfile]:
    return BuilderProfile.query.filter_by(user_id=user_id, is_deleted=False).first()


def profiles(user_ids: Ids) -> dict[uuid.UUID, BuilderProfile]:
    ids = list(set(user_ids))
    if not ids:
        return {}
    return {p.user_id: p for p in BuilderProfile.query.filter(BuilderProfile.user_id.in_(ids), BuilderProfile.is_deleted.is_(False))}


def visible_ids() -> list[uuid.UUID]:
    """Builders who said "Show me to other builders", with a pin to measure from."""
    rows = (
        db.session.query(BuilderProfile.user_id)
        .join(BusinessProfile, BusinessProfile.user_id == BuilderProfile.user_id)
        .filter(BuilderProfile.visible.is_(True), BuilderProfile.is_deleted.is_(False), BusinessProfile.latitude.isnot(None))
    )
    return [r[0] for r in rows]


def businesses(user_ids: Ids) -> dict[uuid.UUID, BusinessProfile]:
    ids = list(set(user_ids))
    if not ids:
        return {}
    return {b.user_id: b for b in BusinessProfile.query.filter(BusinessProfile.user_id.in_(ids))}


def business(user_id: uuid.UUID) -> Optional[BusinessProfile]:
    return BusinessProfile.query.filter_by(user_id=user_id).first()


# ------------------------------------------------------------------ links


def blocked_either_way(user_id: uuid.UUID) -> set[uuid.UUID]:
    rows = BuilderBlock.query.filter(or_(BuilderBlock.blocker_id == user_id, BuilderBlock.blocked_id == user_id), BuilderBlock.is_deleted.is_(False))
    return {r.blocked_id if r.blocker_id == user_id else r.blocker_id for r in rows}


def block(blocker_id: uuid.UUID, blocked_id: uuid.UUID) -> Optional[BuilderBlock]:
    return BuilderBlock.query.filter_by(blocker_id=blocker_id, blocked_id=blocked_id, is_deleted=False).first()


def saved_ids(user_id: uuid.UUID) -> set[uuid.UUID]:
    return {r.builder_id for r in BuilderSave.query.filter_by(user_id=user_id, is_deleted=False)}


def save_row(user_id: uuid.UUID, builder_id: uuid.UUID) -> Optional[BuilderSave]:
    return BuilderSave.query.filter_by(user_id=user_id, builder_id=builder_id, is_deleted=False).first()


def delete(row) -> None:
    db.session.delete(row)


def report(reporter_id: uuid.UUID, reported_id: uuid.UUID, reason: str, note: str) -> None:
    db.session.add(BuilderReport(reporter_id=reporter_id, reported_id=reported_id, reason=reason, note=note))


def partners_of(user_ids: Ids) -> dict[uuid.UUID, set[uuid.UUID]]:
    """Who each builder has worked a job with (an accepted partner row, either way)."""
    ids = list(set(user_ids))
    out: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
    if not ids:
        return out
    rows = db.session.query(JobPartner.owner_id, JobPartner.builder_id).filter(
        JobPartner.status == "accepted", JobPartner.is_deleted.is_(False), or_(JobPartner.owner_id.in_(ids), JobPartner.builder_id.in_(ids))
    )
    for owner, builder in rows:
        out[owner].add(builder)
        out[builder].add(owner)
    return out


# ------------------------------------------------------------------ proof


def proof(user_ids: Ids) -> dict[uuid.UUID, dict]:
    """Per builder: stages clients confirmed (their jobs + their partner
    stages), builds confirmed (done jobs they owned or partnered on), and
    when they were last active (a job or a partner row changed)."""
    ids = list(set(user_ids))
    out = {i: {"stages": 0, "builds": 0, "active": None} for i in ids}
    if not ids:
        return out
    live = (Job.is_deleted.is_(False),)
    for uid, n in (
        db.session.query(Job.user_id, func.count(JobStage.id)).join(JobStage).filter(Job.user_id.in_(ids), JobStage.status == "confirmed", *live).group_by(Job.user_id)
    ):
        out[uid]["stages"] += n
    for uid, n in db.session.query(Job.user_id, func.count(Job.id)).filter(Job.user_id.in_(ids), Job.status == "done", *live).group_by(Job.user_id):
        out[uid]["builds"] += n
    for uid, at in db.session.query(Job.user_id, func.max(Job.updated_at)).filter(Job.user_id.in_(ids), *live).group_by(Job.user_id):
        out[uid]["active"] = at

    confirmed = {
        s: True
        for (s,) in db.session.query(JobStage.id)
        .join(JobPartner, JobPartner.job_id == JobStage.job_id)
        .filter(JobPartner.builder_id.in_(ids), JobPartner.status == "accepted", JobStage.status == "confirmed")
    }
    for p, job_status in (
        db.session.query(JobPartner, Job.status)
        .join(Job, Job.id == JobPartner.job_id)
        .filter(JobPartner.builder_id.in_(ids), JobPartner.status == "accepted", JobPartner.is_deleted.is_(False), *live)
    ):
        mine = out[p.builder_id]
        mine["stages"] += sum(1 for s in p.stage_ids if s in confirmed)
        if job_status == "done":
            mine["builds"] += 1
        if mine["active"] is None or p.updated_at > mine["active"]:
            mine["active"] = p.updated_at
    return out


def done_jobs_owned(user_ids: Ids) -> list[Job]:
    ids = list(set(user_ids))
    if not ids:
        return []
    return Job.query.filter(Job.user_id.in_(ids), Job.status == "done", Job.is_deleted.is_(False)).all()


def done_jobs_partnered(user_ids: Ids) -> list[tuple[JobPartner, Job]]:
    ids = list(set(user_ids))
    if not ids:
        return []
    return (
        db.session.query(JobPartner, Job)
        .join(Job, Job.id == JobPartner.job_id)
        .filter(JobPartner.builder_id.in_(ids), JobPartner.status == "accepted", JobPartner.is_deleted.is_(False), Job.status == "done", Job.is_deleted.is_(False))
        .all()
    )


def accepted_partners_on(job_ids: Ids) -> dict[uuid.UUID, list[JobPartner]]:
    ids = list(set(job_ids))
    out: dict[uuid.UUID, list[JobPartner]] = defaultdict(list)
    if ids:
        for p in JobPartner.query.filter(JobPartner.job_id.in_(ids), JobPartner.status == "accepted", JobPartner.is_deleted.is_(False)):
            out[p.job_id].append(p)
    return out


# ------------------------------------------------------------------ jobs and partners


def my_job(user_id: uuid.UUID, job_id: uuid.UUID) -> Optional[Job]:
    return Job.query.filter_by(id=job_id, user_id=user_id, is_deleted=False).first()


def job(job_id: uuid.UUID) -> Optional[Job]:
    return Job.query.filter_by(id=job_id, is_deleted=False).first()


def partners_on_job(job_id: uuid.UUID) -> list[JobPartner]:
    return JobPartner.query.filter_by(job_id=job_id, is_deleted=False).order_by(JobPartner.created_at).all()


def live_partner(job_id: uuid.UUID, builder_id: uuid.UUID) -> Optional[JobPartner]:
    return JobPartner.query.filter(JobPartner.job_id == job_id, JobPartner.builder_id == builder_id, JobPartner.status != "declined", JobPartner.is_deleted.is_(False)).first()


def partner_as_owner(owner_id: uuid.UUID, partner_id: uuid.UUID, *, lock: bool = False) -> Optional[JobPartner]:
    q = JobPartner.query.filter_by(id=partner_id, owner_id=owner_id, is_deleted=False)
    return (q.with_for_update() if lock else q).first()


def partner_as_builder(builder_id: uuid.UUID, partner_id: uuid.UUID, *, lock: bool = False) -> Optional[JobPartner]:
    q = JobPartner.query.filter_by(id=partner_id, builder_id=builder_id, is_deleted=False)
    return (q.with_for_update() if lock else q).first()


def invites_to(builder_id: uuid.UUID) -> list[JobPartner]:
    return (
        JobPartner.query.filter(JobPartner.builder_id == builder_id, JobPartner.status != "declined", JobPartner.is_deleted.is_(False))
        .order_by(JobPartner.created_at.desc())
        .all()
    )


def payment(partner: JobPartner, payment_id: uuid.UUID, *, lock: bool = False) -> Optional[PartnerPayment]:
    q = PartnerPayment.query.filter_by(id=payment_id, job_partner_id=partner.id, is_deleted=False)
    return (q.with_for_update() if lock else q).first()


def invites_sent_since(owner_id: uuid.UUID, since: datetime) -> int:
    return JobPartner.query.filter(JobPartner.owner_id == owner_id, JobPartner.created_at >= since).count()


def stages(job_id: uuid.UUID, stage_ids: Ids) -> list[JobStage]:
    ids = list(stage_ids)
    return JobStage.query.filter(JobStage.job_id == job_id, JobStage.id.in_(ids)).order_by(JobStage.position).all() if ids else []


# ------------------------------------------------------------------ help posts


def open_posts(now: datetime) -> list[HelpPost]:
    return HelpPost.query.filter(HelpPost.status == "open", HelpPost.expires_at > now, HelpPost.is_deleted.is_(False)).all()


def my_posts(owner_id: uuid.UUID, now: datetime) -> list[HelpPost]:
    return (
        HelpPost.query.filter(HelpPost.owner_id == owner_id, HelpPost.status != "closed", HelpPost.expires_at > now, HelpPost.is_deleted.is_(False))
        .order_by(HelpPost.created_at.desc())
        .all()
    )


def post(post_id: uuid.UUID, *, lock: bool = False) -> Optional[HelpPost]:
    q = HelpPost.query.filter_by(id=post_id, is_deleted=False)
    return (q.with_for_update() if lock else q).first()


def open_post_count(owner_id: uuid.UUID, now: datetime) -> int:
    return HelpPost.query.filter(HelpPost.owner_id == owner_id, HelpPost.status == "open", HelpPost.expires_at > now, HelpPost.is_deleted.is_(False)).count()


def responses(post_id: uuid.UUID) -> list[HelpResponse]:
    return HelpResponse.query.filter_by(post_id=post_id, is_deleted=False).order_by(HelpResponse.created_at).all()


def response(post_id: uuid.UUID, builder_id: uuid.UUID) -> Optional[HelpResponse]:
    return HelpResponse.query.filter_by(post_id=post_id, builder_id=builder_id, is_deleted=False).first()


def responded_post_ids(builder_id: uuid.UUID) -> set[uuid.UUID]:
    return {r.post_id for r in HelpResponse.query.filter_by(builder_id=builder_id, is_deleted=False)}


def interested_since(builder_id: uuid.UUID, since: datetime) -> int:
    return HelpResponse.query.filter(HelpResponse.builder_id == builder_id, HelpResponse.created_at >= since).count()
