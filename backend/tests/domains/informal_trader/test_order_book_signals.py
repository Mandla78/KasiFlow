"""
order_book_service.demand_signals(user): what a food seller's counter says
they'll need to restock, for the supplier engine. Aggregates of the
trader's own last 7 days only.
"""
from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from order_book_helpers import data, place, save_menu, signed_in, step
from src.domains.identity.accounts.services import account_service
from src.domains.informal_trader.order_book.models import OrderBookOrder
from src.domains.informal_trader.order_book.services import order_book_service
from src.extensions import db


@pytest.fixture
def me(client, outbox):
    return signed_in(client, outbox)


@pytest.fixture
def menu(client, me):
    return save_menu(client, me)


def signals_of(app, client, headers) -> dict:
    user_id = data(client.get("/api/v1/me", headers=headers))
    user_id = (user_id.get("user") or user_id)["id"]
    with app.app_context():
        return order_book_service.demand_signals(account_service.get(uuid.UUID(user_id)))


def test_no_orders_no_signals(app, client, me, menu):
    s = signals_of(app, client, me)
    assert s["categories"] == {} and s["weekly_units"] == {}
    assert date.fromisoformat(s["since"]) == (datetime.now(timezone.utc) - timedelta(days=7)).date()


def test_a_kota_shops_week(app, client, me, menu):
    place(client, me, menu, ("Russian kota", 2), ("Cold drink", 2))
    place(client, me, menu, ("Chips large", 1))
    s = signals_of(app, client, me)
    # Russian kota: quarter_loaf, chips, russian, polony, cheese, atchar.
    assert s["weekly_units"] == {"chips": 3, "atchar": 2, "cheese": 2, "cold_drink": 2, "polony": 2, "quarter_loaf": 2, "russian": 2}
    cats = s["categories"]
    assert list(cats.values()) == sorted(cats.values(), reverse=True)
    assert set(cats) == {"meat_frozen", "bakery", "dairy_chilled", "food_grocery", "fresh_produce", "beverages", "packaging_disposable"}
    assert abs(sum(cats.values()) - 1) <= 0.05
    # Chips split between frozen and fresh (3 units -> 1.5 + 1.5); meat = 1.5 + russian 2 + polony 2 = 5.5.
    # Of 17: bakery 2, meat 5.5, fresh 1.5, dairy 2, grocery 2, drinks 2, packaging 2 (one per order).
    assert list(cats)[0] == "meat_frozen" and cats["meat_frozen"] == round(5.5 / 17, 2) and cats["packaging_disposable"] == round(2 / 17, 2)


def test_cancelled_and_old_orders_dont_count(app, client, me, menu):
    gone = place(client, me, menu, ("Cold drink", 5))
    data(step(client, me, gone["id"], "cancelled"))
    old = place(client, me, menu, ("Chips large", 4))
    with app.app_context():
        OrderBookOrder.query.filter_by(client_key=uuid.UUID(old["id"])).one().taken_at = datetime.now(timezone.utc) - timedelta(days=8)
        db.session.commit()
    assert signals_of(app, client, me)["weekly_units"] == {}


def test_only_my_own_counter(app, client, outbox, me, menu):
    other = signed_in(client, outbox, email="sipho@example.com")
    their_menu = save_menu(client, other, [{"name": "Pap and wors", "price_cents": 5000, "ingredients": ["pap", "wors"]}])
    place(client, other, their_menu, ("Pap and wors", 9))
    place(client, me, menu, ("Cold drink", 1))
    assert signals_of(app, client, me)["weekly_units"] == {"cold_drink": 1}


def test_no_names_orders_or_money(app, client, me, menu):
    place(client, me, menu, ("Russian kota", 1), customer_name="Thabo")
    dumped = json.dumps(signals_of(app, client, me)).lower()
    for secret in ["thabo", "russian kota", "4500", "45.00", "number"]:
        assert secret not in dumped, secret
