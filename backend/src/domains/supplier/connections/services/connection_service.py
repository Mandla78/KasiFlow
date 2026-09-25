"""
Connect a trader to a supplier, disconnect, and list. Connecting twice or
disconnecting when not connected are no-ops (the phone may retry), not
errors. Only an ACTIVE supplier can be connected to.
"""
from __future__ import annotations

import uuid

from sqlalchemy.exc import IntegrityError

from src.core.exceptions import NotFoundError
from src.extensions import db
from src.shared.audit.event_types.supplier import SupplierAuditEvent as E

from ...supplier_profile.services import supplier_audit, supplier_service
from ..models import SupplierConnection
from ..repositories import connection_repository as repo


def connected_ids(user) -> set[uuid.UUID]:
    return repo.live_supplier_ids(user.id)


def is_connected(user, supplier_id: uuid.UUID) -> bool:
    return repo.live(user.id, supplier_id) is not None


def connect(user, supplier_id: uuid.UUID) -> None:
    if supplier_service.get_active(supplier_id) is None:
        raise NotFoundError("We couldn't find that supplier.")
    if repo.live(user.id, supplier_id):
        return
    repo.add(SupplierConnection(user_id=user.id, supplier_id=supplier_id))
    try:
        db.session.commit()
    except IntegrityError:  # two taps at once: the other one already connected
        db.session.rollback()
        return
    supplier_audit.record(E.TRADER_CONNECTED, actor="trader", user_id=str(user.id), supplier_id=str(supplier_id))


def disconnect(user, supplier_id: uuid.UUID) -> None:
    row = repo.live(user.id, supplier_id)
    if row is None:
        return
    row.soft_delete()
    db.session.commit()
    supplier_audit.record(E.TRADER_DISCONNECTED, actor="trader", user_id=str(user.id), supplier_id=str(supplier_id))
