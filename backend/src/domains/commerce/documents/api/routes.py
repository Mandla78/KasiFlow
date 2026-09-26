"""
/api/v1/me/orders/<id>/documents/<kind> -- a 10-minute download link for
the order's invoice or payment receipt (kind: invoice | receipt).
"""
from __future__ import annotations

import uuid

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.exceptions import NotFoundError
from src.core.responses import success_response
from src.shared.rate_limit.limiter import limiter

from ..services import document_service


@api_bp.post("/me/orders/<uuid:order_id>/documents/<kind>")
@limiter.limit("30 per minute")
@auth_required(dashboard="informal_business")
def document_link(order_id: uuid.UUID, kind: str):
    if kind not in document_service.KINDS:
        raise NotFoundError("Not found.")
    return success_response({"url": document_service.link(current_user(), order_id, kind)})
