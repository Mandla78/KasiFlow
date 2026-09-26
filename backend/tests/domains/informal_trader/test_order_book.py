"""
The order book end to end: the menu (with a price history), orders that
land once however often the phone retries, the day's numbers from the
server, prices from the server as they were when the order was taken, the
queue one step at a time, and the week in numbers.
"""
from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from order_book_helpers import BASE, KOTA_MENU, by_name, data, error, minutes_ago, order_body, place, save_menu, signed_in, step
from src.domains.informal_trader.order_book.models import OrderBookItem, OrderBookItemPrice, OrderBookOrder
from src.domains.informal_trader.order_book.services.orders_service import SA
from src.domains.security.audit.models import AuditEventRecord
from src.extensions import db


@pytest.fixture
def me(client, outbox):
    return signed_in(client, outbox)


@pytest.fixture
def menu(client, me):
    return save_menu(client, me)


def orders_on(client, headers, day: str) -> list[dict]:
    return data(client.get(f"{BASE}/orders", headers=headers, query_string={"day": day}), "orders")


# ------------------------------------------------------------------ access


@pytest.mark.parametrize(
    "method,path",
    [("get", "/menu"), ("put", "/menu"), ("get", "/orders?day=2026-09-26"), ("post", "/orders"), ("patch", "/orders/{k}"), ("get", "/week?end=2026-09-26")],
)
def test_every_route_needs_a_token(client, method, path):
    assert getattr(client, method)(BASE + path.format(k=uuid.uuid4()), json={}).status_code == 401


# --------------------------------------------------------------------- menu


def test_an_empty_menu_then_the_starter(client, me):
    assert data(client.get(f"{BASE}/menu", headers=me), "items") == []
    saved = save_menu(client, me)
    assert [(m["name"], m["price_cents"], m["ingredients"]) for m in saved] == [(m["name"], m["price_cents"], m["ingredients"]) for m in KOTA_MENU]
    assert all(uuid.UUID(m["id"]) for m in saved)
    assert data(client.get(f"{BASE}/menu", headers=me), "items") == saved


def test_the_whole_menu_is_saved_as_it_should_be(app, client, me, menu):
    items = by_name(menu)
    changed = [
        {**items["Russian kota"], "price_cents": 5000},
        {**items["Cold drink"], "name": "Cold drink 500ml"},
        {"name": "Vetkoek and mince", "price_cents": 2000, "ingredients": ["vetkoek", "mince", "mince"]},
    ]
    saved = save_menu(client, me, changed)
    assert [(m["name"], m["price_cents"]) for m in saved] == [("Russian kota", 5000), ("Cold drink 500ml", 1200), ("Vetkoek and mince", 2000)]
    assert saved[0]["id"] == items["Russian kota"]["id"] and saved[1]["id"] == items["Cold drink"]["id"]
    assert saved[2]["ingredients"] == ["vetkoek", "mince"]
    with app.app_context():
        # Left out = hidden, never deleted; a new price is a new row, the old one stays.
        hidden = db.session.get(OrderBookItem, uuid.UUID(items["Chips large"]["id"]))
        assert hidden.active is False and hidden.hidden_at is not None
        prices = OrderBookItemPrice.query.filter_by(item_id=uuid.UUID(items["Russian kota"]["id"])).order_by(OrderBookItemPrice.valid_from).all()
        assert [p.price_cents for p in prices] == [4500, 5000]


def test_an_item_put_back_on_the_menu_comes_back(client, me, menu):
    items = by_name(menu)
    save_menu(client, me, [items["Cold drink"]])
    back = save_menu(client, me, [items["Cold drink"], items["Chips large"]])
    assert [m["id"] for m in back] == [items["Cold drink"]["id"], items["Chips large"]["id"]]


