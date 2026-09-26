"""
Help posts: an offer posted nearby from a job, with the pay.

  create(user, job_id, data)       7 days; the job's suburb, never its address
  wanted_for(me) / mine(me)        for the Builders tab
  get(user, id)                    yours: who's interested; someone else's: the offer
  interested(user, id)             your builds are shared, not your number
  pick(user, id, builder_id)       they become a partner on the job, on this pay
  close(user, id)

Builders see a post only for a trade they do, within their travel
distance. The post's pin is rounded to about 1 km and never returned.
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E

from ..constants import INTERESTED_PER_DAY, MAX_OPEN_POSTS, MAX_PARTNERS_PER_JOB, POST_DAYS
from ..models import HelpPost, HelpResponse
from ..repositories import network_repository as repo
from . import network_alerts, network_audit, people, ranking
from .common import check_deal, conflict, day_ago, hidden, invalid, not_found, now, offer_view, too_many
from .partners_service import _new_partner


def _me(user) -> people.Me:
    me = people.load_me(user)
    if me is None:
        raise not_found("business profile")
    return me


def _rounded(value: Optional[float]) -> Optional[Decimal]:
    return None if value is None else Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _pin(post: HelpPost) -> tuple:
    return (float(post.latitude) if post.latitude is not None else None, float(post.longitude) if post.longitude is not None else None)


def _status(post: HelpPost) -> str:
    return "closed" if post.status == "open" and post.expires_at <= now() else post.status


def _view(me: people.Me, post: HelpPost, owner_card: Optional[dict], responses: list[dict], job_title: Optional[str]) -> dict:
    mine = post.owner_id == me.id
    lat, lng = _pin(post)
    km = None if mine else ranking.distance_km(me.person.lat, me.person.lng, lat, lng)
    return {
        "id": str(post.id),
        "job_id": str(post.job_id) if mine else None,
        "job_title": job_title if mine else None,
        "owner": None if mine else owner_card,
        "mine": mine,
        "trade": post.trade,
        "what": post.what,
        "starts_on": post.starts_on.isoformat(),
        "suburb": post.suburb,
        "distance_km": 0 if mine else (round(km, 1) if km is not None else None),
        "offer": offer_view(post),
        "created_at": post.created_at.isoformat(),
        "expires_at": post.expires_at.isoformat(),
        "status": _status(post),
        "my_response": None if mine else ("interested" if repo.response(post.id, me.id) else None),
        "responses": responses,
    }


def _responses(me: people.Me, post: HelpPost) -> list[dict]:
    rows = [r for r in repo.responses(post.id) if r.builder_id not in me.blocked]
    cards = {c["id"]: c for c in people.cards(me, [r.builder_id for r in rows], now())}
    out = [
        {"builder": cards[str(r.builder_id)], "at": r.created_at.isoformat(), "status": "picked" if post.picked_builder_id == r.builder_id else "interested"}
        for r in rows
        if str(r.builder_id) in cards
    ]
    # Picked first, then the most proof, then the nearest.
    return sorted(out, key=lambda x: (x["status"] != "picked", -x["builder"]["confirmed_stages"], x["builder"]["distance_km"] or 0))


def _render(me: people.Me, post: HelpPost) -> dict:
    if post.owner_id == me.id:
        job = repo.job(post.job_id)
        return _view(me, post, None, _responses(me, post), job.title if job else None)
    owner = people.cards(me, [post.owner_id], now())
    return _view(me, post, owner[0] if owner else None, [], None)


def wanted_for(me: people.Me) -> list[dict]:
    t = now()
    posts = [p for p in repo.open_posts(t) if p.owner_id != me.id and p.owner_id not in me.blocked]
    owners = people.load({p.owner_id for p in posts})
    ranked = ranking.rank_posts(me.viewer(), [(p.id, p.trade, *_pin(p), owners[p.owner_id].candidate()) for p in posts if p.owner_id in owners], t)
    by_id = {p.id: p for p in posts}
    return [_render(me, by_id[pid]) for pid, _ in ranked[:10]]


def mine(me: people.Me) -> list[dict]:
    return [_render(me, p) for p in repo.my_posts(me.id, now())]


def create(user, job_id: uuid.UUID, data: dict) -> dict:
    me = _me(user)
    if not me.person.visible:
        raise hidden()
    job = repo.my_job(user.id, job_id)
    if job is None:
        raise not_found("job")
    stages = check_deal(job, data)
    t = now()
    if repo.open_post_count(me.id, t) >= MAX_OPEN_POSTS:
        raise conflict("TOO_MANY_POSTS", f"You have {MAX_OPEN_POSTS} open posts. Close one first.")
    names = [s.name for s in stages]
    offer = data["offer"]
    post = HelpPost(
        job_id=job.id,
        owner_id=me.id,
        trade=data["trade"],
        stage_ids=[s.id for s in stages],
        what=(", ".join(names[:-1]) + " and " + names[-1]) if len(names) > 1 else names[0],
        starts_on=data["starts_on"],
        suburb=data["suburb"],
        latitude=_rounded(me.person.lat),
        longitude=_rounded(me.person.lng),
        pay_kind=offer["kind"],
        pay_cents=offer["amount_cents"],
        days=offer["days"],
        paid_when=offer["paid_when"],
        status="open",
        expires_at=t + timedelta(days=POST_DAYS),
    )
    repo.add(post)
    db.session.commit()
    network_audit.record(E.HELP_POST_CREATED, user_id=me.id, post_id=post.id, job_id=job.id, trade=post.trade)
    return _render(me, post)


def _post_for(me: people.Me, post_id: uuid.UUID, *, lock: bool = False) -> HelpPost:
    post = repo.post(post_id, lock=lock)
    if post is None or post.owner_id in me.blocked:
        raise not_found("post")
    return post


def get(user, post_id: uuid.UUID) -> dict:
    me = _me(user)
    post = _post_for(me, post_id)
    if post.owner_id != me.id and _status(post) != "open" and repo.response(post.id, me.id) is None:
        raise not_found("post")
    return _render(me, post)


def interested(user, post_id: uuid.UUID) -> dict:
    me = _me(user)
    if not me.person.visible:
        raise hidden()
    post = _post_for(me, post_id, lock=True)
    if post.owner_id == me.id:
        raise invalid("post", "That's your own post.")
    if _status(post) != "open":
        raise conflict("POST_CLOSED", "This post is closed.")
    if post.trade not in me.person.trades:
        raise invalid("post", "This post is for another trade.")
    if repo.response(post.id, me.id) is None:
        if repo.interested_since(me.id, day_ago()) >= INTERESTED_PER_DAY:
            raise too_many(f"You've answered {INTERESTED_PER_DAY} posts today. Try again tomorrow.")
        repo.add(HelpResponse(post_id=post.id, builder_id=me.id))
        db.session.commit()
        network_audit.record(E.HELP_POST_INTERESTED, user_id=me.id, post_id=post.id)
        network_alerts.help_interested(post, me.id)
    return _render(me, post)


def pick(user, post_id: uuid.UUID, builder_id: uuid.UUID) -> dict:
    me = _me(user)
    post = _post_for(me, post_id, lock=True)
    if post.owner_id != me.id:
        raise not_found("post")
    if _status(post) != "open":
        raise conflict("POST_CLOSED", "This post is already filled or closed.")
    if builder_id in me.blocked or repo.response(post.id, builder_id) is None:
        raise not_found()
    job = repo.my_job(me.id, post.job_id)
    if job is None:
        raise not_found("job")
    live = [p for p in repo.partners_on_job(job.id) if p.status != "declined"]
    if any(p.builder_id == builder_id for p in live):
        raise conflict("ALREADY_ON_JOB", "They're already on this job.")
    if len(live) >= MAX_PARTNERS_PER_JOB:
        raise conflict("TOO_MANY_PARTNERS", f"A job can have {MAX_PARTNERS_PER_JOB} partners.")
    # They said yes to the posted offer: a partner on the job straight away.
    data = {"stage_ids": list(post.stage_ids), "trade": post.trade, "starts_on": post.starts_on, "offer": offer_view(post)}
    row = _new_partner(job, me.id, builder_id, data, status="accepted")
    post.status = "filled"
    post.picked_builder_id = builder_id
    db.session.commit()
    network_audit.record(E.HELP_POST_PICKED, user_id=me.id, post_id=post.id)
    network_alerts.help_picked(post, row, job)
    return _render(people.load_me(user), post)


def close(user, post_id: uuid.UUID) -> dict:
    me = _me(user)
    post = _post_for(me, post_id, lock=True)
    if post.owner_id != me.id:
        raise not_found("post")
    if post.status == "open":
        post.status = "closed"
        db.session.commit()
        network_audit.record(E.HELP_POST_CLOSED, user_id=me.id, post_id=post.id)
    return _render(me, post)
