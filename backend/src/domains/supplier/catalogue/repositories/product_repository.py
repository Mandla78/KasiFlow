"""All database access for products. Only this feature's services call this."""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import case, func, or_

from src.extensions import db
from src.shared.validation.identifiers import escape_like_pattern

from ..models import Product


def all_for_supplier(supplier_id: uuid.UUID) -> dict[str, Product]:
    """Every product of this supplier (active or not), by product code."""
    rows = Product.query.filter_by(supplier_id=supplier_id, is_deleted=False).all()
    return {p.product_code: p for p in rows}


def add(product: Product) -> Product:
    db.session.add(product)
    return product


def page_for_supplier(supplier_id: uuid.UUID, *, category: Optional[str], q: str, offset: int, limit: int) -> tuple[list[Product], int]:
    """Active products, in stock first, then by name. (total, for paging)"""
    query = Product.query.filter_by(supplier_id=supplier_id, active=True, is_deleted=False)
    if category:
        query = query.filter(Product.category == category)
    if q:
        pattern = f"%{escape_like_pattern(q.lower())}%"
        query = query.filter(
            or_(func.lower(Product.name).like(pattern, escape="\\"), func.lower(func.coalesce(Product.brand, "")).like(pattern, escape="\\"))
        )
    total = query.count()
    rows = query.order_by(case((Product.stock_qty > 0, 0), else_=1), func.lower(Product.name), Product.pack_size).offset(offset).limit(limit).all()
    return rows, total


def active_by_id(product_id: uuid.UUID) -> Optional[Product]:
    return Product.query.filter_by(id=product_id, active=True, is_deleted=False).first()
