"""
Notifications against someone trying things: odd ids, tabs, pages and
switches, and limits counted per user.
"""
from __future__ import annotations

import pytest

from notification_helpers import BASE, SETTINGS, trader
from src.shared.rate_limit.limiter import limiter


@pytest.fixture
def me(client, outbox):
    return trader(client, outbox, "lindiwe@example.com")


@pytest.fixture
def limits_on(app):
    was = limiter.enabled
    limiter.enabled = True
    with app.app_context():
        limiter.reset()
    yield
    with app.app_context():
        limiter.reset()
    limiter.enabled = was


@pytest.mark.parametrize(
    "query,status",
    [
        ({}, 422),
        ({"tab": "../x"}, 422),
        ({"tab": "ORDERS"}, 422),
        ({"tab": "orders", "limit": "10000"}, 422),
        ({"tab": "orders", "limit": "0"}, 422),
        ({"tab": "orders", "limit": "ten"}, 422),
        ({"tab": "orders", "before": "not-a-uuid"}, 422),
        ({"tab": "orders", "user_id": "someone-else"}, 422),
        ({"tab": "orders\x00"}, 400),
    ],
)
def test_odd_list_queries_are_refused(client, me, query, status):
    assert client.get(BASE, headers=me.headers, query_string=query).status_code == status


def test_a_bad_id_is_a_404(client, me):
    assert client.post(f"{BASE}/not-a-uuid/read", headers=me.headers).status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {"orders": True, "jobs": True, "credit": True, "security": False},  # security can't be switched off
        {"orders": "yes", "jobs": True, "credit": True},
        {"orders": 1, "jobs": True, "credit": True},
        {"orders": True, "jobs": True},
        {"orders": None, "jobs": True, "credit": True},
        ["orders"],
        {"orders": {"$ne": False}, "jobs": True, "credit": True},
    ],
)
def test_odd_settings_are_refused(client, me, body):
    assert client.put(SETTINGS, headers=me.headers, json=body).status_code == 422
    assert client.get(SETTINGS, headers=me.headers).get_json()["data"]["settings"]["orders"] is True


@pytest.mark.parametrize("body", [{}, {"tab": "all"}, {"tab": "orders", "ids": ["x"]}, "orders"])
def test_odd_read_all_bodies_are_refused(client, me, body):
    assert client.post(f"{BASE}/read-all", headers=me.headers, json=body).status_code == 422


def test_deep_json_is_refused(client, me):
    deep: dict = {}
    node = deep
    for _ in range(200):
        node["x"] = {}
        node = node["x"]
    assert client.put(SETTINGS, headers=me.headers, json=deep).status_code in (400, 422)


def test_the_poll_is_limited_per_user(client, outbox, me, limits_on):
    other = trader(client, outbox, "sipho@example.com")
    codes = [client.get(f"{BASE}/unread", headers=me.headers).status_code for _ in range(121)]
    assert codes[:120] == [200] * 120 and codes[120] == 429
    assert client.get(f"{BASE}/unread", headers=other.headers).status_code == 200
