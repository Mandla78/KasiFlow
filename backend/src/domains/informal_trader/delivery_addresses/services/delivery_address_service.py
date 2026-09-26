"""
Delivery addresses: the places, besides the business address, a trader
has stock delivered to.

  list_mine(user)              the trader's saved places, default first
  add(user, data)              save a new one (max MAX_ADDRESSES)
  update(user, id, data)       change its label, text or pin
  remove(user, id)             soft delete (orders that went there keep their copy)
  make_default(user, id)       the one checkout picks first
  for_order(user, id)          (address text, lat, lng) for placing an order --
                               the orders feature calls THIS, never the repository

Someone else's address is "not found", never "forbidden": whether an id
exists is nobody else's business (IDOR).
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from src.core.exceptions import ConflictError, NotFoundError
from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E

from ..constants import MAX_ADDRESSES
from ..models import DeliveryAddress
from ..repositories import delivery_address_repository as repo
from . import delivery_address_audit as audit

NOT_FOUND = "We couldn't find that address."


def _pin(value: float) -> Decimal:
    return Decimal(f"{value:.6f}")


def view(a: DeliveryAddress) -> dict:
    return {
        "id": str(a.id),
        "label": a.label,
        "address_text": a.address_text,
        "latitude": float(a.latitude),
        "longitude": float(a.longitude),
        "is_default": a.is_default,
    }


def list_mine(user) -> list[dict]:
    return [view(a) for a in repo.live_for_user(user.id)]


def _mine(user, address_id: uuid.UUID, lock: bool = False) -> DeliveryAddress:
    address = repo.mine(user.id, address_id, lock=lock)
    if address is None:
        db.session.rollback()
        raise NotFoundError(NOT_FOUND)
    return address


def add(user, data: dict) -> dict:
    if repo.count_live(user.id, lock=True) >= MAX_ADDRESSES:
        db.session.rollback()
        raise ConflictError(f"You can keep {MAX_ADDRESSES} addresses. Remove one first.", code="TOO_MANY_ADDRESSES")
    if data["is_default"]:
        repo.clear_default(user.id)
    address = repo.add(
        DeliveryAddress(
            user_id=user.id,
            label=data["label"],
            address_text=data["address_text"],
            latitude=_pin(data["latitude"]),
            longitude=_pin(data["longitude"]),
            is_default=data["is_default"],
        )
    )
    db.session.commit()
    audit.record(E.DELIVERY_ADDRESS_ADDED, user_id=user.id, address_id=address.id, is_default=address.is_default)
    return view(address)


def update(user, address_id: uuid.UUID, data: dict) -> dict:
    address = _mine(user, address_id, lock=True)
    for key in ("label", "address_text"):
        if key in data:
            setattr(address, key, data[key])
    if "latitude" in data:
        address.latitude, address.longitude = _pin(data["latitude"]), _pin(data["longitude"])
    db.session.commit()
    audit.record(E.DELIVERY_ADDRESS_CHANGED, user_id=user.id, address_id=address.id, pin_moved="latitude" in data)
    return view(address)


def remove(user, address_id: uuid.UUID) -> None:
    address = _mine(user, address_id, lock=True)
    address.is_default = False
    address.soft_delete()
    db.session.commit()
    audit.record(E.DELIVERY_ADDRESS_REMOVED, user_id=user.id, address_id=address.id)


def make_default(user, address_id: uuid.UUID) -> dict:
    address = _mine(user, address_id, lock=True)
    if not address.is_default:
        repo.clear_default(user.id)
        address.is_default = True
        db.session.commit()
        audit.record(E.DELIVERY_ADDRESS_DEFAULT_SET, user_id=user.id, address_id=address.id)
    return view(address)


def for_order(user, address_id: uuid.UUID) -> tuple[str, float, float]:
    """The saved place an order goes to. Only the trader's own; else 404."""
    address = repo.mine(user.id, address_id)
    if address is None:
        raise NotFoundError(NOT_FOUND)
    return address.address_text, float(address.latitude), float(address.longitude)
