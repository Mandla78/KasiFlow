"""
Hostile input on the credit book: what a careless user or an attacker
types into every text box and number field.

The rule (as in tests/domains/identity/test_hostile_input.py): an endpoint
may REFUSE, but must never crash (no 500), never store junk as valid, and
never touch another trader's book.
"""
from __future__ import annotations

import re
from datetime import timedelta

import pytest

from src.domains.informal_trader.credit_book.services.credit_book_service import today

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
BASE = "/api/v1/me/credit-book"
REFUSED = {400, 404, 409, 413, 415, 422}

HOSTILE_TEXT = [
    "",
    " ",
    " ",  # no-break space only
    "😀😀😀",
    "<script>alert(1)</script>",
    "'; DROP TABLE trader.credit_entries; --",
    "\x00\x01\x02",
    "‮evil",  # right-to-left override
    "​​",  # zero-width spaces only
    "Thandi‍",  # a joiner on its own after a name
    "a" * 5000,
    "\n\n\n",
    "{{7*7}}",
    "%",
    "_",
]

WRONG_TYPES = [None, 123, 1.5, True, [], {}, ["a"], {"a": 1}]
BAD_DATES = ["", "tomorrow", "2026-02-30", "2026-13-01", "25/09/2026", "9999-12-31", "0001-01-01", 20260925, None]
BAD_CENTS = [0, -1, -10_000_000, 10_000_001, 2**63, 1.5, "100", "1e3", True, False, None, [], {}]


def signed_in(client, outbox, email="nomsa@example.com") -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def me(client, outbox):
    return signed_in(client, outbox)


@pytest.fixture
def entry(client, me):
    body = {"customer": {"name": "Thandi"}, "amount_cents": 4800, "due_on": (today() + timedelta(days=7)).isoformat()}
    return client.post(f"{BASE}/entries", headers=me, json=body).get_json()["data"]["entry"]


def assert_refused(r):
    assert r.status_code in REFUSED, (r.status_code, r.get_data(as_text=True)[:200])
    body = r.get_json()
    assert body is not None and body["success"] is False


def sale(client, headers, **overrides):
    body = {"customer": {"name": "Thandi"}, "amount_cents": 4800, "due_on": (today() + timedelta(days=7)).isoformat(), **overrides}
    return client.post(f"{BASE}/entries", headers=headers, json=body)


def stored_names(client, headers) -> list[str]:
    return [c["name"] for c in client.get(f"{BASE}/customers", headers=headers).get_json()["data"]["customers"]]


# --------------------------------------------------------------- text fields


@pytest.mark.parametrize("text", HOSTILE_TEXT)
def test_customer_names_never_crash_and_junk_is_never_stored(client, me, text):
    r = sale(client, me, customer={"name": text})
    assert r.status_code != 500
    if r.status_code == 201:
        name = r.get_json()["data"]["entry"]["customer"]["name"]
        # Accepted only as a clean, visible name with a letter in it.
        assert any(ch.isalpha() for ch in name) and len(name) <= 60 and name == name.strip()
        assert not any(ch in name for ch in "\x00​‮")
    else:
        assert_refused(r)
        assert stored_names(client, me) == []


@pytest.mark.parametrize("text", HOSTILE_TEXT)
def test_descriptions_never_crash(client, me, text):
    r = sale(client, me, description=text)
    assert r.status_code != 500
    if r.status_code == 201:
        stored = r.get_json()["data"]["entry"]["description"]
        assert len(stored) <= 120 and "\x00" not in stored and "‮" not in stored


@pytest.mark.parametrize("text", HOSTILE_TEXT)
def test_correction_and_cancel_reasons_never_crash(client, me, entry, text):
    body = {"amount_cents": 4000, "due_on": entry["due_on"], "reason": text}
    r = client.post(f"{BASE}/entries/{entry['id']}/corrections", headers=me, json=body)
    assert r.status_code != 500
    r = client.post(f"{BASE}/entries/{entry['id']}/cancel", headers=me, json={"reason": text})
    assert r.status_code != 500


@pytest.mark.parametrize("text", HOSTILE_TEXT)
def test_search_never_crashes_or_matches_everything(client, me, entry, text):
    r = client.get(f"{BASE}/customers", headers=me, query_string={"q": text})
    assert r.status_code != 500
    if r.status_code == 200 and text.strip() not in ("", " ") and "thandi" not in text.lower():
        assert r.get_json()["data"]["customers"] == []


