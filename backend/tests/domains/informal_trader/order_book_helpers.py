"""
Helpers for the order book tests: a signed-in trader, the kota starter
menu, and an order the way the phone sends it (its own key, its own time).
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

from src.domains.informal_trader.order_book.services.orders_service import SA

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
BASE = "/api/v1/me/order-book"

#: The app's kota starter (order-book/lib/menus.ts).
KOTA_MENU = [
    {"name": "Kota: chips, polony, cheese", "price_cents": 3500, "ingredients": ["quarter_loaf", "chips", "polony", "cheese", "atchar"]},
    {"name": "Russian kota", "price_cents": 4500, "ingredients": ["quarter_loaf", "chips", "russian", "polony", "cheese", "atchar"]},
    {"name": "Chips large", "price_cents": 2500, "ingredients": ["chips"]},
    {"name": "Cold drink", "price_cents": 1200, "ingredients": ["cold_drink"]},
]


def signed_in(client, outbox, email="lindiwe@example.com") -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def data(r, key: str | None = None):
    assert r.status_code in (200, 201), (r.status_code, r.get_json())
    body = r.get_json()["data"]
    return body[key] if key else body


def error(r, status: int) -> dict:
    assert r.status_code == status, (r.status_code, r.get_json())
    return r.get_json()


def save_menu(client, headers, items=None) -> list[dict]:
    return data(client.put(f"{BASE}/menu", headers=headers, json={"items": KOTA_MENU if items is None else items}), "items")


def by_name(menu: list[dict]) -> dict[str, dict]:
    return {m["name"]: m for m in menu}


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def order_body(menu, *picks: tuple[str, int], taken: datetime | None = None, key: str | None = None, **overrides) -> dict:
    """What the phone sends: its own key, its own time, and the SA day of that time."""
    taken = taken or datetime.now(timezone.utc)
    items = by_name(menu)
    return {
        "id": key or str(uuid.uuid4()),
        "day": taken.astimezone(SA).date().isoformat(),
        "temp_number": "A1",
        "lines": [{"item_id": items[name]["id"], "qty": qty} for name, qty in (picks or (("Russian kota", 1),))],
        "payment": "cash",
        "customer_name": None,
        "created_at": iso(taken),
        **overrides,
    }


def place(client, headers, menu, *picks, **kw) -> dict:
    r = client.post(f"{BASE}/orders", headers=headers, json=order_body(menu, *picks, **kw))
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]["order"]


def step(client, headers, key: str, status: str, at: datetime | None = None):
    return client.patch(f"{BASE}/orders/{key}", headers=headers, json={"status": status, "at": iso(at or datetime.now(timezone.utc))})


def minutes_ago(n: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=n)
