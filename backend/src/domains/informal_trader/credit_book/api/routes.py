"""
/api/v1/me/credit-book -- the signed-in trader's own credit book.

  GET    /entries?status=open|paid|all      the book (default open + paid)
  POST   /entries                           a credit sale (Idempotency-Key)
  GET    /entries/<id>                      one entry with its history
  POST   /entries/<id>/payments             money paid back (Idempotency-Key)
  POST   /entries/<id>/corrections          new amount / due date / description
  POST   /entries/<id>/cancel               an entry made by mistake
  GET    /customers?q=                      search as you type
  PATCH  /customers/<id>                    set or clear the cellphone
  DELETE /customers/<id>                    anonymise; the amounts stay
  GET    /summary                           totals for Home and Account

Thin: validate -> service -> answer. Every route is signed-in traders only,
rate-limited per trader, and scoped to current_user() by the service. A
malformed id in the URL is the same 404 as someone else's.
"""
from __future__ import annotations

import uuid

from flask import request

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.shared.rate_limit.limiter import limiter

from ..schemas.credit_book_schemas import (
    CancelSchema,
    CorrectionSchema,
    CustomerPhoneSchema,
    ListQuerySchema,
    NewEntrySchema,
    PaymentSchema,
    SearchQuerySchema,
    load,
)
from ..services import credit_book_service as service
from . import limits
from .idempotent import run_once

BASE = "/me/credit-book"
TRADER = "informal_business"


def _body() -> dict:
    return request.get_json(silent=True)


@api_bp.get(f"{BASE}/entries")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def credit_entries():
    query = load(ListQuerySchema(), request.args.to_dict())
    return success_response({"entries": service.list_entries(current_user(), query["status"])})


@api_bp.post(f"{BASE}/entries")
@limiter.limit(limits.WRITE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def add_credit_sale():
    def handler():
        data = load(NewEntrySchema(), _body())
        return success_response({"entry": service.add_sale(current_user(), data)}, message="Saved.", status_code=201)

    return run_once(handler)


@api_bp.get(f"{BASE}/entries/<uuid:entry_id>")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def credit_entry(entry_id: uuid.UUID):
    return success_response({"entry": service.get_entry(current_user(), entry_id)})


@api_bp.post(f"{BASE}/entries/<uuid:entry_id>/payments")
@limiter.limit(limits.WRITE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def record_credit_payment(entry_id: uuid.UUID):
    def handler():
        data = load(PaymentSchema(), _body())
        return success_response({"entry": service.record_payment(current_user(), entry_id, data)}, message="Saved.", status_code=201)

    return run_once(handler)


@api_bp.post(f"{BASE}/entries/<uuid:entry_id>/corrections")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def correct_credit_entry(entry_id: uuid.UUID):
    data = load(CorrectionSchema(), _body())
    return success_response({"entry": service.correct(current_user(), entry_id, data)}, message="Correction saved.", status_code=201)


@api_bp.post(f"{BASE}/entries/<uuid:entry_id>/cancel")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def cancel_credit_entry(entry_id: uuid.UUID):
    data = load(CancelSchema(), _body() or {})
    return success_response({"entry": service.cancel(current_user(), entry_id, data["reason"])}, message="Entry cancelled.")


@api_bp.get(f"{BASE}/customers")
@limiter.limit(limits.SEARCH, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def credit_customers():
    query = load(SearchQuerySchema(), request.args.to_dict())
    return success_response({"customers": service.search_customers(current_user(), query["q"])})


@api_bp.patch(f"{BASE}/customers/<uuid:customer_id>")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def set_credit_customer_phone(customer_id: uuid.UUID):
    data = load(CustomerPhoneSchema(), _body())
    return success_response({"customer": service.set_customer_phone(current_user(), customer_id, data["phone"])}, message="Saved.")


@api_bp.delete(f"{BASE}/customers/<uuid:customer_id>")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def delete_credit_customer(customer_id: uuid.UUID):
    service.delete_customer(current_user(), customer_id)
    return success_response({}, message="Customer deleted.")


@api_bp.get(f"{BASE}/summary")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def credit_summary():
    return success_response({"summary": service.summary(current_user())})
