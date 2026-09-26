"""
The order book against someone trying things: another trader's menu and
orders (IDOR, including the phone's key), hostile input on every write,
and limits counted per trader.
"""
from __future__ import annotations

import uuid

import pytest

from order_book_helpers import BASE, by_name, data, error, order_body, place, save_menu, signed_in, step
from src.shared.rate_limit.limiter import limiter


@pytest.fixture
def me(client, outbox):
    return signed_in(client, outbox)


@pytest.fixture
def other(client, outbox):
    return signed_in(client, outbox, email="sipho@example.com")


@pytest.fixture
def menu(client, me):
    return save_menu(client, me)


# -------------------------------------------------------------------- IDOR


def test_another_trader_sees_nothing_of_mine(client, me, other, menu):
    o = place(client, me, menu, customer_name="Thabo")
    assert data(client.get(f"{BASE}/menu", headers=other), "items") == []
    assert data(client.get(f"{BASE}/orders", headers=other, query_string={"day": o["day"]}), "orders") == []
    week = data(client.get(f"{BASE}/week", headers=other, query_string={"end": o["day"]}), "days")
    assert sum(d["orders"] for d in week) == 0


def test_another_trader_cant_move_my_order(client, me, other, menu):
    o = place(client, me, menu)
    assert step(client, other, o["id"], "preparing").status_code == 404
    assert step(client, other, o["id"], "cancelled").status_code == 404
    assert data(client.get(f"{BASE}/orders", headers=me, query_string={"day": o["day"]}), "orders")[0]["status"] == "new"


def test_the_same_phone_key_from_another_trader_is_their_own_order(client, me, other, menu):
    mine = place(client, me, menu, ("Russian kota", 3), customer_name="Thabo")
    their_menu = save_menu(client, other, [{"name": "Pap and wors", "price_cents": 5000, "ingredients": ["pap", "wors"]}])
    r = client.post(f"{BASE}/orders", headers=other, json=order_body(their_menu, ("Pap and wors", 1), key=mine["id"]))
    # A clash never tells one trader that another's order exists: theirs is new, numbered in their own day.
    assert r.status_code == 201
    theirs = r.get_json()["data"]["order"]
    assert theirs["number"] == 1 and theirs["lines"][0]["name"] == "Pap and wors" and theirs["customer_name"] is None
    assert "Russian" not in str(theirs) and "Thabo" not in str(theirs)
    assert data(client.get(f"{BASE}/orders", headers=me, query_string={"day": mine["day"]}), "orders")[0]["lines"][0]["qty"] == 3


def test_another_traders_items_arent_on_my_menu(client, me, other, menu):
    their_menu = save_menu(client, other, [{"name": "Pap and wors", "price_cents": 5000, "ingredients": ["pap"]}])
    body = order_body(menu)
    body["lines"] = [{"item_id": their_menu[0]["id"], "qty": 1}]
    assert error(client.post(f"{BASE}/orders", headers=me, json=body), 422)["message"] == "That item isn't on the menu any more."
    # Nor can I rename theirs by sending its id in my menu.
    error(client.put(f"{BASE}/menu", headers=me, json={"items": [{**their_menu[0], "name": "Stolen"}]}), 422)
    assert data(client.get(f"{BASE}/menu", headers=other), "items")[0]["name"] == "Pap and wors"


# ----------------------------------------------------------- hostile input


def _with_line(menu, **line):
    body = order_body(menu)
    body["lines"] = [{"item_id": menu[0]["id"], "qty": 1, **line}]
    return body


