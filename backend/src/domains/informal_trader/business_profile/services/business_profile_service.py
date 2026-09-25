"""
business_profile -- the trader's sign-up answers, saved and edited.

  get(user)            the profile, or None before the first save
  save(user, patch)    create-or-update, one section at a time; returns
                       the profile as the app should now show it

Every call acts on the signed-in user only (IDOR rule): the user comes
from the token, never from the request.
"""
from __future__ import annotations

from typing import Optional

from src.core.base_model import utcnow
from src.core.exceptions import AppError
from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E
from src.shared.cache.cache import check_rate_limit

from ..constants import ALWAYS_ON_TOOLS, TOOLS
from ..models import BusinessProfile
from ..repositories import business_profile_repository as repo
from . import cipc_verifier, profile_audit

#: CIPC look-ups one account may trigger per day. Real providers charge per
#: look-up, and the register shouldn't be probed through us.
CIPC_CHECKS_PER_DAY = 5

_BUSINESS = ("business_name", "business_type", "trade", "owner_name", "years_trading", "cellphone")
_LOCATION = ("building", "street", "suburb", "city", "province", "postal_code", "latitude", "longitude")
_BUYING = ("categories", "restock", "spend", "payment", "fulfilment")


def get(user) -> Optional[BusinessProfile]:
    return repo.for_user(user.id)


def save(user, patch: dict) -> BusinessProfile:
    profile = repo.for_user(user.id) or repo.create(user.id)
    name_before = profile.owner_name
    number_before = profile.cipc_number

    if "business" in patch:
        for field in _BUSINESS:
            setattr(profile, field, patch["business"].get(field))
    if "registration" in patch:
        reg = patch["registration"]
        profile.sole_trader = reg["sole_trader"]
        profile.cipc_number = reg.get("cipc_number")
    if "location" in patch:
        loc = patch["location"] or {}
        for field in _LOCATION:
            setattr(profile, field, loc.get(field))
    if "buying" in patch:
        for field in _BUYING:
            setattr(profile, field, patch["buying"].get(field))
        # Order kept, duplicates dropped.
        profile.categories = list(dict.fromkeys(profile.categories or []))
    if "tools" in patch:
        chosen = {k: bool(patch["tools"].get(k, False)) for k in TOOLS}
        profile.tools = {**chosen, **{k: True for k in ALWAYS_ON_TOOLS}}

    _recheck_cipc_if_needed(user, profile, number_before, name_before)

    newly_onboarded = profile.onboarded_at is None and is_complete(profile)
    if newly_onboarded:
        profile.onboarded_at = utcnow()

    db.session.commit()
    profile_audit.record(E.BUSINESS_PROFILE_SAVED, user_id=user.id, sections=sorted(patch), onboarded=newly_onboarded or None)
    return profile


def _recheck_cipc_if_needed(user, profile: BusinessProfile, number_before, name_before) -> None:
    """A new number, or a new owner name on a registered business, means the
    old answer no longer holds: check again. Otherwise keep it."""
    if not profile.cipc_number:
        _clear_cipc(profile)
        return
    if profile.cipc_number == number_before and profile.owner_name == name_before and profile.cipc_status:
        return
    if not check_rate_limit(f"cipc_checks:{user.id}", CIPC_CHECKS_PER_DAY, 24 * 3600):
        db.session.rollback()
        profile_audit.record(E.CIPC_CHECK_LIMITED, ok=False, user_id=user.id, reason="daily_limit")
        raise AppError("You've checked too many registration numbers today. Try again tomorrow.", status_code=429, code="CIPC_CHECK_LIMIT")

    result = cipc_verifier.check(profile.cipc_number, profile.owner_name or "")
    profile.cipc_status = result.status
    profile.cipc_registered_name = result.registered_name
    profile.cipc_entity_type = result.entity_type
    profile.cipc_checked_at = utcnow()
    # The result and the number only: no director names in the audit trail.
    profile_audit.record(E.CIPC_CHECKED, user_id=user.id, status=result.status, cipc_number=profile.cipc_number)


def _clear_cipc(profile: BusinessProfile) -> None:
    profile.cipc_status = None
    profile.cipc_registered_name = None
    profile.cipc_entity_type = None
    profile.cipc_checked_at = None


def is_complete(p: BusinessProfile) -> bool:
    """Everything onboarding requires: business name, type (and trade for builders), owner name,
    years, a pin, at least one category, and how stock arrives."""
    return bool(
        p.business_name
        and p.business_type
        and (p.business_type != "builder" or p.trade)
        and p.owner_name
        and p.years_trading
        and p.latitude is not None
        and p.categories
        and p.fulfilment
    )


def public_view(p: Optional[BusinessProfile]) -> Optional[dict]:
    """The owner's own view of their profile. Suppliers never get this."""
    if p is None:
        return None
    return {
        "business": {f: getattr(p, f) for f in _BUSINESS},
        "registration": {
            "sole_trader": p.sole_trader,
            "cipc": None
            if not p.cipc_number
            else {
                "number": p.cipc_number,
                "status": p.cipc_status,
                "registered_name": p.cipc_registered_name,
                "entity_type": p.cipc_entity_type,
                "checked_at": p.cipc_checked_at.isoformat() if p.cipc_checked_at else None,
            },
        },
        "location": None
        if p.latitude is None
        else {**{f: getattr(p, f) or "" for f in _LOCATION[:6]}, "latitude": float(p.latitude), "longitude": float(p.longitude)},
        "buying": {f: getattr(p, f) for f in _BUYING},
        "tools": p.tools or {},
        "profile_image_url": p.profile_image_url,
        "verified": p.cipc_status == "verified",
        "onboarded": p.onboarded_at is not None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }
