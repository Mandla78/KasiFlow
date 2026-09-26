"""
Builders, as other builders see them.

  home(user, trade)          the Builders tab: partners, saved, nearby (ranked),
                             help wanted near you, your posts
  profile(user, id)          a portfolio of client-confirmed builds + proof
  set_saved(user, id, bool)  a private bookmark
  block(user, id)            both ways, at once
  report(user, id, reason, note)

Someone who hasn't said "Show me to other builders" doesn't exist for
others (404, never in a list), except to the partners they already work
with. A block hides both builders from each other everywhere.
"""
from __future__ import annotations

import uuid
from typing import Optional

from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E

from ..constants import NEARBY_LIMIT
from ..models import BuilderBlock, BuilderSave
from ..repositories import network_repository as repo
from . import help_posts_service, network_audit, people, ranking
from .common import now, not_found


def _me(user) -> people.Me:
    me = people.load_me(user)
    if me is None:
        raise not_found("business profile")
    return me


def _reachable(me: people.Me, builder_id: uuid.UUID, visible: set) -> bool:
    """Shown to me: visible (or already my partner), not me, not blocked."""
    return builder_id != me.id and builder_id not in me.blocked and (builder_id in visible or builder_id in me.partners)


def home(user, trade: Optional[str]) -> dict:
    me = _me(user)
    t = now()
    visible = set(repo.visible_ids())
    partner_ids = [i for i in me.partners if _reachable(me, i, visible)]
    saved_ids = [i for i in me.saved if _reachable(me, i, visible) and i not in me.partners and i in visible]
    others = [i for i in visible if _reachable(me, i, visible) and i not in me.partners and i not in me.saved]

    pool = people.load(others)
    if trade:
        pool = {i: p for i, p in pool.items() if trade in p.trades}
    names = {**people.names_for(me.partners), **{i: p.name for i, p in pool.items()}}
    ranked = ranking.suggest(me.viewer(), [p.candidate() for p in pool.values()], lambda i: names.get(i, ""), t, NEARBY_LIMIT)

    return {
        "visible": me.person.visible,
        "travel_km": me.person.travel_km,
        "partners": people.cards(me, sorted(partner_ids, key=str), t),
        "saved": people.cards(me, sorted(saved_ids, key=str), t),
        "nearby": people.cards(me, [s.id for s in ranked], t, {s.id: s for s in ranked}),
        "help_wanted": help_posts_service.wanted_for(me),
        "my_posts": help_posts_service.mine(me),
    }


def profile(user, builder_id: uuid.UUID) -> dict:
    me = _me(user)
    if not _reachable(me, builder_id, set(repo.visible_ids())):
        raise not_found()
    found = people.load([builder_id])
    p = found.get(builder_id)
    if p is None:
        raise not_found()
    t = now()
    names = {**people.names_for(me.partners | p.partners), me.id: me.person.name}
    scored = ranking.score(me.viewer(), p.candidate(), lambda i: names.get(i, ""), t)
    builds = people.builds(found).get(builder_id, [])
    return {
        **people.card(me, p, scored, builds),
        "about": p.about,
        "on_akayza_since": p.joined_at.isoformat(),
        "worked_with": ["you" if i == me.id else people.first_name(names.get(i, "")) for i in sorted(p.partners, key=str) if i not in me.blocked and names.get(i)],
        "partners_in_common": scored.in_common,
        "reasons": scored.reasons,
        "builds": [{k: v for k, v in b.items() if k != "hidden"} for b in builds],
    }


def set_saved(user, builder_id: uuid.UUID, saved: bool) -> None:
    me = _me(user)
    if not _reachable(me, builder_id, set(repo.visible_ids())):
        raise not_found()
    row = repo.save_row(me.id, builder_id)
    if saved and row is None:
        repo.add(BuilderSave(user_id=me.id, builder_id=builder_id))
    elif not saved and row is not None:
        repo.delete(row)
    else:
        return
    db.session.commit()
    network_audit.record(E.BUILDER_SAVED if saved else E.BUILDER_UNSAVED, user_id=me.id, builder_id=builder_id)


def block(user, builder_id: uuid.UUID) -> None:
    me = _me(user)
    if builder_id == me.id or repo.business(builder_id) is None:
        raise not_found()
    if repo.block(me.id, builder_id) is None:
        repo.add(BuilderBlock(blocker_id=me.id, blocked_id=builder_id))
    row = repo.save_row(me.id, builder_id)
    if row is not None:
        repo.delete(row)
    db.session.commit()
    network_audit.record(E.BUILDER_BLOCKED, user_id=me.id, builder_id=builder_id)


def report(user, builder_id: uuid.UUID, reason: str, note: str) -> None:
    me = _me(user)
    if builder_id == me.id or repo.business(builder_id) is None:
        raise not_found()
    repo.report(me.id, builder_id, reason, note)
    db.session.commit()
    network_audit.record(E.BUILDER_REPORTED, user_id=me.id, builder_id=builder_id, reason=reason)
