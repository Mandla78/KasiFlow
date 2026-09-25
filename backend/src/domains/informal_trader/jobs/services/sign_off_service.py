"""
Client sign-off for a job stage: the builder sends a link from their own
WhatsApp; the client opens it (no app, no login) and types the cash THEY
paid. Neither sees the other's amount first. Same amount -> confirmed by
both (via link); different -> amounts don't match, both kept; "not yet"
-> back to the builder with the client's note.

  send(user, job_id, stage_id, builder_amount)   -> (job view, link, message)
  page(ticket)                                   -> what the page may show, or None
  answer(ticket, answer, amount_cents, note)     -> the outcome, or InvalidTicket

THE TICKET is the client's only key: 256 random bits (secrets), stored
ONLY as an HMAC keyed with SECRET_KEY (our own copy of the idea in
identity's secrets.py, which is sealed), one use, 7 days, revoked when a
new link is sent for the stage. Used, expired, revoked and unknown all
look the same to the page.
"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import uuid
from datetime import timedelta
from typing import Optional

from flask import current_app

from src.core.base_model import utcnow
from src.core.exceptions import ConflictError
from src.domains.identity.accounts.services import account_service
from src.domains.informal_trader.business_profile.services import business_profile_service
from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E

from ..constants import MAX_JOB_CENTS, SIGN_OFF_DAYS
from ..models import JobSignOff
from ..repositories import jobs_repository as repo
from . import jobs_audit
from .jobs_service import job_or_404, mark_done_if_complete, stage_or_404, view


class InvalidTicket(Exception):
    """Used, expired, revoked or unknown: the page answers the same for all."""


def _digest(ticket: str) -> str:
    key = current_app.config["SECRET_KEY"].encode()
    return hmac.new(key, ticket.encode(), hashlib.sha256).hexdigest()


def _business_name(user_id) -> str:
    """The builder's business name, through identity's and business_profile's own services."""
    user = account_service.get(user_id)
    profile = business_profile_service.get(user) if user else None
    return profile.business_name if profile and profile.business_name else "Your builder"


def message(business: str, client_name: str, stage_name: str, job_title: str, link: str) -> str:
    """The WhatsApp text the builder sends. No amount in it: the client types their own."""
    return f"Hi {client_name}, {business} asks you to sign off the {stage_name} stage of the {job_title.lower()}. Please confirm here, no app needed: {link} Thank you!"


def send(user, job_id: uuid.UUID, stage_id: uuid.UUID, builder_amount_cents: int) -> tuple[dict, str, str]:
    stage = stage_or_404(user, job_id, stage_id, lock=True)
    if stage.status == "confirmed":
        db.session.rollback()
        raise ConflictError("This stage is already confirmed by both of you.", code="STAGE_CONFIRMED")
    now = utcnow()
    for old in repo.open_sign_offs(stage.id):
        old.revoked_at = now  # only the newest link works

    ticket = secrets.token_urlsafe(32)
    sign_off = JobSignOff(
        stage_id=stage.id,
        user_id=user.id,
        ticket_hash=_digest(ticket),
        builder_amount_cents=builder_amount_cents,
        sent_at=now,
        expires_at=now + timedelta(days=SIGN_OFF_DAYS),
        via="link",
    )
    repo.add(sign_off)
    stage.status = "waiting"
    stage.builder_amount_cents = builder_amount_cents
    stage.client_amount_cents = None
    stage.client_note = None
    stage.sign_off_sent_at = now
    db.session.commit()

    job = job_or_404(user, job_id)
    link = f"{current_app.config['APP_BASE_URL']}/sign-off?ticket={ticket}"
    text = message(_business_name(user.id), job.client_name, stage.name, job.title, link)
    jobs_audit.record(E.JOB_SIGN_OFF_SENT, user_id=user.id, job_id=job.id, stage_id=stage.id, sign_off_id=sign_off.id, builder_amount_cents=builder_amount_cents)
    return view(job), link, text


def _usable(ticket: str, *, lock: bool = False) -> JobSignOff:
    if not ticket or len(ticket) > 100:
        raise InvalidTicket()
    sign_off = repo.sign_off_by_hash(_digest(ticket), lock=lock)
    if sign_off is None or sign_off.used_at or sign_off.revoked_at or sign_off.expires_at <= utcnow():
        raise InvalidTicket()
    return sign_off


def page(ticket: str) -> Optional[dict]:
    """What the client's page shows: the business, the stage and its price,
    the job, the photo. Never the builder's cash amount, never the client's
    own name or number."""
    try:
        sign_off = _usable(ticket)
    except InvalidTicket:
        return None
    stage = repo.stage_by_id(sign_off.stage_id)
    job = stage.job
    return {
        "business": _business_name(job.user_id),
        "stage": stage.name,
        "stage_amount_cents": stage.amount_cents,
        "job_title": job.title,
        "photo_url": stage.photo_url,
    }


def parse_rand(text: str) -> Optional[int]:
    """Rand as typed on the page -> whole cents; None if it isn't an amount.
    "12000", "R12 000", "12000.50", "12000,50"; empty means R0."""
    s = re.sub(r"[\sR]", "", text or "", flags=re.IGNORECASE)
    if not s:
        return 0
    if re.fullmatch(r"\d+([.,]\d{1,2})?", s) is None:
        return None
    rands, _, part = s.replace(",", ".").partition(".")
    cents = int(rands) * 100 + int(part.ljust(2, "0") or 0)
    return cents if cents <= MAX_JOB_CENTS else None


def answer(ticket: str, kind: str, amount_cents: int, note: str) -> str:
    """Record the client's answer. Returns the stage's new status."""
    sign_off = _usable(ticket, lock=True)
    stage = repo.stage_by_id(sign_off.stage_id, lock=True)
    job = stage.job
    now = utcnow()

    sign_off.used_at = now
    if kind == "done":
        sign_off.client_amount_cents = amount_cents
        sign_off.outcome = "confirmed" if amount_cents == sign_off.builder_amount_cents else "amounts_dont_match"
        stage.client_amount_cents = amount_cents
        stage.status = sign_off.outcome
        if sign_off.outcome == "confirmed":
            stage.confirmed_at = now
    else:
        sign_off.outcome = "not_yet"
        sign_off.client_note = note or None
        stage.status = "photo_taken" if stage.photo_url else "not_started"
        stage.client_note = note or "Not done yet"
    done = mark_done_if_complete(job)
    db.session.commit()

    jobs_audit.record(
        E.JOB_SIGN_OFF_ANSWERED,
        user_id=job.user_id,
        job_id=job.id,
        stage_id=stage.id,
        sign_off_id=sign_off.id,
        outcome=sign_off.outcome,
        builder_amount_cents=sign_off.builder_amount_cents,
        client_amount_cents=sign_off.client_amount_cents,
    )
    if done:
        jobs_audit.record(E.JOB_DONE, user_id=job.user_id, job_id=job.id, total_cents=job.total_cents)
    return stage.status