@pytest.mark.parametrize(
    "items,message",
    [
        ([{"name": "Cold drink", "price_cents": 1200}, {"name": "  COLD   drink ", "price_cents": 1500}], "on the menu twice"),
        ([{"name": f"Item {i}", "price_cents": 100} for i in range(41)], "Up to 40 items."),
        ([{"name": "Kota", "price_cents": 0}], "price"),
        ([{"name": "Kota", "price_cents": 200_001}], "price"),
        ([{"name": "Kota", "price_cents": "3500"}], ""),
        ([{"name": "Kota", "price_cents": True}], "price"),
        ([{"name": "Kota", "price_cents": 35.5}], ""),
        ([{"name": "123", "price_cents": 3500}], "letter"),
        ([{"name": "K" * 41, "price_cents": 3500}], "40"),
        ([{"name": "Kota", "price_cents": 3500, "ingredients": ["caviar"]}], "Pick from the list."),
        ([{"name": "Kota", "price_cents": 3500, "colour": "red"}], ""),
    ],
)
def test_a_menu_that_breaks_the_rules_is_refused(client, me, items, message):
    body = error(client.put(f"{BASE}/menu", headers=me, json={"items": items}), 422)
    assert message in body["message"]


def test_the_same_item_twice_is_refused(client, me, menu):
    item = menu[0]
    error(client.put(f"{BASE}/menu", headers=me, json={"items": [item, {**item, "name": "Another name"}]}), 422)


# ------------------------------------------------------------------- orders


def test_an_order_is_numbered_and_priced_by_the_server(client, me, menu):
    order = place(client, me, menu, ("Russian kota", 2), ("Cold drink", 1), customer_name="  Thabo ", payment="digital", temp_number="B7")
    assert order["number"] == 1 and order["temp_number"] == "B7" and order["status"] == "new"
    assert order["lines"] == [
        {"item_id": by_name(menu)["Russian kota"]["id"], "name": "Russian kota", "price_cents": 4500, "qty": 2},
        {"item_id": by_name(menu)["Cold drink"]["id"], "name": "Cold drink", "price_cents": 1200, "qty": 1},
    ]
    assert order["total_cents"] == 10_200 and order["payment"] == "digital" and order["customer_name"] == "Thabo"
    second = place(client, me, menu, ("Chips large", 1))
    assert second["number"] == 2
    assert [o["number"] for o in orders_on(client, me, order["day"])] == [1, 2]


def test_a_retry_lands_once_with_the_same_number(client, me, menu):
    body = order_body(menu, ("Russian kota", 1))
    first = client.post(f"{BASE}/orders", headers=me, json=body)
    assert first.status_code == 201
    again = client.post(f"{BASE}/orders", headers=me, json={**body, "lines": [{"item_id": menu[0]["id"], "qty": 9}]})
    assert again.status_code == 200 and again.get_json()["data"]["order"] == first.get_json()["data"]["order"]
    assert len(orders_on(client, me, body["day"])) == 1


def test_the_phone_never_sets_a_price(client, me, menu):
    body = order_body(menu)
    body["lines"][0]["price_cents"] = 1
    error(client.post(f"{BASE}/orders", headers=me, json=body), 422)
    error(client.post(f"{BASE}/orders", headers=me, json={**order_body(menu), "total_cents": 1}), 422)


def test_an_offline_order_keeps_the_price_it_was_taken_at(app, client, me, menu):
    kota = by_name(menu)["Russian kota"]
    with app.app_context():
        # The menu was saved an hour ago...
        for p in OrderBookItemPrice.query.filter_by(item_id=uuid.UUID(kota["id"])):
            p.valid_from = datetime.now(timezone.utc) - timedelta(hours=1)
        db.session.commit()
    # ...the price went up just now, from the other phone...
    save_menu(client, me, [{**kota, "price_cents": 5500}] + [m for m in menu if m["id"] != kota["id"]])
    # ...and this phone took an order 30 minutes ago, offline, at the old price.
    old = place(client, me, menu, ("Russian kota", 1), taken=minutes_ago(30))
    new = place(client, me, menu, ("Russian kota", 1))
    assert old["lines"][0]["price_cents"] == 4500 and new["lines"][0]["price_cents"] == 5500


