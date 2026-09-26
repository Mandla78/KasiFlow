"""
/api/v1/me/record -- My record: the signed-in trader's money, one month at
a time, kept apart by what backs it (services/record_service.py).

  GET /me/record/summary?month=YYYY-MM     default: this month (SAST)

Read-only, own data only (the service works from current_user()), per-user
rate limit; no audit event (nothing changes, nothing disputable).
"""
from __future__ import annotations

from flask import request

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.domains.informal_trader.credit_book.api import limits
from src.shared.rate_limit.limiter import limiter

from ..schemas.record_schemas import RecordQuerySchema, load
from ..services import record_service

LIMIT = "30 per minute"


@api_bp.get("/me/record/summary")
@limiter.limit(LIMIT, key_func=limits.per_user)
@auth_required(dashboard="informal_business")
def my_record_summary():
    # A repeated field (?month=a&month=b) stays a list, which the schema refuses.
    args = {k: v[0] if len(v) == 1 else v for k, v in request.args.to_dict(flat=False).items()}
    query = load(RecordQuerySchema(), args)
    return success_response({"record": record_service.summary(current_user(), query["month"])})
