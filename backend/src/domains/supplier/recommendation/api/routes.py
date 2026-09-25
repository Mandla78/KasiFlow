"""
/api/v1/suppliers -- suppliers for the signed-in trader.

  GET /suppliers/recommended     every active supplier, best fit first,
                                 with reasons (the recommendation engine)
  GET /suppliers/<id>            one supplier's page, with why it suits you
"""
from __future__ import annotations

import uuid

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.shared.rate_limit.limiter import limiter

from ..services import recommendation_service as engine

READ_LIMIT = "120 per minute"


@api_bp.get("/suppliers/recommended")
@limiter.limit(READ_LIMIT)
@auth_required(dashboard="informal_business")
def recommended_suppliers():
    return success_response({"suppliers": engine.recommend(current_user())})


@api_bp.get("/suppliers/<uuid:supplier_id>")
@limiter.limit(READ_LIMIT)
@auth_required(dashboard="informal_business")
def supplier_page(supplier_id: uuid.UUID):
    return success_response({"supplier": engine.supplier_for_trader(current_user(), supplier_id)})
