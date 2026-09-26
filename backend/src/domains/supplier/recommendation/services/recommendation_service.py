"""
THE SUPPLIER RECOMMENDATION ENGINE (v1: explainable, no black box).

It RANKS, it never hides: every active supplier is returned, best fit
first, each with plain reasons the trader can read (including honest
ones like "outside their delivery area"). The app groups them (yours /
near you / recommended / more).

    score = what you buy (40) + reach (35 delivers to you, 25 you can
            collect, 0 far) + closeness (10) + how you pay (10)
            + minimum order within your usual spend (5)

Inputs: the trader's own business profile (pin, categories, how they buy)
through business_profile's service, and what their switched-on tools say
the business needs NOW, through each tool's service (TEAMMATE 20): open
job stages (jobs_service.demand_signals) and what the counter sold this
week (order_book_service.demand_signals). Demand can only LIFT "what you
buy", and every lift comes with its reason ("Your open jobs need
plumbing"):

    demand = the signal's shares of the supplier's categories, added up (0..1)
    fit    = max(sign-up fit, (1 - DEMAND_WEIGHT) * sign-up fit + DEMAND_WEIGHT * demand)

A tool that's off, has nothing real to go on, or fails leaves today's
ranking exactly. The signals are the trader's own aggregates, used for
their own list only: never shown to a supplier, and never an amount, a
client, a job or an item in a reason or a log.
Distance is haversine in Python: a few hundred suppliers need no PostGIS.
"""
from __future__ import annotations

import math
import uuid
from typing import Optional

from flask import current_app

from src.core.exceptions import ConflictError, NotFoundError
from src.domains.informal_trader.business_profile.services import business_profile_service
from src.domains.informal_trader.jobs.services import jobs_service
from src.domains.informal_trader.order_book.services import order_book_service
from src.extensions import db

from ...connections.services import connection_service
from ...supplier_profile.models import Supplier
from ...supplier_profile.services import supplier_service

#: A trader who can collect will drive about this far.
COLLECT_RADIUS_KM = 15

#: Upper end of the trader's usual spend per order, in cents (None = no cap).
SPEND_MAX = {"under_1k": 100_000, "1k_5k": 500_000, "5k_20k": 2_000_000, "over_20k": None}

#: How much of "what you buy" the tools' demand may decide: half. The
#: sign-up categories say what the business buys in general, the tools what
#: it needs now; neither should drown the other. Demand only ever lifts
#: (the max with today's fit), so no supplier drops because of it, and the
#: score still tops out at 100.
DEMAND_WEIGHT = 0.5

#: A demand reason names its top two categories only if the line still fits
#: on a small phone: measured in the app's font (13.5 px), 40 characters fit
#: the supplier page's 295 px on a 360-wide screen. Otherwise the top one.
REASON_MAX_CHARS = 40

#: What each tool's demand says, in the trader's words.
_DEMAND_REASON = {"jobs": "Your open jobs need {}", "sales": "Your sales need {}"}

_LABELS = {
    "food_grocery": "Food & Grocery", "beverages": "Beverages", "snacks_confectionery": "Snacks & Confectionery",
    "bakery": "Bakery", "dairy_chilled": "Dairy & Chilled", "fresh_produce": "Fresh Produce",
    "meat_frozen": "Meat & Frozen", "household_cleaning": "Household & Cleaning", "personal_care": "Personal Care",
    "baby_family": "Baby & Family", "packaging_disposable": "Packaging & Disposable",
    "stationery_school": "Stationery & School", "clothing_apparel": "Clothing & Apparel",
    "fragrances_beauty": "Fragrances & Beauty", "phone_accessories": "Phone Accessories",
    "building_materials": "Building Materials", "plumbing": "Plumbing", "electrical": "Electrical",
    "tools_hardware": "Tools & Hardware", "paint_finishes": "Paint & Finishes", "other": "Other",
}


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlng = p2 - p1, math.radians(lng2 - lng1)
    h = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _trader(user):
    """The trader's own profile; the engine needs their pin."""
    profile = business_profile_service.get(user)
    if profile is None or profile.latitude is None:
        raise ConflictError("Add where your business is to see suppliers near you.", code="LOCATION_NEEDED")
    return profile


def _labels(codes: list[str]) -> str:
    shown = ", ".join(_LABELS[c] for c in codes[:3])
    return shown + ("…" if len(codes) > 3 else "")


def _signals(tool: str, read, user) -> Optional[dict]:
    """One tool's demand_signals(user), or None if it fails. The savepoint
    keeps a failed query from spoiling the rest of the request; the log
    names the tool and the kind of error only (no user, no data)."""
    try:
        with db.session.begin_nested():
            return read(user)
    except Exception as e:  # a tool being down must never break the suppliers list
        current_app.logger.warning("supplier engine: %s signals unavailable (%s)", tool, type(e).__name__)
        return None