def test_an_item_taken_off_the_menu_is_accepted_for_two_days(app, client, me, menu):
    chips = by_name(menu)["Chips large"]
    save_menu(client, me, [m for m in menu if m["id"] != chips["id"]])
    assert place(client, me, menu, ("Chips large", 1), taken=minutes_ago(10))["lines"][0]["name"] == "Chips large"
    with app.app_context():
        db.session.get(OrderBookItem, uuid.UUID(chips["id"])).hidden_at = datetime.now(timezone.utc) - timedelta(days=3)
        db.session.commit()
    r = client.post(f"{BASE}/orders", headers=me, json=order_body(menu, ("Chips large", 1)))
    assert error(r, 422)["message"] == "That item isn't on the menu any more."


@pytest.mark.parametrize(
    "when,day_shift,message",
    [
        (timedelta(minutes=10), 0, "clock is ahead"),
        (timedelta(days=-3), 0, "older than 2 days"),
        (timedelta(minutes=-1), 1, "doesn't match"),
    ],
)
def test_when_it_was_taken_is_checked_not_trusted(client, me, menu, when, day_shift, message):
    taken = datetime.now(timezone.utc) + when
    body = order_body(menu, taken=taken)
    body["day"] = (taken.astimezone(SA).date() + timedelta(days=day_shift)).isoformat()
    assert message in error(client.post(f"{BASE}/orders", headers=me, json=body), 422)["message"]


def test_a_time_without_a_time_zone_is_refused(client, me, menu):
    body = order_body(menu)
    body["created_at"] = body["created_at"].replace("Z", "")
    error(client.post(f"{BASE}/orders", headers=me, json=body), 422)


def test_orders_from_yesterday_offline_get_yesterdays_numbers(client, me, menu):
    yesterday_evening = datetime.now(SA).replace(hour=19, minute=0, second=0, microsecond=0) - timedelta(days=1)
    today_order = place(client, me, menu)
    late = place(client, me, menu, taken=yesterday_evening)
    assert late["number"] == 1 and today_order["number"] == 1 and late["day"] != today_order["day"]


