"""
Helpers for the notification tests: signed-in traders with their ids, and
alerts published the way a feature will publish them (through
shared.notifications, then the background queue).
"""
from __future__ import annotations

import re
import uuid

from src.shared.notifications.notification_types import NotificationEvent
from src.shared.notifications.notifications import publish_notification
from src.shared.queue.queue import wait_until_idle

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
BASE = "/api/v1/me/notifications"
SETTINGS = "/api/v1/me/notification-settings"

ORDER = {"ref": "AKZ-2026-000101", "supplier": "Mahlangu Wholesale", "total_cents": 234_000}


class Trader:
    def __init__(self, headers: dict, user_id: str):
        self.headers = headers
        self.id = user_id


def trader(client, outbox, email: str) -> Trader:
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/me", headers=headers).get_json()["data"]
    return Trader(headers, (me.get("user") or me)["id"])


def publish(who: Trader, template: str, *, dedupe: str | None = None, link: tuple | None = None, **params) -> None:
    publish_notification(
        NotificationEvent(
            recipient_user_id=who.id,
            template=template,
            dedupe_key=dedupe or f"test:{uuid.uuid4()}",
            params=params,
            link_type=link[0] if link else None,
            link_id=link[1] if link else None,
        )
    )
    wait_until_idle(timeout=10)


def listed(client, who: Trader, tab: str, **query) -> dict:
    r = client.get(BASE, headers=who.headers, query_string={"tab": tab, **query})
    assert r.status_code == 200, r.get_json()
    return r.get_json()["data"]


def unread(client, who: Trader) -> dict:
    return client.get(f"{BASE}/unread", headers=who.headers).get_json()["data"]["unread"]