@pytest.mark.parametrize("phone", HOSTILE_TEXT + ["+27" + "8" * 40, "0821234567; DROP", "٠٨٢١٢٣٤٥٦٧"])
def test_phones_never_crash(client, me, entry, phone):
    r = client.patch(f"{BASE}/customers/{entry['customer']['id']}", headers=me, json={"phone": phone})
    assert r.status_code != 500
    if r.status_code == 200:
        assert re.fullmatch(r"0[6-8]\d{8}", r.get_json()["data"]["customer"]["phone"])


# ------------------------------------------------------ numbers and dates


@pytest.mark.parametrize("cents", BAD_CENTS)
def test_bad_amounts_are_refused_everywhere(client, me, entry, cents):
    assert_refused(sale(client, me, amount_cents=cents))
    assert_refused(client.post(f"{BASE}/entries/{entry['id']}/payments", headers=me, json={"amount_cents": cents}))
    assert_refused(client.post(f"{BASE}/entries/{entry['id']}/corrections", headers=me, json={"amount_cents": cents, "due_on": entry["due_on"]}))
    kept = client.get(f"{BASE}/entries/{entry['id']}", headers=me).get_json()["data"]["entry"]
    assert kept["amount_cents"] == 4800 and kept["paid_cents"] == 0


@pytest.mark.parametrize("value", BAD_DATES)
def test_bad_dates_are_refused(client, me, entry, value):
    assert_refused(sale(client, me, due_on=value))
    assert_refused(sale(client, me, given_on=value) if value is not None else sale(client, me, given_on=[]))
    assert_refused(client.post(f"{BASE}/entries/{entry['id']}/payments", headers=me, json={"amount_cents": 100, "paid_on": value} if value is not None else {"amount_cents": 100, "paid_on": {}}))


@pytest.mark.parametrize("value", WRONG_TYPES)
def test_wrong_types_never_crash(client, me, entry, value):
    for body in (
        {"customer": value, "amount_cents": 100, "due_on": entry["due_on"]},
        {"customer_id": value, "amount_cents": 100, "due_on": entry["due_on"]},
        {"customer": {"name": value}, "amount_cents": 100, "due_on": entry["due_on"]},
        {"customer": {"name": "Thandi", "phone": value}, "amount_cents": 100, "due_on": entry["due_on"]},
        {"customer": {"name": "Thandi"}, "amount_cents": 100, "due_on": entry["due_on"], "description": value},
    ):
        assert client.post(f"{BASE}/entries", headers=me, json=body).status_code != 500
    assert client.post(f"{BASE}/entries/{entry['id']}/cancel", headers=me, json={"reason": value}).status_code != 500
    assert client.patch(f"{BASE}/customers/{entry['customer']['id']}", headers=me, json={"phone": value}).status_code != 500


# ------------------------------------------------------------ whole bodies


WRITE_PATHS = ["/entries", "/entries/{e}/payments", "/entries/{e}/corrections", "/entries/{e}/cancel", "/customers/{c}"]


def send_raw(client, me, entry, path, raw):
    url = BASE + path.format(e=entry["id"], c=entry["customer"]["id"])
    send = client.patch if path.startswith("/customers") else client.post
    return send(url, headers={**me, "Content-Type": "application/json"}, data=raw)


@pytest.mark.parametrize("raw", ["", "null", "[]", '"text"', "123", "{", '{"amount_cents": 1e999}'])
@pytest.mark.parametrize("path", WRITE_PATHS)
def test_broken_bodies_never_crash(client, me, entry, raw, path):
    r = send_raw(client, me, entry, path, raw)
    assert r.status_code != 500, (path, raw, r.get_data(as_text=True)[:200])


def test_deeply_nested_json_never_crashes(client, me, entry):
    r = send_raw(client, me, entry, "/entries", '{"a":' * 500 + "1" + "}" * 500)
    assert r.status_code != 500


def test_the_customers_id_in_the_url_is_never_trusted_as_text(client, me):
    for bad in ["../entries", "' OR 1=1 --", "%00", "0" * 36]:
        assert client.patch(f"{BASE}/customers/{bad}", headers=me, json={"phone": None}).status_code == 404
