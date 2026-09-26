"""
/api/v1/me/order-book -- the signed-in trader's own counter.

  GET    /menu                       the items on the menu now
  PUT    /menu                       the whole menu as it should be
  GET    /orders?day=YYYY-MM-DD      that day's orders, by number
  POST   /orders                     an order (201; a retry of the same
                                     id: 200 with the same order and number)
  PATCH  /orders/<id>                {status, at}: the queue's next step
  GET    /week?end=YYYY-MM-DD        7 days in numbers, oldest first

<id> is the phone's key for the order, always looked up with the signed-in
trader (CONTRACT_order_book.txt DECISION 1). Thin: validate -> service ->
answer. Rate-limited per trader, not per IP: two phones in one shop share
the shop's Wi-Fi.
"""
from __future__ import annotations

import uuid

from flask import request

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.domains.informal_trader.credit_book.api import limits
from src.shared.rate_limit.limiter import limiter

from ..constants import MENU_LIMIT, ORDER_LIMIT, READ_LIMIT, STEP_LIMIT
from ..schemas.order_book_schemas import DayQuerySchema, MenuSchema, NewOrderSchema, StepSchema, WeekQuerySchema, load
from ..services import menu_service, orders_service

BASE = "/me/order-book"
TRADER = "informal_business"


@api_bp.get(f"{BASE}/menu")
@limiter.limit(READ_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def order_book_menu():
    return success_response({"items": menu_service.menu(current_user())})


@api_bp.put(f"{BASE}/menu")
@limiter.limit(MENU_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def save_order_book_menu():
    data = load(MenuSchema(), request.get_json(silent=True))
    return success_response({"items": menu_service.save_menu(current_user(), data["items"])}, message="Menu saved.")


@api_bp.get(f"{BASE}/orders")
@limiter.limit(READ_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def order_book_orders():
    query = load(DayQuerySchema(), request.args.to_dict())
    return success_response({"orders": orders_service.orders(current_user(), query["day"])})


@api_bp.post(f"{BASE}/orders")
@limiter.limit(ORDER_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def new_order_book_order():
    data = load(NewOrderSchema(), request.get_json(silent=True))
    order, created = orders_service.create(current_user(), data)
    return success_response({"order": order}, message="Saved." if created else "Already saved.", status_code=201 if created else 200)


@api_bp.patch(f"{BASE}/orders/<uuid:client_key>")
@limiter.limit(STEP_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def step_order_book_order(client_key: uuid.UUID):
    data = load(StepSchema(), request.get_json(silent=True))
    return success_response({"order": orders_service.step(current_user(), client_key, data["status"], data["at"])})


@api_bp.get(f"{BASE}/week")
@limiter.limit(READ_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def order_book_week():
    query = load(WeekQuerySchema(), request.args.to_dict())
    return success_response({"days": orders_service.week(current_user(), query["end"])})
