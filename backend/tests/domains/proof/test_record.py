"""
My record: GET /me/record/summary?month=YYYY-MM (plan v2 03). One month of
the trader's money in three blocks that are never added together -- orders
kept apart by what backs them, the credit book, jobs -- only theirs, only
that month, strict month rules, no total anywhere.
"""
from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from src.domains.commerce.orders.models import Order
from src.domains.identity.accounts.models.user import User
from src.domains.informal_trader.jobs.models import Job
from src.domains.supplier.catalogue.models import Product
from src.domains.supplier.integration.services.feed_loader import load_directory
from src.domains.supplier.supplier_profile.models import Supplier
from src.extensions import db
from src.shared.rate_limit.limiter import limiter

SA = ZoneInfo("Africa/Johannesburg")
SEED = Path(__file__).resolve().parents[3] / "seed" / "suppliers"
PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
API = "/api/v1"
URL = f"{API}/me/record/summary"
PROFILE = {
    "business": {"business_name": "Nomsa's Spaza", "business_type": "spaza", "trade": None, "owner_name": "Nomsa Dlamini", "years_trading": "3_plus", "cellphone": "082 123 4567"},
    "location": {"building": "", "street": "Andrew Mapheto Drive", "suburb": "Tembisa", "city": "Ekurhuleni", "province": "Gauteng", "postal_code": "1632", "latitude": -25.9964, "longitude": 28.2268},
    "buying": {"categories": ["food_grocery", "beverages"], "restock": "weekly", "spend": "1k_5k", "payment": "both", "fulfilment": "delivery"},
    "tools": {"creditBook": True, "orderStock": True, "myRecord": True, "jobs": True, "orderBook": False},
}


def this_month() -> date:
    return datetime.now(SA).date().replace(day=1)


def last_month() -> date:
    return (this_month() - timedelta(days=1)).replace(day=1)


