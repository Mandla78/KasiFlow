"""
Your builder profile: trades, one line about you, how far you travel,
"Show me to other builders" (off until you turn it on), and which of your
client-confirmed builds other builders see.

  get(user)          made on first use from the sign-up trade, hidden
  save(user, data)
"""
from __future__ import annotations

import uuid

from src.core.base_model import utcnow
from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E

from ..constants import DEFAULT_TRAVEL_KM
from ..models import BuilderProfile
from ..repositories import network_repository as repo
from . import network_audit, people
from .common import conflict


def ensure(user) -> BuilderProfile:
    p = repo.profile(user.id)
    if p is None:
        business = repo.business(user.id)
        if business is None:
            raise conflict("NO_BUSINESS_PROFILE", "Finish your business profile first.")
        p = BuilderProfile(user_id=user.id, trades=people.default_trades(business.trade), about="", travel_km=DEFAULT_TRAVEL_KM, visible=False, hidden_job_ids=[])
        repo.add(p)
        db.session.commit()
    return p


def get(user) -> dict:
    return _view(user, ensure(user))


def save(user, data: dict) -> dict:
    p = ensure(user)
    mine = people.load([user.id])
    builds = people.builds(mine, include_hidden=True).get(user.id, [])
    shown = {str(i) for i in data["shown_job_ids"]}
    was_visible = p.visible
    p.trades = list(dict.fromkeys(data["trades"]))
    p.about = data["about"]
    p.travel_km = data["travel_km"]
    p.visible = data["visible"]
    # Only builds that exist can be hidden; anything else sent is ignored.
    p.hidden_job_ids = [uuid.UUID(b["id"]) for b in builds if b["id"] not in shown]
    if p.visible != was_visible:
        p.visible_changed_at = utcnow()
    db.session.commit()
    network_audit.record(E.BUILDER_PROFILE_SAVED, user_id=user.id, trades=len(p.trades), travel_km=p.travel_km)
    if p.visible != was_visible:
        network_audit.record(E.BUILDER_VISIBILITY_CHANGED, user_id=user.id, visible=p.visible)
    return _view(user, p)


def _view(user, p: BuilderProfile) -> dict:
    mine = people.load([user.id])
    builds = people.builds(mine, include_hidden=True).get(user.id, [])
    return {
        "trades": list(p.trades),
        "about": p.about,
        "travel_km": p.travel_km,
        "visible": p.visible,
        "builds": [{**{k: v for k, v in b.items() if k != "hidden"}, "shown": not b["hidden"]} for b in builds],
    }
