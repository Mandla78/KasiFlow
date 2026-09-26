"""
Credit book: customers who owe the trader, repayments, corrections that
keep the history, and a book nobody else can read.
"""
from __future__ import annotations

import json
import re
import threading
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from src.domains.informal_trader.credit_book.services.credit_book_service import today
from src.domains.security.audit.models import AuditEventRecord
from src.shared.rate_limit.limiter import limiter

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
BASE = "/api/v1/me/credit-book"
NAME = "Thandi Mokoena"
PHONE = "082 123 4567"


def signed_in(client, outbox, email="nomsa@example.com") -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def me(client, outbox):
    return signed_in(client, outbox)


@pytest.fixture
def other(client, outbox):
    return signed_in(client, outbox, email="sipho@example.com")


def day(offset: int) -> str:
    return (today() + timedelta(days=offset)).isoformat()


def sale(client, headers, **overrides):
    body = {"customer": {"name": NAME, "phone": PHONE}, "amount_cents": 4800, "description": "Bread, milk", "due_on": day(7), **overrides}
    return client.post(f"{BASE}/entries", headers=headers, json=body)


def entry_of(r) -> dict:
    assert r.status_code in (200, 201), r.get_json()
    return r.get_json()["data"]["entry"]


def pay(client, headers, entry_id, cents, **extra):
    return client.post(f"{BASE}/entries/{entry_id}/payments", headers=headers, json={"amount_cents": cents, **extra})


def field_errors(r) -> dict:
    assert r.status_code == 422, (r.status_code, r.get_json())
    return r.get_json()["errors"][0]


# ------------------------------------------------------------------ access


ROUTES = [
    ("get", "/entries"),
    ("post", "/entries"),
    ("get", "/entries/{e}"),
    ("post", "/entries/{e}/payments"),
    ("post", "/entries/{e}/corrections"),
    ("post", "/entries/{e}/cancel"),
    ("get", "/customers"),
    ("patch", "/customers/{c}"),
    ("delete", "/customers/{c}"),
    ("get", "/summary"),
]


@pytest.mark.parametrize("method,path", ROUTES)
def test_every_route_needs_a_token(client, method, path):
    url = BASE + path.format(e=uuid.uuid4(), c=uuid.uuid4())
    assert getattr(client, method)(url, json={}).status_code == 401


def test_an_empty_book(client, me):
    assert client.get(f"{BASE}/entries", headers=me).get_json()["data"]["entries"] == []
    s = client.get(f"{BASE}/summary", headers=me).get_json()["data"]["summary"]
    assert s["customers_owe_cents"] == 0 and s["customers_owing"] == 0


# ------------------------------------------------------------ credit sales


def test_a_credit_sale_with_a_new_customer(client, me):
    e = entry_of(sale(client, me))
    assert e["amount_cents"] == 4800 and e["outstanding_cents"] == 4800 and e["paid_cents"] == 0
    assert e["status"] == "open" and e["given_on"] == day(0) and e["due_on"] == day(7)
    assert e["customer"]["name"] == NAME and e["customer"]["phone"] == "0821234567"
    assert [h["type"] for h in e["history"]] == ["given"] and e["history"][0]["amount_cents"] == 4800
    assert client.get(f"{BASE}/entries/{e['id']}", headers=me).get_json()["data"]["entry"] == e


def test_a_credit_sale_for_an_existing_customer(client, me):
    first = entry_of(sale(client, me))
    second = entry_of(sale(client, me, customer=None, customer_id=first["customer"]["id"], amount_cents=2000))
    assert second["customer"]["id"] == first["customer"]["id"]
    customers = client.get(f"{BASE}/customers", headers=me).get_json()["data"]["customers"]
    assert len(customers) == 1 and customers[0]["owes_cents"] == 6800


def test_copying_the_paper_book_allows_old_and_overdue_credit(client, me):
    e = entry_of(sale(client, me, given_on=day(-40), due_on=day(-10)))
    assert e["given_on"] == day(-40) and e["due_on"] == day(-10)
    s = client.get(f"{BASE}/summary", headers=me).get_json()["data"]["summary"]
    assert s["overdue_count"] == 1


@pytest.mark.parametrize(
    "overrides,field",
    [
        ({"given_on": day(1)}, "given_on"),  # the future
        ({"given_on": day(-367), "due_on": day(-300)}, "given_on"),  # more than a year back
        ({"due_on": day(-1)}, "due_on"),  # before the day it was given
        ({"due_on": day(367)}, "due_on"),  # more than a year ahead
    ],
)
def test_dates_are_bounded(client, me, overrides, field):
    assert field in field_errors(sale(client, me, **overrides))


