"""
/api/v1/me/suppliers -- the suppliers the signed-in trader is connected to
(only those can be ordered from).

  GET    /me/suppliers          the connected suppliers' ids
  PUT    /me/suppliers/<id>     connect (connecting twice is fine)
  DELETE /me/suppliers/<id>     disconnect (the history is kept)
"""
from __future__ import annotations

import uuid

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.shared.rate_limit.limiter import limiter

from ..services import connection_service

WRITE_LIMIT = "30 per minute"


@api_bp.get("/me/suppliers")
@limiter.limit("120 per minute")
@auth_required(dashboard="informal_business")
def my_suppliers():
    return success_response({"supplier_ids": sorted(str(i) for i in connection_service.connected_ids(current_user()))})


@api_bp.put("/me/suppliers/<uuid:supplier_id>")
@limiter.limit(WRITE_LIMIT)
@auth_required(dashboard="informal_business")
def connect_supplier(supplier_id: uuid.UUID):
    connection_service.connect(current_user(), supplier_id)
    return success_response({"connected": True}, message="Connected.")


@api_bp.delete("/me/suppliers/<uuid:supplier_id>")
@limiter.limit(WRITE_LIMIT)
@auth_required(dashboard="informal_business")
def disconnect_supplier(supplier_id: uuid.UUID):
    connection_service.disconnect(current_user(), supplier_id)
    return success_response({"connected": False}, message="Disconnected.")
