"""All database access for suppliers. Only this feature's services call this."""
from __future__ import annotations

import uuid
from typing import Optional

from src.extensions import db

from ..models import Supplier


def by_external_id(external_id: str) -> Optional[Supplier]:
    return Supplier.query.filter_by(external_id=external_id, is_deleted=False).first()


def by_id(supplier_id: uuid.UUID) -> Optional[Supplier]:
    return Supplier.query.filter_by(id=supplier_id, is_deleted=False).first()


def active() -> list[Supplier]:
    return Supplier.query.filter_by(status="active", is_deleted=False).order_by(Supplier.trading_name).all()


def add(supplier: Supplier) -> Supplier:
    db.session.add(supplier)
    return supplier