@pytest.mark.parametrize("cents", [0, -1, 10_000_001, 1.5, "4800", True, None])
def test_amount_must_be_whole_cents_within_limits(client, me, cents):
    assert "amount_cents" in field_errors(sale(client, me, amount_cents=cents))


def test_the_largest_amount_is_r100000(client, me):
    assert entry_of(sale(client, me, amount_cents=10_000_000))["amount_cents"] == 10_000_000


@pytest.mark.parametrize("name", ["", "   ", "12345", "!!!", "​Thandi", "Thandi‮", "a" * 61, None, 42])
def test_customer_name_is_cleaned_and_needs_a_letter(client, me, name):
    assert "customer" in field_errors(sale(client, me, customer={"name": name}))


@pytest.mark.parametrize("name,stored", [("Mama T", "Mama T"), ("  Zoë   van  Wyk ", "Zoë van Wyk"), ("Sipho 2", "Sipho 2")])
def test_nicknames_are_fine(client, me, name, stored):
    assert entry_of(sale(client, me, customer={"name": name}))["customer"]["name"] == stored


@pytest.mark.parametrize("phone,stored", [("082 123 4567", "0821234567"), ("+27 82 123 4567", "0821234567"), ("0611234567", "0611234567"), (None, None)])
def test_cellphones_are_stored_as_ten_digits(client, me, phone, stored):
    assert entry_of(sale(client, me, customer={"name": NAME, "phone": phone}))["customer"]["phone"] == stored


@pytest.mark.parametrize("phone", ["011 123 4567", "12345", "08212345678", "phone", ""])
def test_only_cellphones(client, me, phone):
    assert "customer" in field_errors(sale(client, me, customer={"name": NAME, "phone": phone}))


def test_exactly_one_customer(client, me):
    e = entry_of(sale(client, me))
    assert "customer" in field_errors(sale(client, me, customer=None))
    assert "customer" in field_errors(sale(client, me, customer_id=e["customer"]["id"]))


def test_unknown_fields_are_refused(client, me):
    assert "status" in field_errors(sale(client, me, status="paid"))
    assert "kind" in field_errors(sale(client, me, kind="supplier_debt"))


def test_text_limits(client, me):
    assert "description" in field_errors(sale(client, me, description="x" * 121))
    e = entry_of(sale(client, me))
    r = client.post(f"{BASE}/entries/{e['id']}/cancel", headers=me, json={"reason": "x" * 121})
    assert "reason" in field_errors(r)


# ---------------------------------------------------------------- payments


def test_part_then_full_repayment(client, me):
    e = entry_of(sale(client, me))
    e = entry_of(pay(client, me, e["id"], 2000))
    assert e["paid_cents"] == 2000 and e["outstanding_cents"] == 2800 and e["status"] == "open"
    e = entry_of(pay(client, me, e["id"], 2800, paid_on=day(0)))
    assert e["outstanding_cents"] == 0 and e["status"] == "paid"
    assert [h["type"] for h in e["history"]] == ["given", "repayment", "repayment"]


def test_overpaying_is_refused(client, me):
    e = entry_of(sale(client, me))
    assert "amount_cents" in field_errors(pay(client, me, e["id"], 4801))
    entry_of(pay(client, me, e["id"], 4800))
    r = pay(client, me, e["id"], 1)
    assert r.status_code == 409 and r.get_json()["code"] == "ENTRY_CLOSED"


def test_payment_dates_are_bounded(client, me):
    e = entry_of(sale(client, me, given_on=day(-5), due_on=day(5)))
    assert "paid_on" in field_errors(pay(client, me, e["id"], 100, paid_on=day(-6)))  # before it was given
    assert "paid_on" in field_errors(pay(client, me, e["id"], 100, paid_on=day(1)))  # the future
    assert entry_of(pay(client, me, e["id"], 100, paid_on=day(-5)))["paid_cents"] == 100


