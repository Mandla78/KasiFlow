"""
Builders as other builders see them: loaded in bulk (one set of queries
per screen, not per row), then turned into cards and portfolios.

What another builder may see is the plan's minimum: name, trades, suburb,
a rounded distance, proof numbers and the builds they chose. The phone
only between partners. Never a pin, a street, a client or a job's money.
"""
from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable, Optional

from ..constants import COLORS, DEFAULT_TRAVEL_KM, TRADES
from ..repositories import network_repository as repo
from . import ranking


def default_trades(sign_up_trade: Optional[str]) -> list[str]:
    """The business profile's trade as the builder profile's first trade."""
    return [sign_up_trade] if sign_up_trade in TRADES else ["general_builder"]


def first_name(name: str) -> str:
    return (name.split() or [name])[0]


def suburb_of(place: str, fallback: str) -> str:
    """A job's place cut to its suburb: "Tembisa, Ext 5" -> "Tembisa". Never the street."""
    return (place or "").split(",")[0].strip() or fallback


def small_url(url: Optional[str]) -> Optional[str]:
    """Cloudinary delivery URL, width-limited and auto quality: a profile opens on slow data."""
    if url and "/image/upload/" in url and "/image/upload/c_limit" not in url:
        return url.replace("/image/upload/", "/image/upload/c_limit,w_1200,q_auto,f_auto/", 1)
    return url


@dataclass
class Person:
    id: uuid.UUID
    name: str
    suburb: str
    lat: Optional[float]
    lng: Optional[float]
    phone: Optional[str]
    photo_url: Optional[str]
    trades: list[str]
    travel_km: int
    visible: bool
    about: str
    joined_at: datetime
    hidden_job_ids: set
    stages: int = 0
    builds: int = 0
    last_active: Optional[datetime] = None
    partners: set = field(default_factory=set)

    def candidate(self) -> ranking.Candidate:
        return ranking.Candidate(
            self.id, self.name, self.lat, self.lng, tuple(self.trades), self.travel_km, frozenset(self.partners), self.stages, self.last_active, self.joined_at
        )


def load(ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, Person]:
    """Builders with a business profile; the rest aren't builders yet."""
    ids = list(set(ids))
    biz = repo.businesses(ids)
    prof = repo.profiles(ids)
    proof = repo.proof(ids)
    partners = repo.partners_of(ids)
    out = {}
    for i in ids:
        b = biz.get(i)
        if b is None:
            continue
        p = prof.get(i)
        stats = proof.get(i, {})
        out[i] = Person(
            id=i,
            name=(b.owner_name or b.business_name or "Builder").strip(),
            suburb=b.suburb or b.city or "",
            lat=float(b.latitude) if b.latitude is not None else None,
            lng=float(b.longitude) if b.longitude is not None else None,
            phone=b.cellphone,
            photo_url=b.profile_image_url,
            trades=list(p.trades) if p else default_trades(b.trade),
            travel_km=p.travel_km if p else DEFAULT_TRAVEL_KM,
            visible=bool(p and p.visible),
            about=p.about if p else "",
            joined_at=b.created_at,
            hidden_job_ids=set(p.hidden_job_ids or []) if p else set(),
            stages=stats.get("stages", 0),
            builds=stats.get("builds", 0),
            last_active=stats.get("active") or (p.updated_at if p else None),
            partners=set(partners.get(i, set())),
        )
    return out


@dataclass
class Me:
    """The signed-in builder, and who they are to everyone else."""

    person: Person
    blocked: set
    saved: set

    @property
    def id(self) -> uuid.UUID:
        return self.person.id

    @property
    def partners(self) -> set:
        return self.person.partners - self.blocked

    def viewer(self) -> ranking.Viewer:
        p = self.person
        return ranking.Viewer(p.id, p.lat, p.lng, tuple(p.trades), p.travel_km, frozenset(self.partners))

    def relation(self, other_id: uuid.UUID) -> str:
        if other_id in self.partners:
            return "partner"
        return "saved" if other_id in self.saved else "none"


def load_me(user) -> Optional[Me]:
    people = load([user.id])
    if user.id not in people:
        return None
    return Me(people[user.id], repo.blocked_either_way(user.id), repo.saved_ids(user.id))


def initials(name: str) -> str:
    return "".join(w[0].upper() for w in name.split()[:2]) or "B"


def color(user_id: uuid.UUID) -> str:
    return COLORS[int(hashlib.sha256(user_id.bytes).hexdigest(), 16) % len(COLORS)]


