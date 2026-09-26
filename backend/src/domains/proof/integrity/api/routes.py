"""
/api/v1 -- record seals (services/seal_service.py).

  POST /me/record/seal     seal every record in my tools; the seal comes
                           back to me, we keep no copy
  POST /me/record/check    {"seal": ...} -> is it whole, and has anything I
                           sealed changed since?
  GET  /proof/keys         the public keys that sign seals (public), so
                           anyone can check a seal's signatures without us
"""
from __future__ import annotations

from flask import request

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.domains.informal_trader.credit_book.api import limits
from src.shared.rate_limit.limiter import limiter

from ..schemas.seal_schemas import CheckSchema, load
from ..services import seal_keys, seal_service


@api_bp.post("/me/record/seal")
@limiter.limit("20 per hour", key_func=limits.per_user)
@auth_required(dashboard="informal_business")
def seal_my_record():
    return success_response({"seal": seal_service.seal(current_user())}, message="Sealed.", status_code=201)


@api_bp.post("/me/record/check")
@limiter.limit("30 per minute", key_func=limits.per_user)
@auth_required(dashboard="informal_business")
def check_my_record():
    data = load(CheckSchema(), request.get_json(silent=True))
    return success_response({"check": seal_service.check(current_user(), data["seal"])})


@api_bp.get("/proof/keys")
@limiter.limit("60 per minute")
def seal_public_keys():
    return success_response({"keys": seal_keys.public_keys()})
