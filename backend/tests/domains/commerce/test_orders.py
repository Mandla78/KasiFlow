"""
Orders: placed by a trader, priced by the server, with the policies in
docs/supplier/12_POLICIES.txt (cash rules, cancelling, unpaid orders
lapsing, stock held and given back, a retry never ordering twice).
"""
from __future__ import annotations

import re
import uuid
from datetime import timedelta
from pathlib import Path

import pytest

from src.core.base_model import utcnow
from src.core.exceptions import ConflictError
from src.domains.commerce.orders.models import Order
from src.domains.commerce.orders.services import order_service
from src.domains.supplier.catalogue.models import Product
from src.domains.supplier.integration.services.feed_loader import load_directory
from src.domains.supplier.supplier_profile.models import Supplier
from src.extensions import db

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
SEED = Path(__file__).resolve().parents[3] / "seed" / "suppliers"
PROFILE = {
    "business": {"business_name": "Nomsa's Spaza", "business_type": "spaza", "trade": None, "owner_name": "Nomsa Dlamini", "years_trading": "3_plus", "cellphone": "082 123 4567"},
    "location": {"building": "", "street": "Andrew Mapheto Drive", "suburb": "Tembisa", "city": "Ekurhuleni", "province": "Gauteng", "postal_code": "1632", "latitude": -25.9964, "longitude": 28.2268},
    "buying": {"categories": ["food_grocery", "beverages"], "restock": "weekly", "spend": "1k_5k", "payment": "both", "fulfilment": "delivery"},
}
URL = "/api/v1/me/orders"


def signed_in(client, outbox, email) -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.patch("/api/v1/me/business-profile", headers=headers, json=PROFILE).status_code == 200
    return headers


@pytest.fixture
def mahlangu(app):
    with app.app_context():
        load_directory(SEED / "mahlangu-wholesale", source="seed", verified=True)
        s = Supplier.query.one()
        # Two known products to order: a cheap in-stock one and an out-of-stock one.
        products = Product.query.filter_by(supplier_id=s.id).order_by(Product.price_cents).all()
        cheap = next(p for p in products if p.stock_qty >= 50 and p.max_qty >= 50)
        empty = next(p for p in products if p.stock_qty == 0)
        return {"id": str(s.id), "cheap": str(cheap.id), "cheap_price": cheap.price_cents, "empty": str(empty.id), "min": s.minimum_order_cents, "fee": s.delivery_fee_cents}


@pytest.fixture
def me(client, outbox, mahlangu):
    headers = signed_in(client, outbox, "nomsa@example.com")
    assert client.put(f"/api/v1/me/suppliers/{mahlangu['id']}", headers=headers).status_code == 200
    return headers


