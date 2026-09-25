"""
/api/v1 -- a supplier's catalogue, as traders see it.

  GET /suppliers/<id>/products?category=&q=&page=   active products, in
                                                    stock first, 60 a page
  GET /products/<id>                                one product

Never returned: product codes, barcodes, stock numbers (only in stock /
low / out). A paused or unknown supplier is a 404.
"""
from __future__ import annotations

import uuid

from flask import request

from src.api import api_bp
from src.core.decorators import auth_required
from src.core.exceptions import NotFoundError, ValidationError
from src.core.responses import success_response
from src.shared.constants.categories import CATEGORIES
from src.shared.rate_limit.limiter import limiter
from src.shared.validation.text import clean_text

from ...supplier_profile.services import supplier_service
from ..services import catalogue_service

READ_LIMIT = "120 per minute"  # search fires as the trader types


def _bad(field: str, message: str):
    raise ValidationError("Please check the highlighted fields.", errors=[{field: [message]}])


def _query() -> tuple[str | None, str, int]:
    category = request.args.get("category") or None
    if category is not None and category not in CATEGORIES:
        _bad("category", "Not a category.")
    raw_q = request.args.get("q", "")
    try:
        q = clean_text(raw_q, max_len=60) if raw_q.strip() else ""
    except ValueError as e:
        _bad("q", str(e))
    raw_page = request.args.get("page", "1")
    if not raw_page.isdigit() or not 1 <= int(raw_page) <= catalogue_service.MAX_PAGE:
        _bad("page", f"Use a page from 1 to {catalogue_service.MAX_PAGE}.")
    return category, q, int(raw_page)


@api_bp.get("/suppliers/<uuid:supplier_id>/products")
@limiter.limit(READ_LIMIT)
@auth_required(dashboard="informal_business")
def supplier_products(supplier_id: uuid.UUID):
    category, q, page = _query()
    if supplier_service.get_active(supplier_id) is None:
        raise NotFoundError("We couldn't find that supplier.")
    return success_response(catalogue_service.list_products(supplier_id, category=category, q=q, page=page))


@api_bp.get("/products/<uuid:product_id>")
@limiter.limit(READ_LIMIT)
@auth_required(dashboard="informal_business")
def product(product_id: uuid.UUID):
    p = catalogue_service.get_active(product_id)
    if p is None or supplier_service.get_active(p.supplier_id) is None:
        raise NotFoundError("We couldn't find that product.")
    return success_response({"product": catalogue_service.public_product_view(p)})
