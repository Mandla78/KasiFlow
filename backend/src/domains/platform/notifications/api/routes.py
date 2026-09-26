"""
/api/v1/me/notifications -- the signed-in trader's own alerts.

  GET  /me/notifications?tab=orders|inbox&before=<id>&limit=20
  GET  /me/notifications/unread          {orders, inbox, latest_id}
  POST /me/notifications/<id>/read       {notification, unread}
  POST /me/notifications/read-all        {tab} -> {unread}
  GET  /me/notification-settings         {orders, jobs, credit, security}
  PUT  /me/notification-settings         {orders, jobs, credit}

Thin: validate -> service -> answer. Rate-limited per user; another
user's alert is the same 404 as one that doesn't exist.
"""
from __future__ import annotations

import uuid

from flask import request

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.domains.informal_trader.credit_book.api import limits
from src.shared.rate_limit.limiter import limiter

from ..constants import CHANGE_LIMIT, READ_LIMIT
from ..schemas.notification_schemas import ListQuerySchema, ReadAllSchema, SettingsSchema, load
from ..services import notification_service as service

BASE = "/me/notifications"
TRADER = "informal_business"


@api_bp.get(BASE)
@limiter.limit(READ_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def my_notifications():
    q = load(ListQuerySchema(), request.args.to_dict())
    items, next_before = service.list_for(current_user(), q["tab"], q["before"], q["limit"])
    return success_response({"notifications": items, "next_before": next_before})


@api_bp.get(f"{BASE}/unread")
@limiter.limit(READ_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def my_unread_notifications():
    return success_response({"unread": service.unread(current_user())})


@api_bp.post(f"{BASE}/<uuid:notification_id>/read")
@limiter.limit(READ_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def read_notification(notification_id: uuid.UUID):
    item, unread = service.read(current_user(), notification_id)
    return success_response({"notification": item, "unread": unread})


@api_bp.post(f"{BASE}/read-all")
@limiter.limit(CHANGE_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def read_all_notifications():
    data = load(ReadAllSchema(), request.get_json(silent=True))
    return success_response({"unread": service.read_all(current_user(), data["tab"])})


@api_bp.get("/me/notification-settings")
@limiter.limit(READ_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def my_notification_settings():
    return success_response({"settings": service.get_settings(current_user())})


@api_bp.put("/me/notification-settings")
@limiter.limit(CHANGE_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def save_my_notification_settings():
    data = load(SettingsSchema(), request.get_json(silent=True))
    return success_response({"settings": service.save_settings(current_user(), data)}, message="Saved.")