def builds(people: dict[uuid.UUID, Person], *, include_hidden: bool = False) -> dict[uuid.UUID, list[dict]]:
    """Each builder's portfolio: done jobs they owned or partnered on, with
    the photos of the stages clients confirmed (theirs only, on a partner
    job), newest first. Builds the builder hid are left out."""
    ids = list(people)
    owned = repo.done_jobs_owned(ids)
    partnered = repo.done_jobs_partnered(ids)
    job_ids = [j.id for j in owned] + [j.id for _, j in partnered]
    on_job = repo.accepted_partners_on(job_ids)
    names = {i: p.name for i, p in people.items()}
    others = {p.builder_id for ps in on_job.values() for p in ps} | {j.user_id for _, j in partnered}
    missing = [i for i in others if i not in names]
    if missing:
        names.update({b.user_id: (b.owner_name or b.business_name or "Builder") for b in repo.businesses(missing).values()})

    out: dict[uuid.UUID, list[dict]] = {i: [] for i in ids}

    def build(owner: Person, job, stage_ids: Optional[set], with_ids: list[uuid.UUID]) -> Optional[dict]:
        if job.id in owner.hidden_job_ids and not include_hidden:
            return None
        stages = [s for s in job.stages if stage_ids is None or s.id in stage_ids]
        photos = [s for s in stages if s.status == "confirmed" and s.photo_url]
        if not photos:
            return None
        confirmed_at = max((s.confirmed_at for s in stages if s.confirmed_at), default=job.updated_at)
        owner_suburb = people[job.user_id].suburb if job.user_id in people else ""
        return {
            "id": str(job.id),
            "title": job.title,
            "suburb": suburb_of(job.place, owner_suburb or owner.suburb),
            "finished_at": confirmed_at.isoformat(),
            "stages_confirmed": sum(1 for s in stages if s.status == "confirmed"),
            "stages_total": len(stages),
            "photos": [
                {"id": str(s.id), "stage_name": s.name, "url": small_url(s.photo_url), "confirmed_at": (s.confirmed_at or confirmed_at).isoformat()}
                for s in photos
            ],
            "built_with": [first_name(names.get(i, "")) for i in with_ids if names.get(i)],
            "hidden": job.id in owner.hidden_job_ids,
        }

    for job in owned:
        b = build(people[job.user_id], job, None, [p.builder_id for p in on_job.get(job.id, [])])
        if b:
            out[job.user_id].append(b)
    for p, job in partnered:
        with_ids = [job.user_id] + [q.builder_id for q in on_job.get(job.id, []) if q.builder_id != p.builder_id]
        b = build(people[p.builder_id], job, set(p.stage_ids), with_ids)
        if b:
            out[p.builder_id].append(b)
    for lst in out.values():
        lst.sort(key=lambda b: b["finished_at"], reverse=True)
    return out


def names_for(ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, str]:
    return {b.user_id: (b.owner_name or b.business_name or "Builder").strip() for b in repo.businesses(ids).values()}


def card(me: Me, p: Person, scored: ranking.Scored, portfolio: list[dict]) -> dict:
    relation = me.relation(p.id)
    km = scored.distance_km
    return {
        "id": str(p.id),
        "name": p.name,
        "initials": initials(p.name),
        "color": color(p.id),
        "photo_url": p.photo_url,
        "trades": p.trades,
        "suburb": p.suburb,
        "distance_km": round(km, 1) if km is not None else None,
        "builds_confirmed": p.builds,
        "confirmed_stages": p.stages,
        "cover_url": portfolio[0]["photos"][0]["url"] if portfolio else None,
        "reason": scored.reason,
        "relation": relation,
        # Only between partners (an accepted invite, or picked on a help post).
        "phone": p.phone if relation == "partner" else None,
    }


def cards(me: Me, ids: list[uuid.UUID], now: datetime, scored: Optional[dict] = None) -> list[dict]:
    """Cards in the order given; unknown or blocked builders are dropped."""
    wanted = [i for i in ids if i not in me.blocked and i != me.id]
    people = load(wanted)
    portfolios = builds(people)
    names = {**names_for(me.partners), **{i: p.name for i, p in people.items()}}
    out = []
    for i in wanted:
        p = people.get(i)
        if p is None:
            continue
        s = (scored or {}).get(i) or ranking.score(me.viewer(), p.candidate(), lambda x: names.get(x, ""), now)
        out.append(card(me, p, s, portfolios.get(i, [])))
    return out