def _demand(user, profile) -> dict[str, dict[str, float]]:
    """What the trader's switched-on tools say they need now, by source:
    {"jobs": {category: share}, "sales": {...}}. Only real activity counts:
    open job stages (not the trade-only fallback), and sales in the last
    7 days. Nothing to go on, nothing added."""
    tools = getattr(profile, "tools", None) or {}
    demand: dict[str, dict[str, float]] = {}
    if tools.get("jobs"):
        s = _signals("jobs", jobs_service.demand_signals, user)
        if s and s.get("based_on") == "open_stages" and s.get("categories"):
            demand["jobs"] = s["categories"]
    if tools.get("orderBook"):
        s = _signals("order book", order_book_service.demand_signals, user)
        if s and s.get("categories"):
            demand["sales"] = s["categories"]
    return demand


def _demand_reason(source: str, categories: list[str], shares: dict[str, float]) -> str:
    """"Your open jobs need plumbing": the supplier's categories the demand is for, biggest first."""
    top = sorted((c for c in categories if shares.get(c, 0) > 0), key=lambda c: (-shares[c], c))[:2]
    names = [_LABELS.get(c, c.replace("_", " ")).lower() for c in top]
    text = _DEMAND_REASON[source].format(" and ".join(names))
    return text if len(names) == 1 or len(text) <= REASON_MAX_CHARS else _DEMAND_REASON[source].format(names[0])


def _lift(fit: float, categories: list[str], demand: dict[str, dict[str, float]]) -> tuple[float, Optional[str]]:
    """"What you buy", lifted by the strongest demand this supplier meets, and
    the reason for it: None when demand added nothing."""
    best, reason = fit, None
    for source, shares in demand.items():
        wanted = min(sum(shares.get(c, 0.0) for c in categories), 1.0)
        blended = (1 - DEMAND_WEIGHT) * fit + DEMAND_WEIGHT * wanted
        if blended > best + 1e-9:
            best, reason = blended, _demand_reason(source, categories, shares)
    return best, reason


def _match(profile, s: Supplier, connected: bool, demand: Optional[dict] = None) -> dict:
    wants_collect = profile.fulfilment == "collect"
    can_collect = profile.fulfilment != "delivery"
    spend_max = SPEND_MAX.get(profile.spend) if profile.spend else None

    mine = list(profile.categories or [])
    shared = [c for c in s.categories if c in mine]
    km = distance_km(float(profile.latitude), float(profile.longitude), float(s.latitude), float(s.longitude))
    delivers = s.delivers and not wants_collect and km <= s.delivery_radius_km
    collectable = s.collect and can_collect and km <= COLLECT_RADIUS_KM
    pay_ok = s.accepts_in_app if profile.payment == "payfast" else s.accepts_cash if profile.payment == "cash" else True
    min_ok = spend_max is None or s.minimum_order_cents <= spend_max

    fit, needed = _lift(len(shared) / max(len(mine), 1), list(s.categories), demand or {})
    reach = 35 if delivers else 25 if collectable else 0
    closeness = max(0.0, 1 - km / 100) * 10
    score = round(fit * 40 + reach + closeness + (10 if pay_ok else 0) + (5 if min_ok else 0), 2)

    where = (
        f"{km:.1f} km away · delivers to you" if delivers
        else f"{km:.1f} km away · you can collect" if collectable
        else f"{km:.0f} km away · outside their delivery area"
    )
    what = f"Sells {len(shared)} of your {len(mine)} categories: {_labels(shared)}" if shared else f"Sells {_labels(s.categories)}"
    pay = " · ".join(p for p in ("Accepts digital payment" if s.accepts_in_app else "", "cash" if s.accepts_cash else "") if p)

    return {
        **{k: v for k, v in supplier_service.public_view(s).items() if k in _LIST_FIELDS},
        "distance_km": round(km, 2),
        "shared_categories": shared,
        "within_reach": delivers or collectable,
        "delivers_to_you": delivers,
        "connected": connected,
        "reasons": [where, what, *([needed] if needed else []), pay],
        "caution": None if min_ok else f"Minimum order R{s.minimum_order_cents // 100:,}, more than your usual spend",
        "score": score,
    }


_LIST_FIELDS = (
    "id", "name", "initials", "color", "logo_url", "verified", "area",
    "accepts_in_app", "accepts_cash", "minimum_order_cents",
)


def recommend(user) -> list[dict]:
    """Every active supplier, best fit for this trader first."""
    profile = _trader(user)
    connected = connection_service.connected_ids(user)
    demand = _demand(user, profile)
    matches = [_match(profile, s, s.id in connected, demand) for s in supplier_service.list_active()]
    return sorted(matches, key=lambda m: (-m["score"], m["distance_km"]))


def supplier_for_trader(user, supplier_id: uuid.UUID) -> dict:
    """A supplier's page: the public profile, plus why it suits THIS trader."""
    s = supplier_service.get_active(supplier_id)
    if s is None:
        raise NotFoundError("We couldn't find that supplier.")
    view = supplier_service.public_view(s)
    profile: Optional[object] = business_profile_service.get(user)
    connected = connection_service.is_connected(user, s.id)
    if profile is None or getattr(profile, "latitude", None) is None:
        return {**view, "connected": connected, "reasons": [], "caution": None, "distance_km": None}
    m = _match(profile, s, connected, _demand(user, profile))
    return {**view, "connected": connected, "reasons": m["reasons"], "caution": m["caution"], "distance_km": m["distance_km"]}
