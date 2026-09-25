"""All database access for products. Only this feature's services call this."""
from __future__ import annotations

import uuid

from src.extensions import db

from ..models import Product


def all_for_supplier(supplier_id: uuid.UUID) -> dict[str, Product]:
    """Every product of this supplier (active or not), by product code."""
    rows = Product.query.filter_by(supplier_id=supplier_id, is_deleted=False).all()
    return {p.product_code: p for p in rows}


def add(product: Product) -> Product:
    db.session.add(product)
    return product