@pytest.mark.parametrize(
    "change",
    [
        {"id": "not-a-uuid"},
        {"id": None},
        {"temp_number": "Z9"},
        {"temp_number": "A0"},
        {"temp_number": "A12345"},
        {"temp_number": "<script>"},
        {"payment": "free"},
        {"payment": "Cash"},
        {"lines": []},
        {"lines": "kota"},
        {"customer_name": "0821234567"},
        {"customer_name": "Thabo 082 123 4567"},
        {"customer_name": "T" * 31},
        {"customer_name": "   "},
        {"customer_name": "Tha‮bo"},
        {"created_at": "yesterday"},
        {"created_at": 1758880000},
        {"day": "26/09/2026"},
        {"status": "collected"},
        {"total_cents": 1},
    ],
)
def test_hostile_orders_are_refused(client, me, menu, change):
    error(client.post(f"{BASE}/orders", headers=me, json={**order_body(menu), **change}), 422)


@pytest.mark.parametrize("qty", [0, -1, 51, 1.5, "2", True, None, 10**12])
def test_quantities_are_whole_and_bounded(client, me, menu, qty):
    error(client.post(f"{BASE}/orders", headers=me, json=_with_line(menu, qty=qty)), 422)


def test_twenty_lines_at_most(client, me, menu):
    body = order_body(menu)
    body["lines"] = [{"item_id": menu[0]["id"], "qty": 1}] * 21
    error(client.post(f"{BASE}/orders", headers=me, json=body), 422)
    body["lines"] = body["lines"][:20]
    assert client.post(f"{BASE}/orders", headers=me, json=body).status_code == 201


def test_unknown_fields_in_a_line_are_refused(client, me, menu):
    error(client.post(f"{BASE}/orders", headers=me, json=_with_line(menu, name="Free kota")), 422)


def test_nul_and_broken_bodies(client, me, menu):
    assert client.post(f"{BASE}/orders", headers=me, json={**order_body(menu), "customer_name": "Tha\x00bo"}).status_code == 400
    assert client.put(f"{BASE}/menu", headers=me, data="{not json", content_type="application/json").status_code in (400, 422)
    error(client.post(f"{BASE}/orders", headers=me, json=["a", "list"]), 422)
    error(client.put(f"{BASE}/menu", headers=me, json={"items": [{"name": {"$ne": ""}, "price_cents": 100}]}), 422)


@pytest.mark.parametrize("name", ["0821234567", "082 123 4567", "Thabo 0821234567", "+27 82 123 4567"])
def test_a_phone_number_is_never_a_name(client, me, menu, name):
    r = client.post(f"{BASE}/orders", headers=me, json={**order_body(menu), "customer_name": name})
    assert error(r, 422)["message"] == "Use a first name, not a number."


def test_a_first_name_is_kept_clean(client, me, menu):
    o = place(client, me, menu, customer_name="  Mama   Joy ")
    assert o["customer_name"] == "Mama Joy"


def test_a_menu_item_name_with_markup_is_just_text(client, me):
    saved = save_menu(client, me, [{"name": "<b>Kota</b>", "price_cents": 3500, "ingredients": []}])
    assert saved[0]["name"] == "<b>Kota</b>"  # stored as typed, shown as text by the app


# ------------------------------------------------------------------ limits


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


def test_limits_count_per_trader_not_per_wifi(client, me, other, limits_on):
    codes = [client.get(f"{BASE}/menu", headers=me).status_code for _ in range(121)]
    assert codes[:120] == [200] * 120 and codes[120] == 429
    assert client.get(f"{BASE}/menu", headers=other).status_code == 200


def test_menu_saves_are_limited(client, me, limits_on):
    items = [{"name": "Kota", "price_cents": 3500, "ingredients": []}]
    codes = [client.put(f"{BASE}/menu", headers=me, json={"items": items}).status_code for _ in range(31)]
    assert codes[:30] == [200] * 30 and codes[30] == 429


def test_a_lunch_rush_is_not_limited(client, me, menu, limits_on):
    items = by_name(menu)
    codes = [client.post(f"{BASE}/orders", headers=me, json=order_body(menu, ("Cold drink", 1))).status_code for _ in range(60)]
    assert codes == [201] * 60 and items