def label(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


class Trader:
    def __init__(self, headers, user_id):
        self.headers, self.id = headers, user_id


def trader(client, outbox, email) -> Trader:
    client.post(f"{API}/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post(f"{API}/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    assert client.patch(f"{API}/me/business-profile", headers=h, json=PROFILE).status_code == 200
    me = client.get(f"{API}/me", headers=h).get_json()["data"]
    return Trader(h, (me.get("user") or me)["id"])


def joined_months_ago(app, who: Trader, months: int = 3) -> None:
    """An older account, so earlier months may be shown."""
    with app.app_context():
        db.session.get(User, uuid.UUID(who.id)).created_at = datetime.now(timezone.utc) - timedelta(days=31 * months)
        db.session.commit()


@pytest.fixture
def supplier(app):
    with app.app_context():
        load_directory(SEED / "mahlangu-wholesale", source="seed", verified=True)
        s = Supplier.query.one()
        p = next(p for p in Product.query.filter_by(supplier_id=s.id).order_by(Product.price_cents) if p.stock_qty >= 200 and p.max_qty >= 50)
        return {"id": str(s.id), "product": str(p.id), "qty": -(-s.minimum_order_cents // p.price_cents)}


@pytest.fixture
def me(app, client, outbox):
    t = trader(client, outbox, "nomsa@example.com")
    joined_months_ago(app, t)
    return t


def order(app, client, who, supplier, *, payment="cash", payment_status=None, status=None, placed=None) -> int:
    client.put(f"{API}/me/suppliers/{supplier['id']}", headers=who.headers)
    r = client.post(f"{API}/me/orders", headers=who.headers, json={"supplier_id": supplier["id"], "lines": [{"product_id": supplier["product"], "qty": supplier["qty"]}], "fulfilment": "delivery", "payment": payment})
    assert r.status_code == 201, r.get_json()
    o = r.get_json()["data"]["order"]
    with app.app_context():
        row = db.session.get(Order, uuid.UUID(o["id"]))
        if payment_status:
            row.payment_status = payment_status
        if status:
            row.status = status
        if placed:
            row.placed_at = placed
        db.session.commit()
    return o["total_cents"]


def record(client, who, month=None) -> dict:
    r = client.get(URL, headers=who.headers, query_string={"month": month} if month else {})
    assert r.status_code == 200, r.get_json()
    return r.get_json()["data"]["record"]


def keys(value) -> set[str]:
    if isinstance(value, dict):
        return set(value) | set().union(*(keys(v) for v in value.values()))
    return set()


# ------------------------------------------------------------------ access


def test_needs_a_signed_in_trader(client):
    assert client.get(URL).status_code == 401


def test_an_empty_month_is_three_empty_blocks_and_no_total(client, me):
    r = record(client, me)
    assert r["month"] == label(this_month())
    assert r["orders"] == {k: {"cents": 0, "orders": 0} for k in ("provider_verified", "confirmed_by_both", "not_confirmed")}
    assert r["credit_book"] == {"given_cents": 0, "paid_back_cents": 0}
    assert r["jobs"] == {"confirmed_cents": 0, "confirmed_stages": 0, "amounts_dont_match": 0}
    assert not any("total" in k for k in keys(r))


# ------------------------------------------------------------------ orders


def test_order_money_is_kept_apart_by_what_backs_it(app, client, me, supplier):
    paid = order(app, client, me, supplier, payment="in_app", payment_status="paid", status="accepted")
    both = order(app, client, me, supplier, payment_status="confirmed_by_both", status="delivered")
    cash = order(app, client, me, supplier)
    order(app, client, me, supplier, status="cancelled")
    order(app, client, me, supplier, status="rejected")
    order(app, client, me, supplier, payment="in_app")  # waiting for payment: proves nothing
    orders = record(client, me)["orders"]
    assert orders == {
        "provider_verified": {"cents": paid, "orders": 1},
        "confirmed_by_both": {"cents": both, "orders": 1},
        "not_confirmed": {"cents": cash, "orders": 1},
    }


def test_orders_count_in_the_month_they_were_placed(app, client, me, supplier):
    before = datetime(last_month().year, last_month().month, 15, 12, tzinfo=SA)
    old = order(app, client, me, supplier, placed=before)
    new = order(app, client, me, supplier)
    assert record(client, me)["orders"]["not_confirmed"] == {"cents": new, "orders": 1}
    assert record(client, me, label(last_month()))["orders"]["not_confirmed"] == {"cents": old, "orders": 1}


def test_the_month_turns_at_midnight_in_south_africa(app, client, me, supplier):
    midnight = datetime(this_month().year, this_month().month, 1, tzinfo=SA)  # 22:00 UTC the day before
    after = order(app, client, me, supplier, placed=midnight + timedelta(minutes=30))
    before = order(app, client, me, supplier, placed=midnight - timedelta(minutes=30))
    assert record(client, me)["orders"]["not_confirmed"] == {"cents": after, "orders": 1}
    assert record(client, me, label(last_month()))["orders"]["not_confirmed"] == {"cents": before, "orders": 1}


# ------------------------------------------------------ credit book, jobs


def test_credit_given_and_paid_back_by_their_own_days(client, me):
    today = datetime.now(SA).date()
    early = last_month() + timedelta(days=5)

    def sale(cents, given):
        body = {"customer": {"name": "Thandi Mokoena"}, "amount_cents": cents, "description": "", "given_on": given.isoformat(), "due_on": (today + timedelta(days=7)).isoformat()}
        r = client.post(f"{API}/me/credit-book/entries", headers=me.headers, json=body)
        assert r.status_code == 201, r.get_json()
        return r.get_json()["data"]["entry"]["id"]

    old = sale(10_000, early)
    sale(4_800, today)
    client.post(f"{API}/me/credit-book/entries/{old}/payments", headers=me.headers, json={"amount_cents": 3_000, "paid_on": today.isoformat()})
    binned = sale(9_900, today)
    client.delete(f"{API}/me/credit-book/entries/{binned}", headers=me.headers)
    assert record(client, me)["credit_book"] == {"given_cents": 4_800, "paid_back_cents": 3_000}
    assert record(client, me, label(last_month()))["credit_book"] == {"given_cents": 10_000, "paid_back_cents": 0}


def test_jobs_count_stages_the_client_confirmed_that_month(app, client, me):
    job = {"title": "Room extension", "client_name": "Mokoena family", "client_phone": "082 123 4567", "total_cents": 3_000_000,
           "stages": [{"name": "Walls", "amount_cents": 1_800_000}, {"name": "Roof", "amount_cents": 1_200_000}]}  # fmt: skip
    j = client.post(f"{API}/me/jobs", headers=me.headers, json=job).get_json()["data"]["job"]
    walls, roof = (s["id"] for s in j["stages"])
    link = client.post(f"{API}/me/jobs/{j['id']}/stages/{walls}/sign-off", headers=me.headers, json={"builder_amount_cents": 1_800_000}).get_json()["data"]["link"]
    client.post("/sign-off", data={"ticket": link.split("ticket=")[1], "answer": "done", "amount": "18000"})
    link = client.post(f"{API}/me/jobs/{j['id']}/stages/{roof}/sign-off", headers=me.headers, json={"builder_amount_cents": 1_200_000}).get_json()["data"]["link"]
    client.post("/sign-off", data={"ticket": link.split("ticket=")[1], "answer": "done", "amount": "9000"})  # doesn't match
    assert record(client, me)["jobs"] == {"confirmed_cents": 1_800_000, "confirmed_stages": 1, "amounts_dont_match": 1}
    with app.app_context():
        stage = next(s for s in db.session.get(Job, uuid.UUID(j["id"])).stages if s.name == "Walls")
        stage.confirmed_at = datetime(last_month().year, last_month().month, 20, tzinfo=SA)
        db.session.commit()
    assert record(client, me)["jobs"]["confirmed_stages"] == 0
    assert record(client, me, label(last_month()))["jobs"] == {"confirmed_cents": 1_800_000, "confirmed_stages": 1, "amounts_dont_match": 0}


def test_a_tool_switched_off_is_null(client, me):
    client.patch(f"{API}/me/business-profile", headers=me.headers, json={"tools": {**PROFILE["tools"], "creditBook": False, "jobs": False}})
    r = record(client, me)
    assert r["credit_book"] is None and r["jobs"] is None and r["orders"]["not_confirmed"]["orders"] == 0


# -------------------------------------------------------------------- IDOR


def test_only_my_own_money(app, client, outbox, me, supplier):
    other = trader(client, outbox, "sipho@example.com")
    order(app, client, other, supplier, payment="in_app", payment_status="paid", status="accepted")
    body = {"customer": {"name": "Lerato"}, "amount_cents": 5_000, "description": "", "due_on": (datetime.now(SA).date() + timedelta(days=3)).isoformat()}
    client.post(f"{API}/me/credit-book/entries", headers=other.headers, json=body)
    r = record(client, me)
    assert r["orders"]["provider_verified"] == {"cents": 0, "orders": 0} and r["credit_book"]["given_cents"] == 0


# -------------------------------------------------------------- month rules


@pytest.mark.parametrize("month", ["2026-13", "2026-9", "2026-00", "../", "26-09", "2026-09-01", "", "9999-01", "0000-01", "２０２６-０９"])
def test_odd_months_are_refused(client, me, month):
    assert client.get(URL, headers=me.headers, query_string={"month": month}).status_code == 422


def test_the_months_it_may_show(app, client, outbox):
    new = trader(client, outbox, "new@example.com")
    assert client.get(URL, headers=new.headers, query_string={"month": label(last_month())}).status_code == 422  # before joining
    nxt = (this_month() + timedelta(days=32)).replace(day=1)
    assert client.get(URL, headers=new.headers, query_string={"month": label(nxt)}).status_code == 422  # the future
    r = record(client, new)
    assert r["first_month"] == r["month"] == label(this_month())


def test_one_month_field_only(client, me):
    assert client.get(f"{URL}?month={label(this_month())}&month={label(last_month())}", headers=me.headers).status_code == 422
    assert client.get(URL, headers=me.headers, query_string={"user_id": str(uuid.uuid4())}).status_code == 422


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


def test_limited_per_user(client, outbox, me, limits_on):
    codes = [client.get(URL, headers=me.headers).status_code for _ in range(31)]
    assert codes[:30] == [200] * 30 and codes[30] == 429