def test_two_phones_at_the_same_moment_get_different_numbers(app, client, me, menu):
    start = threading.Barrier(4)
    numbers: list[int] = []

    def take_order():
        with app.app_context():
            c = app.test_client()
            start.wait()
            r = c.post(f"{BASE}/orders", headers=me, json=order_body(menu))
            numbers.append(r.get_json()["data"]["order"]["number"] if r.status_code == 201 else r.status_code)

    threads = [threading.Thread(target=take_order) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(numbers) == [1, 2, 3, 4]


def test_the_same_retry_from_two_threads_lands_once(app, client, me, menu):
    body = order_body(menu)
    start = threading.Barrier(3)
    got: list[tuple[int, int]] = []

    def send():
        with app.app_context():
            c = app.test_client()
            start.wait()
            r = c.post(f"{BASE}/orders", headers=me, json=body)
            got.append((r.status_code, r.get_json()["data"]["order"]["number"]))

    threads = [threading.Thread(target=send) for _ in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(code for code, _ in got) == [200, 200, 201] and {n for _, n in got} == {1}
    # The number a losing retry took was given back: the next order is #2.
    assert place(client, me, menu)["number"] == 2


# -------------------------------------------------------------------- queue


def test_the_queue_moves_one_step_at_a_time(client, me, menu):
    o = place(client, me, menu)
    for status in ("preparing", "ready", "collected"):
        moved = data(step(client, me, o["id"], status), "order")
        assert moved["status"] == status
    assert error(step(client, me, o["id"], "cancelled"), 409)["code"] == "WRONG_STEP"


@pytest.mark.parametrize("to", ["ready", "collected"])
def test_no_skipping_steps(client, me, menu, to):
    o = place(client, me, menu)
    assert error(step(client, me, o["id"], to), 409)["message"] == "This order is already new."


def test_no_going_back_and_the_same_step_again_is_a_retry(client, me, menu):
    o = place(client, me, menu)
    first = data(step(client, me, o["id"], "preparing"), "order")
    assert data(step(client, me, o["id"], "preparing", at=minutes_ago(-1)), "order") == first
    data(step(client, me, o["id"], "ready"))
    error(step(client, me, o["id"], "preparing"), 409)
    error(client.patch(f"{BASE}/orders/{o['id']}", headers=me, json={"status": "new", "at": first["status_at"]}), 422)


def test_cancel_before_it_is_collected(client, me, menu):
    o = place(client, me, menu)
    data(step(client, me, o["id"], "preparing"))
    assert data(step(client, me, o["id"], "cancelled"), "order")["status"] == "cancelled"
    error(step(client, me, o["id"], "ready"), 409)


def test_a_step_keeps_the_phones_time_but_never_before_the_order(client, me, menu):
    o = place(client, me, menu, taken=minutes_ago(20))
    moved = data(step(client, me, o["id"], "preparing", at=minutes_ago(15)), "order")
    assert abs(datetime.fromisoformat(moved["status_at"]) - minutes_ago(15)).total_seconds() < 5
    moved = data(step(client, me, o["id"], "ready", at=minutes_ago(60)), "order")
    assert moved["status_at"] == moved["created_at"]
    error(step(client, me, o["id"], "collected", at=minutes_ago(-10)), 422)


def test_an_unknown_order_is_a_404(client, me):
    assert step(client, me, str(uuid.uuid4()), "preparing").status_code == 404
    assert client.patch(f"{BASE}/orders/not-a-key", headers=me, json={"status": "ready", "at": "2026-09-26T10:00:00Z"}).status_code == 404


# --------------------------------------------------------------------- week


def test_the_week_in_numbers(app, client, me, menu):
    now = datetime.now(SA)
    today = now.date()
    noon_yesterday = (now - timedelta(days=1)).replace(hour=12, minute=10, second=0, microsecond=0)
    place(client, me, menu, ("Russian kota", 2), taken=noon_yesterday, payment="cash")
    place(client, me, menu, ("Cold drink", 3), ("Russian kota", 1), taken=noon_yesterday + timedelta(minutes=5), payment="digital")
    place(client, me, menu, ("Chips large", 1), taken=noon_yesterday + timedelta(minutes=40), payment="later")
    gone = place(client, me, menu, ("Chips large", 4), taken=noon_yesterday + timedelta(minutes=45))
    data(step(client, me, gone["id"], "cancelled"))

    days = data(client.get(f"{BASE}/week", headers=me, query_string={"end": today.isoformat()}), "days")
    assert [d["day"] for d in days] == [(today - timedelta(days=6 - i)).isoformat() for i in range(7)]
    y = days[5]
    assert y["orders"] == 3 and y["cash_cents"] == 9000 and y["digital_cents"] == 3600 + 4500 and y["later_cents"] == 2500
    assert y["best_sellers"] == [{"name": "Cold drink", "qty": 3}, {"name": "Russian kota", "qty": 3}, {"name": "Chips large", "qty": 1}]
    assert y["by_hour"][12] == 3 and sum(y["by_hour"]) == 3
    assert all(d["orders"] == 0 for d in days[:5])


@pytest.mark.parametrize("query", [{}, {"end": "yesterday"}, {"end": "2026-13-01"}, {"end": "2026-09-26", "days": "30"}])
def test_the_week_needs_a_real_end_day(client, me, query):
    error(client.get(f"{BASE}/week", headers=me, query_string=query), 422)


# -------------------------------------------------------------------- audit


def test_the_audit_trail_has_ids_but_no_names_or_amounts(app, client, me):
    since = datetime.now(timezone.utc)
    menu = save_menu(client, me)
    o = place(client, me, menu, ("Russian kota", 2), customer_name="Thabo")
    data(step(client, me, o["id"], "preparing"))
    data(step(client, me, o["id"], "cancelled"))
    with app.app_context():
        rows = AuditEventRecord.query.filter(AuditEventRecord.event_name.like("order_book.%"), AuditEventRecord.timestamp >= since).all()
        events = sorted(r.event_name for r in rows)
        dumped = json.dumps([r.event_metadata for r in rows]).lower()
        order_id = str(OrderBookOrder.query.filter_by(client_key=uuid.UUID(o["id"])).one().id)
    assert events == ["order_book.menu_saved", "order_book.order_cancelled", "order_book.order_created"]
    assert order_id in dumped and '"items": 4' in dumped
    for secret in ["thabo", "russian", "9000", "4500"]:
        assert secret not in dumped, secret
