"""
A supplier's catalogue: applying their feed (create / update by product code).

full=True means "this file is my whole catalogue": products missing from
it are switched off (active=false), never deleted, because old orders
point at them. full=False only touches the rows sent (a stock or price
update from the supplier's system).

What traders see (public_product_view): never the product code, the
barcodes or the stock number -- only in stock / low / out.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Optional

from ..constants import LOW_STOCK_AT
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


PAGE_SIZE = 60
MAX_PAGE = 50  # 3,000 products deep is more than any catalogue we load


def list_products(supplier_id: uuid.UUID, *, category: Optional[str], q: str, page: int) -> dict:
    rows, total = repo.page_for_supplier(supplier_id, category=category, q=q, offset=(page - 1) * PAGE_SIZE, limit=PAGE_SIZE)
    return {
        "products": [public_product_view(p) for p in rows],
        "page": page,
        "has_more": page * PAGE_SIZE < total,
        "total": total,
    }


def get_active(product_id: uuid.UUID) -> Optional[Product]:
    return repo.active_by_id(product_id)


def stock_level(qty: int) -> str:
    if qty <= 0:
        return "out"
    return "low" if qty <= LOW_STOCK_AT else "in_stock"


def public_product_view(p: Product) -> dict:
    return {
        "id": str(p.id),
        "supplier_id": str(p.supplier_id),
        "name": p.name,
        "brand": p.brand or "",
        "category": p.category,
        "unit": p.unit,
        "pack_size": p.pack_size,
        "units_per_pack": p.units_per_pack,
        "price_cents": p.price_cents,
        "compare_at_price_cents": p.compare_at_price_cents,
        "vat_included": p.vat_included,
        "vat_rate": p.vat_rate,
        "stock": stock_level(p.stock_qty),
        "min_qty": p.min_qty,
        "max_qty": p.max_qty,
        "description": p.description or "",
        "images": [],  # 1-7 photos come with the images step
    }
