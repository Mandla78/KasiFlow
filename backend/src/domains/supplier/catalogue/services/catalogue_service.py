"""
A supplier's catalogue: applying their feed (create / update by product code).

full=True means "this file is my whole catalogue": products missing from
it are switched off (active=false), never deleted, because old orders
point at them. full=False only touches the rows sent (a stock or price
update from the supplier's system).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from ..models import Product
from ..repositories import product_repository as repo


@dataclass
class ApplyResult:
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    deactivated: int = 0


def apply_feed(supplier_id: uuid.UUID, rows: list[dict], *, full: bool) -> ApplyResult:
    """rows: validated product fields (feed_schemas.parse_product_row). The caller commits."""
    result = ApplyResult()
    existing = repo.all_for_supplier(supplier_id)
    for fields in rows:
        product = existing.get(fields["product_code"])
        if product is None:
            repo.add(Product(supplier_id=supplier_id, **fields))
            result.created += 1
        elif any(getattr(product, k) != v for k, v in fields.items()):
            for k, v in fields.items():
                setattr(product, k, v)
            result.updated += 1
        else:
            result.unchanged += 1

    if full:
        sent = {r["product_code"] for r in rows}
        for code, product in existing.items():
            if code not in sent and product.active:
                product.active = False
                result.deactivated += 1
    return result