def test_two_payments_at_the_same_moment_cannot_overpay(app, client, me):
    e = entry_of(sale(client, me, amount_cents=10_000))
    start = threading.Barrier(2)
    codes: list[int] = []

    def pay_60():
        with app.app_context():
            c = app.test_client()
            start.wait()
            codes.append(pay(c, me, e["id"], 6000).status_code)

    threads = [threading.Thread(target=pay_60) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(codes) == [201, 422]
    final = client.get(f"{BASE}/entries/{e['id']}", headers=me).get_json()["data"]["entry"]
    assert final["paid_cents"] == 6000 and final["outstanding_cents"] == 4000


# ------------------------------------------------------------- corrections


def test_a_correction_keeps_the_old_values(client, me):
    e = entry_of(sale(client, me, amount_cents=9500))
    r = client.post(f"{BASE}/entries/{e['id']}/corrections", headers=me, json={"amount_cents": 9000, "due_on": day(10), "description": "Airtime", "reason": "Typed R95"})
    e = entry_of(r)
    assert r.status_code == 201 and e["amount_cents"] == 9000 and e["due_on"] == day(10) and e["description"] == "Airtime"
    c = e["history"][-1]
    assert c["type"] == "correction" and c["reason"] == "Typed R95"
    assert c["before"] == {"amount_cents": 9500, "due_on": day(7), "description": "Bread, milk"}
    assert c["after"] == {"amount_cents": 9000, "due_on": day(10), "description": "Airtime"}
    assert e["history"][0]["amount_cents"] == 9500  # "given" shows what was really given


def test_corrections_can_settle_and_reopen(client, me):
    e = entry_of(sale(client, me, amount_cents=5000))
    entry_of(pay(client, me, e["id"], 3000))
    body = {"due_on": day(7), "description": "Bread, milk"}
    settled = entry_of(client.post(f"{BASE}/entries/{e['id']}/corrections", headers=me, json={**body, "amount_cents": 3000}))
    assert settled["status"] == "paid"
    reopened = entry_of(client.post(f"{BASE}/entries/{e['id']}/corrections", headers=me, json={**body, "amount_cents": 4000}))
    assert reopened["status"] == "open" and reopened["outstanding_cents"] == 1000


def test_correction_rules(client, me):
    e = entry_of(sale(client, me))
    entry_of(pay(client, me, e["id"], 2000))
    url = f"{BASE}/entries/{e['id']}/corrections"
    assert "amount_cents" in field_errors(client.post(url, headers=me, json={"amount_cents": 1999, "due_on": day(7)}))  # below what's paid
    same = {"amount_cents": 4800, "due_on": day(7), "description": "Bread, milk"}
    assert "amount_cents" in field_errors(client.post(url, headers=me, json=same))  # nothing changed
    assert "due_on" in field_errors(client.post(url, headers=me, json={**same, "due_on": day(-1)}))


# ------------------------------------------------------------------ cancel


def test_cancel_an_entry_made_by_mistake(client, me):
    e = entry_of(sale(client, me))
    r = client.post(f"{BASE}/entries/{e['id']}/cancel", headers=me, json={"reason": "Wrong customer"})
    e = entry_of(r)
    assert e["status"] == "cancelled" and e["outstanding_cents"] == 0 and e["history"][-1]["type"] == "cancelled"
    assert client.get(f"{BASE}/entries", headers=me).get_json()["data"]["entries"] == []
    again = client.post(f"{BASE}/entries/{e['id']}/cancel", headers=me, json={})
    assert again.status_code == 409 and again.get_json()["code"] == "ENTRY_CLOSED"
    corr = client.post(f"{BASE}/entries/{e['id']}/corrections", headers=me, json={"amount_cents": 100, "due_on": day(7)})
    assert corr.status_code == 409


def test_cannot_cancel_after_money_was_paid_back(client, me):
    e = entry_of(sale(client, me))
    entry_of(pay(client, me, e["id"], 100))
    r = client.post(f"{BASE}/entries/{e['id']}/cancel", headers=me, json={})
    assert r.status_code == 409 and r.get_json()["code"] == "HAS_REPAYMENTS"


# --------------------------------------------------------------- customers


def test_search_puts_names_that_start_with_it_first(client, me):
    for name in ["Bongani", "Thandi", "Nothando"]:
        entry_of(sale(client, me, customer={"name": name}))
    names = [c["name"] for c in client.get(f"{BASE}/customers?q=tha", headers=me).get_json()["data"]["customers"]]
    assert names == ["Thandi", "Nothando"]
    everyone = client.get(f"{BASE}/customers?q=", headers=me).get_json()["data"]["customers"]
    assert [c["name"] for c in everyone] == ["Bongani", "Nothando", "Thandi"]


def test_search_wildcards_are_plain_text(client, me):
    entry_of(sale(client, me, customer={"name": "Thandi"}))
    assert client.get(f"{BASE}/customers?q=%25", headers=me).get_json()["data"]["customers"] == []
    assert client.get(f"{BASE}/customers?q=_", headers=me).get_json()["data"]["customers"] == []


def test_add_and_clear_a_customers_cellphone(client, me):
    e = entry_of(sale(client, me, customer={"name": "Lerato"}))
    url = f"{BASE}/customers/{e['customer']['id']}"
    c = client.patch(url, headers=me, json={"phone": "073 123 4567"}).get_json()["data"]["customer"]
    assert c["phone"] == "0731234567" and c["owes_cents"] == 4800
    assert client.get(f"{BASE}/entries/{e['id']}", headers=me).get_json()["data"]["entry"]["customer"]["phone"] == "0731234567"
    assert client.patch(url, headers=me, json={"phone": None}).get_json()["data"]["customer"]["phone"] is None
    assert "phone" in field_errors(client.patch(url, headers=me, json={"phone": "011 123 4567"}))
    assert "phone" in field_errors(client.patch(url, headers=me, json={}))


def test_deleting_a_customer_keeps_the_amounts(client, me):
    e = entry_of(sale(client, me))
    url = f"{BASE}/customers/{e['customer']['id']}"
    assert client.delete(url, headers=me).status_code == 200
    kept = client.get(f"{BASE}/entries/{e['id']}", headers=me).get_json()["data"]["entry"]
    assert kept["customer"]["name"] == "Deleted customer" and kept["customer"]["phone"] is None and kept["amount_cents"] == 4800
    assert client.get(f"{BASE}/customers", headers=me).get_json()["data"]["customers"] == []
    assert client.delete(url, headers=me).status_code == 404


# ------------------------------------------------------------------ summary


def test_summary_adds_up(client, me):
    thandi = entry_of(sale(client, me, amount_cents=4800, due_on=day(0)))
    entry_of(sale(client, me, customer={"name": "Lerato"}, amount_cents=9500, given_on=day(-9), due_on=day(-3)))
    entry_of(pay(client, me, thandi["id"], 800))
    s = client.get(f"{BASE}/summary", headers=me).get_json()["data"]["summary"]
    assert s["customers_owe_cents"] == 4000 + 9500
    assert s["customers_owing"] == 2 and s["due_today_count"] == 1 and s["due_today_cents"] == 4000 and s["overdue_count"] == 1
    assert s["paid_back_this_month_cents"] == 800


def test_list_filters_by_status(client, me):
    a = entry_of(sale(client, me))
    entry_of(sale(client, me, customer={"name": "Sipho"}))
    entry_of(pay(client, me, a["id"], 4800))
    assert [e["status"] for e in client.get(f"{BASE}/entries", headers=me).get_json()["data"]["entries"]] == ["open", "paid"]
    assert len(client.get(f"{BASE}/entries?status=paid", headers=me).get_json()["data"]["entries"]) == 1
    assert "status" in field_errors(client.get(f"{BASE}/entries?status=cancelled", headers=me))


# --------------------------------------------------------------------- IDOR


def test_another_trader_gets_404_on_every_route(client, me, other):
    e = entry_of(sale(client, me))
    cid = e["customer"]["id"]
    attempts = [
        client.get(f"{BASE}/entries/{e['id']}", headers=other),
        pay(client, other, e["id"], 100),
        client.post(f"{BASE}/entries/{e['id']}/corrections", headers=other, json={"amount_cents": 100, "due_on": day(7)}),
        client.post(f"{BASE}/entries/{e['id']}/cancel", headers=other, json={}),
        client.patch(f"{BASE}/customers/{cid}", headers=other, json={"phone": None}),
        client.delete(f"{BASE}/customers/{cid}", headers=other),
        sale(client, other, customer=None, customer_id=cid),
    ]
    assert [r.status_code for r in attempts] == [404] * len(attempts)
    # ...and sees nothing of the first trader's book.
    assert client.get(f"{BASE}/entries", headers=other).get_json()["data"]["entries"] == []
    assert client.get(f"{BASE}/customers?q=tha", headers=other).get_json()["data"]["customers"] == []
    assert client.get(f"{BASE}/summary", headers=other).get_json()["data"]["summary"]["customers_owe_cents"] == 0
    # Nothing was changed.
    mine = client.get(f"{BASE}/entries/{e['id']}", headers=me).get_json()["data"]["entry"]
    assert mine["status"] == "open" and mine["paid_cents"] == 0 and mine["customer"]["phone"] == "0821234567"


def test_a_malformed_id_is_just_not_found(client, me):
    assert client.get(f"{BASE}/entries/not-a-uuid", headers=me).status_code == 404
    assert client.get(f"{BASE}/entries/{uuid.uuid4()}", headers=me).status_code == 404


# -------------------------------------------------------------- idempotency


def test_the_same_idempotency_key_never_adds_twice(client, me):
    key = {"Idempotency-Key": f"sale-{uuid.uuid4()}"}
    first = sale(client, {**me, **key})
    second = sale(client, {**me, **key})
    assert first.status_code == second.status_code == 201
    assert second.get_json() == first.get_json()
    assert len(client.get(f"{BASE}/entries", headers=me).get_json()["data"]["entries"]) == 1


def test_a_retried_payment_lands_once(client, me):
    e = entry_of(sale(client, me))
    key = {"Idempotency-Key": f"pay-{uuid.uuid4()}"}
    pay(client, {**me, **key}, e["id"], 1000)
    pay(client, {**me, **key}, e["id"], 1000)
    assert client.get(f"{BASE}/entries/{e['id']}", headers=me).get_json()["data"]["entry"]["paid_cents"] == 1000


def test_a_key_reused_for_a_different_sale_is_refused(client, me):
    key = {"Idempotency-Key": f"sale-{uuid.uuid4()}"}
    sale(client, {**me, **key})
    r = sale(client, {**me, **key}, amount_cents=9999)
    assert r.status_code == 422 and r.get_json()["code"] == "IDEMPOTENCY_KEY_REUSED"


def test_a_refusal_is_replayed_too(client, me):
    key = {"Idempotency-Key": f"sale-{uuid.uuid4()}"}
    assert sale(client, {**me, **key}, amount_cents=0).status_code == 422
    assert sale(client, {**me, **key}, amount_cents=0).status_code == 422
    assert client.get(f"{BASE}/entries", headers=me).get_json()["data"]["entries"] == []


def test_keys_belong_to_one_trader(client, me, other):
    key = {"Idempotency-Key": f"shared-{uuid.uuid4()}"}
    sale(client, {**me, **key})
    r = sale(client, {**other, **key})
    assert r.status_code == 201 and r.get_json()["data"]["entry"]["customer"]["name"] == NAME
    assert len(client.get(f"{BASE}/entries", headers=other).get_json()["data"]["entries"]) == 1


@pytest.mark.parametrize("key", ["short", "x" * 256])
def test_idempotency_key_shape(client, me, key):
    assert sale(client, {**me, "Idempotency-Key": key}).status_code == 422


# -------------------------------------------------------------- rate limits


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
    codes = [client.get(f"{BASE}/summary", headers=me).status_code for _ in range(121)]
    assert codes[:120] == [200] * 120 and codes[120] == 429
    # Same test client, so the same IP: the other trader still has their own allowance.
    assert client.get(f"{BASE}/summary", headers=other).status_code == 200


# -------------------------------------------------------------------- audit


def test_the_audit_trail_has_amounts_but_no_names_or_phones(app, client, me):
    since = datetime.now(timezone.utc)
    e = entry_of(sale(client, me, description="Bread for Thandi", customer={"name": NAME, "phone": PHONE}))
    entry_of(pay(client, me, e["id"], 800))
    entry_of(client.post(f"{BASE}/entries/{e['id']}/corrections", headers=me, json={"amount_cents": 5000, "due_on": day(9), "reason": "Thandi asked"}))
    client.patch(f"{BASE}/customers/{e['customer']['id']}", headers=me, json={"phone": "073 999 8888"})
    other_sale = entry_of(sale(client, me, customer={"name": "Lerato Dube"}))
    entry_of(client.post(f"{BASE}/entries/{other_sale['id']}/cancel", headers=me, json={"reason": "Lerato Dube was wrong"}))
    client.delete(f"{BASE}/customers/{e['customer']['id']}", headers=me)

    with app.app_context():
        rows = AuditEventRecord.query.filter(AuditEventRecord.event_name.like("credit.%"), AuditEventRecord.timestamp >= since).all()
        events = sorted({r.event_name for r in rows})
        dumped = json.dumps([{"meta": r.event_metadata, "reason": r.failure_reason, "endpoint": r.endpoint} for r in rows]).lower()

    assert events == [
        "credit.customer_deleted",
        "credit.customer_phone_changed",
        "credit.entry_added",
        "credit.entry_cancelled",
        "credit.entry_corrected",
        "credit.payment_recorded",
    ]
    assert '"amount_cents": 4800' in dumped
    for secret in ["thandi", "mokoena", "lerato", "dube", "bread", "0821234567", "082 123", "0739998888", "asked"]:
        assert secret not in dumped, secret
