"""
/api/v1/me/orders -- the signed-in trader's orders.

  POST /me/orders              place (send an Idempotency-Key: a retried
                               "Place order" never creates two orders)
  GET  /me/orders              newest first
  GET  /me/orders/<id>
  POST /me/orders/<id>/cancel  cash orders, until the supplier accepts
"""
from __future__ import annotations

import uuid

from flask import request

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.shared.idempotency.http import run_once
from src.shared.rate_limit.limiter import limiter

from ..schemas.order_schemas import load_place
from ..services import order_service

PLACE_LIMIT = "20 per minute"
READ_LIMIT = "120 per minute"


@api_bp.post("/me/orders")
@limiter.limit(PLACE_LIMIT)
@auth_required(dashboard="informal_business")
def place_order():
    def handler():
        order = order_service.place(current_user(), load_place(request.get_json(silent=True)))
        return success_response({"order": order}, message="Order placed.", status_code=201)

    return run_once(handler)


@api_bp.get("/me/orders")
@limiter.limit(READ_LIMIT)
@auth_required(dashboard="informal_business")
def my_orders():
    return success_response({"orders": order_service.list_mine(current_user())})


@api_bp.get("/me/orders/<uuid:order_id>")
@limiter.limit(READ_LIMIT)
@auth_required(dashboard="informal_business")
def my_order(order_id: uuid.UUID):
    return success_response({"order": order_service.get_mine(current_user(), order_id)})


@api_bp.post("/me/orders/<uuid:order_id>/cancel")
@limiter.limit(PLACE_LIMIT)
@auth_required(dashboard="informal_business")
def cancel_order(order_id: uuid.UUID):
    return success_response({"order": order_service.cancel(current_user(), order_id)}, message="Order cancelled.")
