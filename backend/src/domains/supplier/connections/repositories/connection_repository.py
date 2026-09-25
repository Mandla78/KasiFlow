"""All database access for connections. Only this feature's services call this.
Every query takes the trader's user_id."""
from __future__ import annotations

import uuid
from typing import Optional

from src.extensions import db

from ..models import SupplierConnection


def live(user_id: uuid.UUID, supplier_id: uuid.UUID) -> Optional[SupplierConnection]:
    return SupplierConnection.query.filter_by(user_id=user_id, supplier_id=supplier_id, is_deleted=False).first()


def live_supplier_ids(user_id: uuid.UUID) -> set[uuid.UUID]:
    rows = SupplierConnection.query.with_entities(SupplierConnection.supplier_id).filter_by(user_id=user_id, is_deleted=False).all()
    return {r.supplier_id for r in rows}


def add(connection: SupplierConnection) -> SupplierConnection:
    db.session.add(connection)
    return connection
