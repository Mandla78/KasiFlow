"""
/api/v1/me/delivery-addresses -- the signed-in trader's saved delivery
places (the business address itself lives in the business profile).

  GET    /me/delivery-addresses                 default first
  POST   /me/delivery-addresses                 save one (Idempotency-Key honoured)
  PATCH  /me/delivery-addresses/<id>            change label, text or pin
  DELETE /me/delivery-addresses/<id>            remove (soft)
  POST   /me/delivery-addresses/<id>/default    checkout picks it first
"""
from __future__ import annotations

import uuid

from flask import request

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.shared.idempotency.http import run_once
from src.shared.rate_limit.limiter import limiter

from ..schemas.delivery_address_schemas import load_new, load_patch
from ..services import delivery_address_service as service

READ_LIMIT = "60 per minute"
WRITE_LIMIT = "20 per minute"


@api_bp.get("/me/delivery-addresses")
@limiter.limit(READ_LIMIT)
@auth_required(dashboard="informal_business")
def my_delivery_addresses():
    return success_response({"addresses": service.list_mine(current_user())})


@api_bp.post("/me/delivery-addresses")
@limiter.limit(WRITE_LIMIT)
@auth_required(dashboard="informal_business")
def add_delivery_address():
    def handler():
        address = service.add(current_user(), load_new(request.get_json(silent=True)))
        return success_response({"address": address}, message="Address saved.", status_code=201)

    return run_once(handler)


@api_bp.patch("/me/delivery-addresses/<uuid:address_id>")
@limiter.limit(WRITE_LIMIT)
@auth_required(dashboard="informal_business")
def change_delivery_address(address_id: uuid.UUID):
    address = service.update(current_user(), address_id, load_patch(request.get_json(silent=True)))
    return success_response({"address": address}, message="Address saved.")


@api_bp.delete("/me/delivery-addresses/<uuid:address_id>")
@limiter.limit(WRITE_LIMIT)
@auth_required(dashboard="informal_business")
def remove_delivery_address(address_id: uuid.UUID):
    service.remove(current_user(), address_id)
    return success_response({}, message="Address removed.")


@api_bp.post("/me/delivery-addresses/<uuid:address_id>/default")
@limiter.limit(WRITE_LIMIT)
@auth_required(dashboard="informal_business")
def default_delivery_address(address_id: uuid.UUID):
    address = service.make_default(current_user(), address_id)
    return success_response({"address": address}, message="This is now your default address.")