def qty_for(m, cents: int) -> int:
    """Enough of the cheap product to reach `cents`."""
    return -(-cents // m["cheap_price"])


def body(m, qty, *, payment="cash", fulfilment="delivery", **extra):
    return {"supplier_id": m["id"], "lines": [{"product_id": m["cheap"], "qty": qty}], "fulfilment": fulfilment, "payment": payment, **extra}


def place(client, me, b, key=None):
    headers = {**me, **({"Idempotency-Key": key} if key else {})}
    return client.post(URL, headers=headers, json=b)


def stock(app, product_id) -> int:
    with app.app_context():
        return db.session.get(Product, uuid.UUID(product_id)).stock_qty


# ------------------------------------------------------------------ placing


def test_needs_a_signed_in_trader(client):
    assert client.post(URL, json={}).status_code == 401
    assert client.get(URL).status_code == 401


def test_only_a_connected_supplier_can_be_ordered_from(client, outbox, mahlangu):
    stranger = signed_in(client, outbox, "thabo@example.com")
    r = place(client, stranger, body(mahlangu, qty_for(mahlangu, mahlangu["min"])))
    assert r.status_code == 409 and r.get_json()["code"] == "NOT_CONNECTED"


def test_a_cash_delivery_order_priced_by_the_server(app, client, me, mahlangu):
    qty = qty_for(mahlangu, mahlangu["min"])
    before = stock(app, mahlangu["cheap"])
    r = place(client, me, body(mahlangu, qty))
    assert r.status_code == 201, r.get_json()
    o = r.get_json()["data"]["order"]
    assert re.fullmatch(r"AKZ-\d{4}-\d{6}", o["reference"])
    assert o["status"] == "placed" and o["payment_status"] == "cash_due"
    assert o["subtotal_cents"] == qty * mahlangu["cheap_price"]
    assert o["delivery_fee_cents"] == mahlangu["fee"]
    assert o["total_cents"] == o["subtotal_cents"] + o["delivery_fee_cents"]
    assert "Andrew Mapheto Drive" in o["address"]
    assert [e["status"] for e in o["events"]] == ["placed"]
    assert stock(app, mahlangu["cheap"]) == before - qty  # held


def test_the_phone_cannot_send_prices(client, me, mahlangu):
    b = body(mahlangu, 10)
    b["lines"][0]["price_cents"] = 1
    assert place(client, me, b).status_code == 422
    assert place(client, me, {**body(mahlangu, 10), "total_cents": 100}).status_code == 422


@pytest.mark.parametrize(
    "bad",
    [
        {"lines": []},
        {"lines": [{"product_id": "not-a-uuid", "qty": 1}]},
        {"lines": [{"product_id": str(uuid.uuid4()), "qty": 0}]},
        {"payment": "bitcoin"},
        {"fulfilment": "teleport"},
        {"fulfilment": "collect", "delivery_address": "12 Somewhere Street, Tembisa", "delivery_point": {"latitude": -26.0, "longitude": 28.2}},
        {"delivery_address": "12 Somewhere Street, Tembisa"},  # address without its pin
    ],
)
def test_bad_order_bodies_are_refused(client, me, mahlangu, bad):
    assert place(client, me, {**body(mahlangu, 10), **bad}).status_code == 422


def test_the_same_product_twice_is_refused(client, me, mahlangu):
    b = body(mahlangu, 5)
    b["lines"].append({"product_id": mahlangu["cheap"], "qty": 5})
    assert place(client, me, b).status_code == 422


def test_below_the_minimum(client, me, mahlangu):
    r = place(client, me, body(mahlangu, 1))
    assert r.status_code == 409 and r.get_json()["code"] == "BELOW_MINIMUM"


def test_out_of_stock_holds_nothing(app, client, me, mahlangu):
    before = stock(app, mahlangu["cheap"])
    b = body(mahlangu, qty_for(mahlangu, mahlangu["min"]))
    b["lines"].append({"product_id": mahlangu["empty"], "qty": 1})
    r = place(client, me, b)
    assert r.status_code == 409 and r.get_json()["code"] == "OUT_OF_STOCK"
    assert stock(app, mahlangu["cheap"]) == before  # the first line's hold was rolled back


def test_delivery_outside_the_supplier_area(client, me, mahlangu):
    far = body(mahlangu, qty_for(mahlangu, mahlangu["min"]), delivery_address="Stand 12, Mankweng, Polokwane", delivery_point={"latitude": -23.88, "longitude": 29.73})
    r = place(client, me, far)
    assert r.status_code == 409 and r.get_json()["code"] == "OUTSIDE_DELIVERY_AREA"
    assert place(client, me, body(mahlangu, qty_for(mahlangu, mahlangu["min"]), fulfilment="collect")).status_code == 201


# ------------------------------------------------------------------ cash rules


def test_cash_is_up_to_r1000(client, me, mahlangu):
    r = place(client, me, body(mahlangu, qty_for(mahlangu, 100_001)))
    assert r.status_code == 409 and r.get_json()["code"] == "CASH_LIMIT"
    assert place(client, me, body(mahlangu, qty_for(mahlangu, 100_001), payment="in_app")).status_code == 201


def test_at_most_two_cash_orders_waiting(client, me, mahlangu):
    qty = qty_for(mahlangu, mahlangu["min"])
    assert place(client, me, body(mahlangu, qty)).status_code == 201
    assert place(client, me, body(mahlangu, qty)).status_code == 201
    r = place(client, me, body(mahlangu, qty))
    assert r.status_code == 409 and r.get_json()["code"] == "CASH_LIMIT"


# ------------------------------------------------------------------ cancelling


def test_a_cash_order_can_be_cancelled_until_accepted(app, client, me, mahlangu):
    qty = qty_for(mahlangu, mahlangu["min"])
    before = stock(app, mahlangu["cheap"])
    first = place(client, me, body(mahlangu, qty)).get_json()["data"]["order"]
    r = client.post(f"{URL}/{first['id']}/cancel", headers=me)
    assert r.status_code == 200 and r.get_json()["data"]["order"]["status"] == "cancelled"
    assert stock(app, mahlangu["cheap"]) == before  # given back

    second = place(client, me, body(mahlangu, qty)).get_json()["data"]["order"]
    with app.app_context():
        order_service.supplier_move(uuid.UUID(second["id"]), "accepted")
    r = client.post(f"{URL}/{second['id']}/cancel", headers=me)
    assert r.status_code == 409 and r.get_json()["code"] == "TOO_LATE"


def test_a_digital_order_waits_for_payment_can_not_be_cancelled_and_lapses(app, client, me, mahlangu):
    qty = qty_for(mahlangu, mahlangu["min"])
    before = stock(app, mahlangu["cheap"])
    o = place(client, me, body(mahlangu, qty, payment="in_app")).get_json()["data"]["order"]
    assert o["status"] == "awaiting_payment" and o["payment_status"] == "unpaid" and o["pay_by"]
    r = client.post(f"{URL}/{o['id']}/cancel", headers=me)
    assert r.status_code == 409 and r.get_json()["code"] == "TOO_LATE"
    with app.app_context():
        assert order_service.expire_unpaid(utcnow() + timedelta(hours=23)) == 0
        assert order_service.expire_unpaid(utcnow() + timedelta(hours=25)) == 1
    assert client.get(f"{URL}/{o['id']}", headers=me).get_json()["data"]["order"]["status"] == "expired"
    assert stock(app, mahlangu["cheap"]) == before


# ------------------------------------------------------------------ the rest


def test_a_retried_place_order_lands_once(app, client, me, mahlangu):
    b = body(mahlangu, qty_for(mahlangu, mahlangu["min"]))
    first = place(client, me, b, key="tap-0001-abcdef")
    again = place(client, me, b, key="tap-0001-abcdef")
    assert first.status_code == again.status_code == 201
    assert first.get_json()["data"]["order"]["id"] == again.get_json()["data"]["order"]["id"]
    with app.app_context():
        assert Order.query.count() == 1
    other = place(client, me, body(mahlangu, qty_for(mahlangu, mahlangu["min"]) + 1), key="tap-0001-abcdef")
    assert other.status_code == 422 and other.get_json()["code"] == "IDEMPOTENCY_KEY_REUSED"


def test_the_supplier_side_moves_one_step_at_a_time(app, client, me, mahlangu):
    o = place(client, me, body(mahlangu, qty_for(mahlangu, mahlangu["min"]))).get_json()["data"]["order"]
    oid = uuid.UUID(o["id"])
    with app.app_context():
        with pytest.raises(ConflictError):
            order_service.supplier_move(oid, "delivered")  # can't skip steps
        for step in ("accepted", "out_for_delivery", "delivered"):
            order_service.supplier_move(oid, step)
    events = [e["status"] for e in client.get(f"{URL}/{o['id']}", headers=me).get_json()["data"]["order"]["events"]]
    assert events == ["placed", "accepted", "out_for_delivery", "delivered"]


def test_a_later_price_change_never_changes_a_placed_order(app, client, me, mahlangu):
    o = place(client, me, body(mahlangu, qty_for(mahlangu, mahlangu["min"]))).get_json()["data"]["order"]
    with app.app_context():
        db.session.get(Product, uuid.UUID(mahlangu["cheap"])).price_cents += 5000
        db.session.commit()
    again = client.get(f"{URL}/{o['id']}", headers=me).get_json()["data"]["order"]
    assert again["lines"][0]["price_cents"] == mahlangu["cheap_price"] and again["total_cents"] == o["total_cents"]


def test_orders_are_private(client, outbox, me, mahlangu):
    o = place(client, me, body(mahlangu, qty_for(mahlangu, mahlangu["min"]))).get_json()["data"]["order"]
    other = signed_in(client, outbox, "thabo@example.com")
    assert client.get(f"{URL}/{o['id']}", headers=other).status_code == 404
    assert client.post(f"{URL}/{o['id']}/cancel", headers=other).status_code == 404
    assert client.get(URL, headers=other).get_json()["data"]["orders"] == []
    assert [x["id"] for x in client.get(URL, headers=me).get_json()["data"]["orders"]] == [o["id"]]


# ------------------------------------------------------------ what backs the money


def test_what_backs_each_payment_and_totals_never_mix(app, client, me, mahlangu):
    qty = qty_for(mahlangu, mahlangu["min"])
    cash = place(client, me, body(mahlangu, qty)).get_json()["data"]["order"]
    digital = place(client, me, body(mahlangu, qty, payment="in_app")).get_json()["data"]["order"]
    assert cash["evidence"] == "not_confirmed"  # cash to pay proves nothing yet
    assert digital["evidence"] == "none"  # not paid

    with app.app_context():
        o = db.session.get(Order, uuid.UUID(digital["id"]))
        order_service.mark_paid(o, "1089250")
        db.session.commit()
    assert client.get(f"{URL}/{digital['id']}", headers=me).get_json()["data"]["order"]["evidence"] == "provider_verified"

    summary = client.get(f"{URL}/summary", headers=me).get_json()["data"]["summary"]
    assert summary["provider_verified_cents"] == digital["total_cents"] and summary["provider_verified_orders"] == 1
    assert summary["not_confirmed_cents"] == cash["total_cents"] and summary["confirmed_by_both_cents"] == 0

    with app.app_context():
        db.session.get(Order, uuid.UUID(cash["id"])).payment_status = "confirmed_by_both"  # the cash handshake (Phase 5)
        db.session.commit()
    summary = client.get(f"{URL}/summary", headers=me).get_json()["data"]["summary"]
    assert summary["confirmed_by_both_cents"] == cash["total_cents"] and summary["not_confirmed_cents"] == 0
    assert summary["provider_verified_cents"] == digital["total_cents"]  # still apart, never added together


def test_the_money_summary_is_private(client, outbox, me, mahlangu):
    place(client, me, body(mahlangu, qty_for(mahlangu, mahlangu["min"])))
    other = signed_in(client, outbox, "thabo@example.com")
    s = client.get(f"{URL}/summary", headers=other).get_json()["data"]["summary"]
    assert s["not_confirmed_cents"] == s["provider_verified_cents"] == s["confirmed_by_both_cents"] == 0
