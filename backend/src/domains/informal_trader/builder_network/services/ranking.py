"""
Which builders to show, and why -- the same rules as the app's
lib/recommend.ts (tested with the same cases). A score out of 100 and
plain reasons; the top reason goes in lists. No machine learning: a few
thousand builders don't need it, and every place must be explainable.

  trade fit            30  trades that work together highest; same trade 15; else 5
  closeness            20  within the travel distance, nearer is better
  partners in common   20  builders you've both worked with ("triadic closure")
  proof                20  stages confirmed by clients, log-scaled (50 = full)
  activity             10  active in the last 30 days
"""
from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Callable, Optional

from ..constants import ACTIVE_DAYS, NEW_BUILDER_DAYS, TRADE_LABELS, WORKS_WITH


@dataclass(frozen=True)
class Viewer:
    id: uuid.UUID
    lat: Optional[float]
    lng: Optional[float]
    trades: tuple[str, ...]
    travel_km: int
    partners: frozenset = field(default_factory=frozenset)


@dataclass(frozen=True)
class Candidate:
    id: uuid.UUID
    name: str
    lat: Optional[float]
    lng: Optional[float]
    trades: tuple[str, ...]
    travel_km: int
    partners: frozenset
    confirmed_stages: int
    last_active: Optional[datetime]
    joined_at: datetime


@dataclass(frozen=True)
class Scored:
    id: uuid.UUID
    score: int
    distance_km: Optional[float]
    in_common: list[str]
    reasons: list[str]
    reason: str


