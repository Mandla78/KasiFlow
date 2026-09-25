"""
Suppliers: created and updated ONLY from a supplier's feed (their system,
or our seed files), never from the trader app.

Being verified is our decision, not the feed's: upsert_from_feed only
sets verified_at when the caller says the business was checked, and a
later feed can't take it away or grant it.
"""
from __future__ import annotations

import uuid
from typing import Any, Optional

from src.core.base_model import utcnow
from src.shared.audit.event_types.supplier import SupplierAuditEvent as E
from src.shared.constants.commerce_policy import cash_limit_for
from src.shared.media.public_urls import delivery_url

from ..models import Supplier
from ..repositories import supplier_repository as repo
from . import supplier_audit


def get(supplier_id: uuid.UUID) -> Optional[Supplier]:
    return repo.by_id(supplier_id)


def get_active(supplier_id: uuid.UUID) -> Optional[Supplier]:
    s = repo.by_id(supplier_id)
    return s if s and s.status == "active" else None


def list_active() -> list[Supplier]:
    return repo.active()


def upsert_from_feed(fields: dict[str, Any], *, verified: bool = False, actor: str = "feed") -> tuple[Supplier, bool]:
    """Creates or updates the supplier from its validated feed. Returns
    (supplier, created). The caller commits."""
    supplier = repo.by_external_id(fields["external_id"])
    created = supplier is None
    if created:
        supplier = repo.add(Supplier(external_id=fields["external_id"]))

    changed = sorted(k for k, v in fields.items() if getattr(supplier, k, None) != v)
    for key, value in fields.items():
        setattr(supplier, key, value)
    if verified and supplier.verified_at is None:
        supplier.verified_at = utcnow()
        changed.append("verified_at")

    if created or changed:
        # Field names only: values like the payout id stay out of the audit trail.
        supplier_audit.record(
            E.PROFILE_CREATED if created else E.PROFILE_UPDATED,
            external_id=supplier.external_id,
            actor=actor,
            fields=None if created else changed,
        )
    return supplier, created


def initials(name: str) -> str:
    """"Mahlangu Wholesale" -> "MW"; "Kasi Bakers" -> "KB"; one word -> two letters."""
    words = [w for w in name.replace("&", " ").split() if w[:1].isalpha()]
    if len(words) >= 2:
        return (words[0][0] + words[1][0]).upper()
    return (words[0][:2] if words else name[:2]).upper()


def area(s: Supplier) -> str:
    """Short place name for lists: "Tembisa"."""
    return s.suburb or s.city


def public_view(s: Supplier) -> dict:
    """What a TRADER may see. Never: the orders email, phone, legal name,
    VAT number or payout id (those are for us and the supplier's system)."""
    return {
        "id": str(s.id),
        "name": s.trading_name,
        "initials": initials(s.trading_name),
        "color": s.brand_color,
        "logo_url": delivery_url(s.logo_url, 200) if s.logo_url else None,
        "verified": s.verified_at is not None,
        "about": s.about or "",
        "area": area(s),
        "address": ", ".join(p for p in (s.street, s.suburb, s.city, s.postal_code) if p),
        "hours": s.hours,
        "delivers": s.delivers,
        "delivery_radius_km": s.delivery_radius_km,
        "delivery_fee_cents": s.delivery_fee_cents,
        "free_delivery_over_cents": s.free_delivery_over_cents,
        "collect": s.collect,
        "accepts_in_app": s.accepts_in_app,
        "accepts_cash": s.accepts_cash,
        # Ours applied on top of theirs (shared/constants/commerce_policy.py).
        "cash_limit_cents": cash_limit_for(s.accepts_cash, s.cash_limit_cents),
        "minimum_order_cents": s.minimum_order_cents,
        "categories": s.categories,
    }
