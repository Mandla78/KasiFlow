"""
Partners on jobs (DECISION_jobs_partners.txt).

The owner's side:
  candidates(user, job_id, trade)     your partners, saved and nearby builders of that trade
  invite(user, job_id, data)          the offer (pay first) to one builder
  on_job(user, job_id)                who's on the job, with the pay and payments
  record_payment(user, partner_id, cents)   "I paid Thabo R4,500"

The partner's side:
  invites(user) / invite_view(user, id)
  answer(user, id, accept)
  confirm_payment(user, id, payment_id, cents)   "I got R4,500"

The partner sees their stages (names only), the job's title and suburb,
the owner, and their pay. Never the client or the stages' money.
"""
from __future__ import annotations

import uuid

from src.core.base_model import utcnow
from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E

from ..constants import INVITES_PER_DAY, MAX_PARTNERS_PER_JOB, TRADES
from ..models import JobPartner, PartnerPayment
from ..repositories import network_repository as repo
from . import network_audit, people, ranking
from .common import check_deal, conflict, day_ago, hidden, invalid, not_found, now, offer_view, payment_view, too_many


def _me(user) -> people.Me:
    me = people.load_me(user)
    if me is None:
        raise not_found("business profile")
    return me


def _my_job(user, job_id: uuid.UUID):
    job = repo.my_job(user.id, job_id)
    if job is None:
        raise not_found("job")
    return job


def _stage_names(job, stage_ids) -> list[str]:
    ids = set(stage_ids)
    return [s.name for s in sorted(job.stages, key=lambda s: s.position) if s.id in ids]


def _partner_view(me: people.Me, row: JobPartner, job, card: dict) -> dict:
    return {
        "id": str(row.id),
        "job_id": str(row.job_id),
        "builder": card,
        "stage_names": _stage_names(job, row.stage_ids),
        "trade": row.trade,
        "starts_on": row.starts_on.isoformat(),
        "offer": offer_view(row),
        "status": row.status,
        "invited_at": row.created_at.isoformat(),
        "payments": [payment_view(p) for p in row.payments],
    }


def _invite_view(me: people.Me, row: JobPartner, job, owner_card: dict, owner_suburb: str) -> dict:
    return {
        "id": str(row.id),
        "owner": owner_card,
        "job_title": job.title,
        "suburb": people.suburb_of(job.place, owner_suburb),
        "stage_names": _stage_names(job, row.stage_ids),
        "trade": row.trade,
        "starts_on": row.starts_on.isoformat(),
        "offer": offer_view(row),
        "status": row.status,
        "invited_at": row.created_at.isoformat(),
        "payments": [payment_view(p) for p in row.payments],
    }


# ------------------------------------------------------------------ owner


def candidates(user, job_id: uuid.UUID, trade: str) -> dict:
    job = _my_job(user, job_id)
    if trade not in TRADES:
        raise invalid("trade", "Pick the trade you need.")
    me = _me(user)
    t = now()
    on_job = {p.builder_id for p in repo.partners_on_job(job.id) if p.status != "declined"}
    visible = set(repo.visible_ids())
    pool_ids = [i for i in visible | me.partners if i != me.id and i not in me.blocked and i not in on_job]
    pool = {i: p for i, p in people.load(pool_ids).items() if trade in p.trades}
    partners = [i for i in pool if i in me.partners]
    saved = [i for i in pool if i in me.saved and i not in me.partners and i in visible]
    rest = [p.candidate() for i, p in pool.items() if i not in me.partners and i not in me.saved and i in visible]
    names = {**people.names_for(me.partners), **{i: p.name for i, p in pool.items()}}
    site = (me.person.lat, me.person.lng)
    ranked = ranking.rank_for_job(me.viewer(), site, trade, rest, lambda i: names.get(i, ""), t) if None not in site else []
    return {
        "partners": people.cards(me, sorted(partners, key=str), t),
        "saved": people.cards(me, sorted(saved, key=str), t),
        "nearby": people.cards(me, [s.id for s in ranked], t, {s.id: s for s in ranked}),
    }


def invite(user, job_id: uuid.UUID, data: dict) -> dict:
    me = _me(user)
    if not me.person.visible:
        raise hidden()
    job = _my_job(user, job_id)
    check_deal(job, data)
    builder_id = data["builder_id"]
    visible = set(repo.visible_ids())
    if builder_id == me.id or builder_id in me.blocked or (builder_id not in visible and builder_id not in me.partners):
        raise not_found()
    found = people.load([builder_id])
    builder = found.get(builder_id)
    if builder is None:
        raise not_found()
    if data["trade"] not in builder.trades:
        raise invalid("trade", f"{people.first_name(builder.name)} doesn't do that trade.")
    live = [p for p in repo.partners_on_job(job.id) if p.status != "declined"]
    if any(p.builder_id == builder_id for p in live):
        raise conflict("ALREADY_ON_JOB", f"{people.first_name(builder.name)} is already on this job.")
    if len(live) >= MAX_PARTNERS_PER_JOB:
        raise conflict("TOO_MANY_PARTNERS", f"A job can have {MAX_PARTNERS_PER_JOB} partners.")
    if repo.invites_sent_since(me.id, day_ago()) >= INVITES_PER_DAY:
        network_audit.record(E.PARTNER_LIMITED, user_id=me.id, ok=False, job_id=job.id)
        raise too_many(f"You've sent {INVITES_PER_DAY} invites today. Try again tomorrow.")
    row = _new_partner(job, me.id, builder_id, data, status="invited")
    db.session.commit()
    network_audit.record(E.PARTNER_INVITED, user_id=me.id, job_id=job.id, partner_id=row.id, trade=row.trade)
    return _partner_view(me, row, job, people.cards(me, [builder_id], now())[0])


def _new_partner(job, owner_id: uuid.UUID, builder_id: uuid.UUID, data: dict, *, status: str) -> JobPartner:
    offer = data["offer"]
    row = JobPartner(
        job_id=job.id,
        owner_id=owner_id,
        builder_id=builder_id,
        stage_ids=[s.id for s in sorted(job.stages, key=lambda s: s.position) if s.id in set(data["stage_ids"])],
        trade=data["trade"],
        starts_on=data["starts_on"],
        pay_kind=offer["kind"],
        pay_cents=offer["amount_cents"],
        days=offer["days"],
        paid_when=offer["paid_when"],
        status=status,
        answered_at=utcnow() if status == "accepted" else None,
    )
    repo.add(row)
    return row


def on_job(user, job_id: uuid.UUID) -> list[dict]:
    job = _my_job(user, job_id)
    me = _me(user)
    rows = [p for p in repo.partners_on_job(job.id) if p.builder_id not in me.blocked]
    cards = {c["id"]: c for c in people.cards(me, [p.builder_id for p in rows], now())}
    return [_partner_view(me, p, job, cards[str(p.builder_id)]) for p in rows if str(p.builder_id) in cards]


def record_payment(user, partner_id: uuid.UUID, cents: int) -> dict:
    me = _me(user)
    row = repo.partner_as_owner(me.id, partner_id, lock=True)
    if row is None or row.builder_id in me.blocked:
        raise not_found("partner")
    if row.status != "accepted":
        raise conflict("NOT_ACCEPTED", "They have to accept the invite first.")
    row.payments.append(PartnerPayment(owner_cents=cents, status="waiting"))
    db.session.commit()
    network_audit.record(E.PARTNER_PAYMENT_RECORDED, user_id=me.id, partner_id=row.id)
    job = repo.job(row.job_id)
    return _partner_view(me, row, job, people.cards(me, [row.builder_id], now())[0])


# ------------------------------------------------------------------ partner


def _invite_or_404(me: people.Me, invite_id: uuid.UUID, *, lock: bool = False) -> JobPartner:
    row = repo.partner_as_builder(me.id, invite_id, lock=lock)
    if row is None or row.owner_id in me.blocked or row.status == "declined" and not lock:
        raise not_found("invite")
    return row


def _render_invites(me: people.Me, rows: list[JobPartner]) -> list[dict]:
    owners = {c["id"]: c for c in people.cards(me, [r.owner_id for r in rows], now())}
    suburbs = {i: p.suburb for i, p in people.load([r.owner_id for r in rows]).items()}
    out = []
    for r in rows:
        job = repo.job(r.job_id)
        if job is None or str(r.owner_id) not in owners:
            continue
        out.append(_invite_view(me, r, job, owners[str(r.owner_id)], suburbs.get(r.owner_id, "")))
    return out


def invites(user) -> list[dict]:
    me = _me(user)
    return _render_invites(me, [r for r in repo.invites_to(me.id) if r.owner_id not in me.blocked])


def invite_view(user, invite_id: uuid.UUID) -> dict:
    me = _me(user)
    return _render_invites(me, [_invite_or_404(me, invite_id)])[0]


def answer(user, invite_id: uuid.UUID, accept: bool) -> dict:
    me = _me(user)
    row = _invite_or_404(me, invite_id, lock=True)
    if row.status != "invited":
        raise conflict("ALREADY_ANSWERED", "You already answered this invite.")
    row.status = "accepted" if accept else "declined"
    row.answered_at = utcnow()
    db.session.commit()
    network_audit.record(E.PARTNER_ANSWERED, user_id=me.id, partner_id=row.id, accepted=accept)
    me = _me(user)  # partners changed: the owner's number is now shared
    return _render_invites(me, [row])[0]


def confirm_payment(user, invite_id: uuid.UUID, payment_id: uuid.UUID, cents: int) -> dict:
    me = _me(user)
    row = _invite_or_404(me, invite_id, lock=True)
    pay = repo.payment(row, payment_id, lock=True)
    if pay is None:
        raise not_found("payment")
    if pay.status != "waiting":
        raise conflict("ALREADY_ANSWERED", "You already answered this payment.")
    pay.partner_cents = cents
    pay.status = "confirmed" if cents == pay.owner_cents else "amounts_dont_match"
    pay.answered_at = utcnow()
    db.session.commit()
    network_audit.record(E.PARTNER_PAYMENT_ANSWERED, user_id=me.id, partner_id=row.id, outcome=pay.status)
    return _render_invites(me, [row])[0]
