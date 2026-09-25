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
through business_profile's service. Next (docs/teammate/14): each tool's
demand_signals(user) and the trader's past orders add reasons and weight.
Distance is haversine in Python: a few hundred suppliers need no PostGIS.
"""
from __future__ import annotations

import math
import uuid
from typing import Optional

from src.core.exceptions import ConflictError, NotFoundError
from src.domains.informal_trader.business_profile.services import business_profile_service

from ...connections.services import connection_service
from ...supplier_profile.models import Supplier
from ...supplier_profile.services import supplier_service

#: A trader who can collect will drive about this far.
COLLECT_RADIUS_KM = 15

#: Upper end of the trader's usual spend per order, in cents (None = no cap).
SPEND_MAX = {"under_1k": 100_000, "1k_5k": 500_000, "5k_20k": 2_000_000, "over_20k": None}

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


def _match(profile, s: Supplier, connected: bool) -> dict:
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

    fit = len(shared) / max(len(mine), 1)
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
        "reasons": [where, what, pay],
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
    matches = [_match(profile, s, s.id in connected) for s in supplier_service.list_active()]
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
    m = _match(profile, s, connected)
    return {**view, "connected": connected, "reasons": m["reasons"], "caution": m["caution"], "distance_km": m["distance_km"]}
