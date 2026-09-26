"""
History and the bin for the credit book (CONTRACT_bin.txt): paid and
cancelled entries in history, "delete" that only hides, restore for 30
days, and a bin nobody else can see into.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from src.domains.informal_trader.credit_book.models import CreditEntry
from src.domains.informal_trader.credit_book.services.credit_book_service import today
from src.domains.security.audit.models import AuditEventRecord
from src.extensions import db

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
BASE = "/api/v1/me/credit-book"


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


def sale(client, headers, name="Thandi Mokoena", cents=4800, **overrides) -> dict:
    body = {"customer": {"name": name}, "amount_cents": cents, "description": "Bread, milk", "due_on": day(7), **overrides}
    r = client.post(f"{BASE}/entries", headers=headers, json=body)
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]["entry"]


def pay(client, headers, entry_id, cents) -> dict:
    r = client.post(f"{BASE}/entries/{entry_id}/payments", headers=headers, json={"amount_cents": cents})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]["entry"]


def history(client, headers, q=None) -> list[dict]:
    r = client.get(f"{BASE}/history", headers=headers, query_string={"q": q} if q is not None else {})
    assert r.status_code == 200, r.get_json()
    return r.get_json()["data"]["entries"]


def binned(client, headers) -> list[dict]:
    r = client.get(f"{BASE}/bin", headers=headers)
    assert r.status_code == 200, r.get_json()
    return r.get_json()["data"]["entries"]


def summary(client, headers) -> dict:
    return client.get(f"{BASE}/summary", headers=headers).get_json()["data"]["summary"]


def ids(entries) -> list[str]:
    return [e["id"] for e in entries]


# ------------------------------------------------------------------ access


@pytest.mark.parametrize("method,path", [("get", "/history"), ("get", "/bin"), ("delete", "/entries/{e}"), ("post", "/entries/{e}/restore")])
def test_every_route_needs_a_token(client, method, path):
    assert getattr(client, method)(BASE + path.format(e=uuid.uuid4())).status_code == 401


# ------------------------------------------------------------------ history


def test_history_is_paid_and_cancelled_entries_latest_activity_first(client, me):
    open_ = sale(client, me, name="Open Owner")
    paid_early = sale(client, me, name="Paid Early", cents=1000)
    cancelled = sale(client, me, name="Cancelled Case")
    paid_late = sale(client, me, name="Paid Late", cents=2000)
    pay(client, me, paid_late["id"], 2000)
    client.post(f"{BASE}/entries/{cancelled['id']}/cancel", headers=me, json={"reason": "Wrong book"})
    # Paid last of all, though it was the second entry made: its payment is the latest activity.
    pay(client, me, paid_early["id"], 1000)

    got = history(client, me)
    assert ids(got) == [paid_early["id"], cancelled["id"], paid_late["id"]]
    assert open_["id"] not in ids(got)
    assert [e["status"] for e in got] == ["paid", "cancelled", "paid"] and all(e["binned_at"] is None for e in got)


def test_history_searches_the_customers_name(client, me):
    for name in ("Thandi Mokoena", "Sipho Mokoena", "Lerato Dube", "100% Bread"):
        e = sale(client, me, name=name, cents=500)
        pay(client, me, e["id"], 500)
    assert sorted(e["customer"]["name"] for e in history(client, me, "mokoena")) == ["Sipho Mokoena", "Thandi Mokoena"]
    assert [e["customer"]["name"] for e in history(client, me, "  LERATO ")] == ["Lerato Dube"]
    # % and _ are letters here, not wildcards.
    assert [e["customer"]["name"] for e in history(client, me, "100%")] == ["100% Bread"]
    assert history(client, me, "_") == [] and history(client, me, "%") == [e for e in history(client, me, "100%")]


@pytest.mark.parametrize(
    "query,status",
    # NUL is refused before any route runs (src/__init__.py); the rest by the query's schema.
    [({"q": "x" * 61}, 422), ({"q": "a‮b"}, 422), ({"status": "paid"}, 422), ({"q": "a\x00b"}, 400)],
)
def test_history_refuses_odd_queries(client, me, query, status):
    assert client.get(f"{BASE}/history", headers=me, query_string=query).status_code == status


# ---------------------------------------------------------------------- bin


def test_delete_hides_an_entry_everywhere_and_restore_brings_it_all_back(client, me):
    keep = sale(client, me, name="Thandi Mokoena", cents=3000)
    gone = sale(client, me, cents=5000, due_on=day(0), customer=None, customer_id=keep["customer"]["id"])
    pay(client, me, gone["id"], 1000)
    before = summary(client, me)
    assert before["customers_owe_cents"] == 3000 + 4000 and before["paid_back_this_month_cents"] == 1000

    r = client.delete(f"{BASE}/entries/{gone['id']}", headers=me)
    assert r.status_code == 200 and r.get_json()["data"] == {}

    # Not in the book, not in any total, not reachable.
    assert ids(client.get(f"{BASE}/entries", headers=me).get_json()["data"]["entries"]) == [keep["id"]]
    s = summary(client, me)
    assert s["customers_owe_cents"] == 3000 and s["due_today_count"] == 0 and s["paid_back_this_month_cents"] == 0
    assert s["given_this_month_cents"] == 3000
    assert client.get(f"{BASE}/customers", headers=me).get_json()["data"]["customers"][0]["owes_cents"] == 3000
    assert client.get(f"{BASE}/entries/{gone['id']}", headers=me).status_code == 404
    assert client.post(f"{BASE}/entries/{gone['id']}/payments", headers=me, json={"amount_cents": 100}).status_code == 404
    assert client.post(f"{BASE}/entries/{gone['id']}/corrections", headers=me, json={"amount_cents": 6000, "due_on": day(3)}).status_code == 404
    assert client.post(f"{BASE}/entries/{gone['id']}/cancel", headers=me, json={}).status_code == 404
    assert client.delete(f"{BASE}/entries/{gone['id']}", headers=me).status_code == 404

    in_bin = binned(client, me)
    assert ids(in_bin) == [gone["id"]] and in_bin[0]["binned_at"] and in_bin[0]["paid_cents"] == 1000

    r = client.post(f"{BASE}/entries/{gone['id']}/restore", headers=me)
    assert r.status_code == 200
    back = r.get_json()["data"]["entry"]
    assert back["id"] == gone["id"] and back["binned_at"] is None and back["outstanding_cents"] == 4000
    assert binned(client, me) == []
    assert summary(client, me) == before
    detail = client.get(f"{BASE}/entries/{gone['id']}", headers=me).get_json()["data"]["entry"]
    assert [h["type"] for h in detail["history"]] == ["given", "repayment"]
    assert client.post(f"{BASE}/entries/{gone['id']}/restore", headers=me).status_code == 404


def test_a_binned_entry_leaves_history_too(client, me):
    e = sale(client, me, cents=700)
    pay(client, me, e["id"], 700)
    assert ids(history(client, me)) == [e["id"]]
    client.delete(f"{BASE}/entries/{e['id']}", headers=me)
    assert history(client, me) == []


def test_the_bin_is_newest_first(client, me):
    first, second = sale(client, me, name="First One"), sale(client, me, name="Second One")
    client.delete(f"{BASE}/entries/{first['id']}", headers=me)
    client.delete(f"{BASE}/entries/{second['id']}", headers=me)
    assert ids(binned(client, me)) == [second["id"], first["id"]]


def test_after_30_days_it_leaves_the_bin_but_stays_in_the_database(app, client, me):
    e = sale(client, me)
    client.delete(f"{BASE}/entries/{e['id']}", headers=me)
    with app.app_context():
        row = db.session.get(CreditEntry, uuid.UUID(e["id"]))
        row.deleted_at = datetime.now(timezone.utc) - timedelta(days=30, minutes=1)
        db.session.commit()
    assert binned(client, me) == []
    assert client.post(f"{BASE}/entries/{e['id']}/restore", headers=me).status_code == 404
    with app.app_context():
        assert db.session.get(CreditEntry, uuid.UUID(e["id"])).is_deleted is True


def test_only_a_binned_entry_can_be_restored(client, me):
    e = sale(client, me)
    assert client.post(f"{BASE}/entries/{e['id']}/restore", headers=me).status_code == 404


def test_nobody_else_can_bin_restore_or_see(client, me, other):
    e = sale(client, me)
    pay(client, me, e["id"], 4800)
    assert client.delete(f"{BASE}/entries/{e['id']}", headers=other).status_code == 404
    assert history(client, other) == [] and history(client, other, "Thandi") == []
    client.delete(f"{BASE}/entries/{e['id']}", headers=me)
    assert binned(client, other) == []
    assert client.post(f"{BASE}/entries/{e['id']}/restore", headers=other).status_code == 404
    assert ids(binned(client, me)) == [e["id"]]


def test_a_bad_id_is_a_404(client, me):
    assert client.delete(f"{BASE}/entries/not-a-uuid", headers=me).status_code == 404
    assert client.post(f"{BASE}/entries/not-a-uuid/restore", headers=me).status_code == 404


def test_bin_and_restore_are_audited_without_names(app, client, me):
    since = datetime.now(timezone.utc)
    e = sale(client, me, name="Thandi Mokoena")
    client.delete(f"{BASE}/entries/{e['id']}", headers=me)
    client.post(f"{BASE}/entries/{e['id']}/restore", headers=me)
    with app.app_context():
        rows = AuditEventRecord.query.filter(
            AuditEventRecord.event_name.in_(("credit.entry_binned", "credit.entry_restored")), AuditEventRecord.timestamp >= since
        ).all()
        events = sorted(r.event_name for r in rows)
        dumped = json.dumps([r.event_metadata for r in rows]).lower()
    assert events == ["credit.entry_binned", "credit.entry_restored"]
    assert e["id"] in dumped and "thandi" not in dumped and "bread" not in dumped
