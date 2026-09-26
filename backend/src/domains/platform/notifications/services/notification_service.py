"""
notifications -- keep the alerts publishers send, and serve them to their
owner (CONTRACT_notifications.txt).

  register(app)                    the listener on shared.notifications (once)
  store(event)                     one alert, if its template, params and
                                   the owner's switch allow it (the listener)
  list_for(user, tab, before, n)   newest first -> (alerts, next_before)
  unread(user)                     {orders, inbox, latest_id}: the 20 s poll;
                                   the first of the day also runs the daily
                                   checks (shared.notifications.run_daily)
  read(user, id)                   -> (alert, unread)
  read_all(user, tab)              -> unread (that tab only)
  get_settings(user) / save_settings(user, data)

Every call about alerts acts on the signed-in user only: another user's
alert is "not found". Publishers never call this module: they publish,
and this listens.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

from flask import Flask

from src.core.base_model import utcnow
from src.core.exceptions import NotFoundError
from src.extensions import db
from src.shared.audit.event_types.platform import PlatformAuditEvent as E
from src.shared.cache.cache import cache
from src.shared.notifications import notifications as shared_notifications
from src.shared.notifications.notification_types import NotificationEvent

from ..constants import TIMEZONE
from ..models import Notification, NotificationSettings
from ..repositories import notification_repository as repo
from ..templates import LINK_TYPES, TEMPLATES, missing, render
from . import notification_audit

logger = logging.getLogger("akayza.notifications")

#: The switches a trader can turn off. Security has none: always written.
SWITCHES = ("orders", "jobs", "credit")

_app: Optional[Flask] = None
_registered = False


def register(app: Flask) -> None:
    """Called once from create_app(). The listener runs on the background
    queue, so it keeps the app to open its own app context there."""
    global _app, _registered
    _app = app
    if not _registered:
        shared_notifications.register_listener(_listen)
        _registered = True


def _listen(event: NotificationEvent) -> None:
    if _app is None:
        return
    with _app.app_context():
        try:
            store(event)
        finally:
            db.session.remove()


def _plain(value: Any) -> Any:
    """Params are stored as JSON: anything that isn't a number, text or
    true/false is kept as its text (a UUID, a date)."""
    return value if value is None or isinstance(value, (bool, int, float, str)) else str(value)


def store(event: NotificationEvent) -> bool:
    """Write the alert once. False (and nothing written) for an unknown
    template, missing params, an unknown link, or a switch that's off."""
    template = TEMPLATES.get(event.template)
    if template is None:
        logger.warning("notification with an unknown template=%s dropped", event.template)
        return False
    params = {k: _plain(v) for k, v in (event.params or {}).items()}
    gaps = missing(event.template, params)
    if gaps:
        logger.warning("notification template=%s dropped: params missing %s", event.template, sorted(gaps))
        return False
    if event.link_type is not None and event.link_type not in LINK_TYPES:
        logger.warning("notification template=%s dropped: unknown link_type=%s", event.template, event.link_type)
        return False
    user_id = uuid.UUID(str(event.recipient_user_id))
    return repo.insert_once(
        {
            "user_id": user_id,
            "tab": template.tab,
            "kind": event.template,
            "params": params,
            "link_type": event.link_type,
            "link_id": str(event.link_id) if event.link_id is not None else None,
            "dedupe_key": event.dedupe_key[:160],
        },
        switch=None if template.topic == "security" else template.topic,
    )


# -------------------------------------------------------------------- reads


def list_for(user, tab: str, before: Optional[uuid.UUID], limit: int) -> tuple[list[dict], Optional[str]]:
    cursor = None
    if before is not None:
        cursor = repo.one(user.id, before)
        if cursor is None:
            raise NotFoundError("We couldn't find that notification.")
    rows = repo.page(user.id, tab, cursor, limit)
    return [view(n) for n in rows], (str(rows[-1].id) if len(rows) == limit else None)


def unread(user) -> dict:
    _daily_once(user)
    counts = repo.unread_counts(user.id)
    newest = repo.latest(user.id)
    return {"orders": counts.get("orders", 0), "inbox": counts.get("inbox", 0), "latest_id": str(newest.id) if newest else None}


def _daily_once(user) -> None:
    """The daily checks, once per user per South African day (per server
    process; the alerts' dedupe_key keeps it to one row either way). What
    they publish shows on the next poll."""
    day = datetime.now(ZoneInfo(TIMEZONE)).date().isoformat()
    if cache.increment(f"notifications:daily:{user.id}:{day}", ttl_seconds=2 * 86_400) == 1:
        shared_notifications.run_daily(user)


# ------------------------------------------------------------------- writes


def read(user, notification_id: uuid.UUID) -> tuple[dict, dict]:
    row = repo.one(user.id, notification_id)
    if row is None:
        raise NotFoundError("We couldn't find that notification.")
    if row.read_at is None:
        row.read_at = utcnow()
        db.session.commit()
    return view(row), unread(user)


def read_all(user, tab: str) -> dict:
    repo.mark_all_read(user.id, tab, utcnow())
    db.session.commit()
    return unread(user)


def get_settings(user) -> dict:
    row = repo.settings(user.id)
    on = {s: (True if row is None else bool(getattr(row, s))) for s in SWITCHES}
    return {**on, "security": True}


def save_settings(user, data: dict) -> dict:
    before = get_settings(user)
    row = repo.settings(user.id)
    if row is None:
        row = NotificationSettings(user_id=user.id)
        repo.add(row)
    for switch in SWITCHES:
        setattr(row, switch, data[switch])
    db.session.commit()
    for switch in SWITCHES:
        if before[switch] != data[switch]:
            notification_audit.record(E.NOTIFICATION_SETTINGS_CHANGED, user_id=user.id, switch=switch, on=data[switch])
    return get_settings(user)


def view(n: Notification) -> dict:
    title, body = render(n.kind, n.params)
    return {
        "id": str(n.id),
        "tab": n.tab,
        "kind": n.kind,
        "icon": TEMPLATES[n.kind].icon,
        "title": title,
        "body": body,
        "link": {"type": n.link_type, "id": n.link_id} if n.link_type else None,
        "created_at": n.created_at.isoformat(),
        "read_at": n.read_at.isoformat() if n.read_at else None,
    }