def distance_km(lat1, lng1, lat2, lng2) -> Optional[float]:
    """Straight-line distance (haversine); None when a pin is missing."""
    if None in (lat1, lng1, lat2, lng2):
        return None
    r = math.radians
    d_lat, d_lng = r(lat2 - lat1), r(lng2 - lng1)
    h = math.sin(d_lat / 2) ** 2 + math.cos(r(lat1)) * math.cos(r(lat2)) * math.sin(d_lng / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def km_text(km: Optional[float]) -> str:
    if km is None:
        return "near you"
    tenths = round(km * 10) / 10
    return f"{tenths:.1f} km" if tenths < 10 else f"{tenths:.0f} km"


def trade_fit(mine, theirs) -> int:
    best = 0
    for a in mine:
        for b in theirs:
            best = max(best, 30 if b in WORKS_WITH.get(a, ()) else 15 if a == b else 5)
    return best


def closeness(km: Optional[float], travel_km: int) -> float:
    if km is None or km > travel_km:
        return 0.0
    return 20 * (1 - km / travel_km)


def proof(confirmed_stages: int) -> float:
    return min(20.0, 20 * math.log1p(max(0, confirmed_stages)) / math.log1p(50))


def in_common_points(count: int) -> int:
    return min(20, count * 8)


def activity(last_active: Optional[datetime], now: datetime) -> int:
    return 10 if last_active and now - last_active <= timedelta(days=ACTIVE_DAYS) else 0


def stages_text(n: int) -> str:
    return "1 stage confirmed by a client" if n == 1 else f"{n} stages confirmed by clients"


def _first(name: str) -> str:
    return (name.split() or [name])[0]


def _in_common_text(names: list[str]) -> str:
    if len(names) == 1:
        return f"Built with {_first(names[0])}, your partner"
    if len(names) == 2:
        return f"Built with {_first(names[0])} and {_first(names[1])}, your partners"
    return f"Built with {_first(names[0])} and {len(names) - 1} other partners of yours"


def _label(trade: Optional[str]) -> str:
    return TRADE_LABELS.get(trade or "", "Builder")


def is_new(c: Candidate, now: datetime) -> bool:
    return now - c.joined_at <= timedelta(days=NEW_BUILDER_DAYS)


def score(me: Viewer, c: Candidate, name_of: Callable[[uuid.UUID], str], now: datetime) -> Scored:
    km = distance_km(me.lat, me.lng, c.lat, c.lng)
    in_common = [name_of(i) for i in c.partners if i in me.partners]
    parts = {
        "trade": trade_fit(me.trades, c.trades),
        "closeness": closeness(km, me.travel_km),
        "in_common": in_common_points(len(in_common)),
        "proof": proof(c.confirmed_stages),
        "activity": activity(c.last_active, now),
    }
    theirs = c.trades[0] if c.trades else None
    mine = me.trades[0] if me.trades else None

    reasons: list[tuple[float, str]] = []
    if in_common:
        reasons.append((parts["in_common"] + 20, _in_common_text(in_common)))
    if c.confirmed_stages > 0:
        reasons.append((parts["proof"], stages_text(c.confirmed_stages)))
    if parts["trade"] == 30 and theirs and mine:
        reasons.append((parts["trade"] - 15, f"{_label(theirs)}s often work with {_label(mine).lower()}s"))
    if km is not None:
        reasons.append((parts["closeness"], f"{km_text(km)} from you" if km <= me.travel_km else f"{km_text(km)} away, further than you travel"))
    if parts["activity"]:
        reasons.append((parts["activity"] - 5, "Active this month"))
    if is_new(c, now):
        reasons.append((1, "New on Akayza"))
    reasons.sort(key=lambda r: -r[0])

    if in_common:
        reason = _in_common_text(in_common)
    elif c.confirmed_stages > 0:
        reason = stages_text(c.confirmed_stages)
    elif is_new(c, now):
        reason = "New on Akayza"
    else:
        reason = f"{_label(theirs)} · {km_text(km)}"

    total = round(sum(parts.values()))
    return Scored(c.id, total, km, in_common, [r[1] for r in reasons], reason)


def suggest(me: Viewer, candidates: list[Candidate], name_of, now: datetime, limit: int) -> list[Scored]:
    """Best first. Fairness: after the top 3, every third place goes to a
    builder who joined in the last 30 days."""
    by_id = {c.id: c for c in candidates}
    ranked = sorted(
        (score(me, c, name_of, now) for c in candidates if c.id != me.id),
        key=lambda s: (-s.score, s.distance_km if s.distance_km is not None else math.inf),
    )
    top, rest_all = ranked[:3], ranked[3:]
    fresh = [s for s in rest_all if is_new(by_id[s.id], now)]
    rest = [s for s in rest_all if not is_new(by_id[s.id], now)]
    mixed = list(top)
    while fresh or rest:
        turn = (len(mixed) - 3) % 3 == 2
        pick = (fresh if turn else rest) or fresh or rest
        mixed.append(pick.pop(0))
    return mixed[:limit]


def rank_for_job(me: Viewer, site: tuple, trade: str, candidates: list[Candidate], name_of, now: datetime) -> list[Scored]:
    """That trade only, and only builders the site is within THEIR travel
    distance of; then nearest, most proof, partners in common, most active."""
    out = []
    for c in candidates:
        if c.id == me.id or trade not in c.trades:
            continue
        km = distance_km(site[0], site[1], c.lat, c.lng)
        if km is None or km > c.travel_km:
            continue
        s = score(Viewer(me.id, site[0], site[1], (trade,), me.travel_km, me.partners), c, name_of, now)
        total = round(closeness(km, c.travel_km) + proof(c.confirmed_stages) + in_common_points(len(s.in_common)) + activity(c.last_active, now))
        out.append(Scored(c.id, total, km, s.in_common, s.reasons, s.reason))
    return sorted(out, key=lambda s: (-s.score, s.distance_km))


def rank_posts(me: Viewer, posts: list[tuple], now: datetime) -> list[tuple[uuid.UUID, float]]:
    """posts: (id, trade, lat, lng, owner Candidate). Your trade only,
    within your travel distance; then nearest, most proof, most active."""
    out = []
    for pid, trade, lat, lng, owner in posts:
        if owner.id == me.id or trade not in me.trades:
            continue
        km = distance_km(me.lat, me.lng, lat, lng)
        if km is None or km > me.travel_km:
            continue
        out.append((pid, km, closeness(km, me.travel_km) + proof(owner.confirmed_stages) + activity(owner.last_active, now)))
    return [(pid, km) for pid, km, _ in sorted(out, key=lambda x: -x[2])]
