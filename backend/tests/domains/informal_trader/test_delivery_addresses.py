"""
Delivery addresses: a trader's saved places besides the business address.
Only their own (someone else's id is "not found"), at most 5, one default,
removed ones never come back, and hostile input is refused.
"""
from __future__ import annotations

import re
import uuid

import pytest

from src.domains.security.audit.models import AuditEventRecord
from src.shared.rate_limit.limiter import limiter

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
URL = "/api/v1/me/delivery-addresses"
HOME = {"label": "Home", "address_text": "12 Mthembu Street, Tembisa", "latitude": -25.99, "longitude": 28.22}


def signed_in(client, outbox, email) -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def me(client, outbox):
    return signed_in(client, outbox, "nomsa@example.com")


@pytest.fixture
def other(client, outbox):
    return signed_in(client, outbox, "thabo@example.com")


def add(client, headers, **changes):
    return client.post(URL, headers=headers, json={**HOME, **changes})


def mine(client, headers) -> list[dict]:
    return client.get(URL, headers=headers).get_json()["data"]["addresses"]


def test_needs_a_token(client):
    assert client.get(URL).status_code == 401
    assert client.post(URL, json=HOME).status_code == 401


def test_save_list_change_and_remove(client, me):
    r = add(client, me)
    assert r.status_code == 201
    a = r.get_json()["data"]["address"]
    assert a["label"] == "Home" and a["is_default"] is False and a["latitude"] == -25.99
    assert [x["id"] for x in mine(client, me)] == [a["id"]]

    r = client.patch(f"{URL}/{a['id']}", headers=me, json={"label": "Mama's house"})
    assert r.status_code == 200 and r.get_json()["data"]["address"]["label"] == "Mama's house"
    r = client.patch(f"{URL}/{a['id']}", headers=me, json={"latitude": -26.1, "longitude": 28.3})
    assert r.get_json()["data"]["address"]["longitude"] == 28.3

    assert client.delete(f"{URL}/{a['id']}", headers=me).status_code == 200
    assert mine(client, me) == []
    # Removed means gone for the trader: it can't be changed, made default or removed again.
    assert client.patch(f"{URL}/{a['id']}", headers=me, json={"label": "Back"}).status_code == 404
    assert client.post(f"{URL}/{a['id']}/default", headers=me).status_code == 404
    assert client.delete(f"{URL}/{a['id']}", headers=me).status_code == 404


def test_one_default_at_a_time_and_it_comes_first(client, me):
    first = add(client, me, label="Shop", is_default=True).get_json()["data"]["address"]
    second = add(client, me, label="Site").get_json()["data"]["address"]
    assert [x["label"] for x in mine(client, me)] == ["Shop", "Site"]

    r = client.post(f"{URL}/{second['id']}/default", headers=me)
    assert r.status_code == 200 and r.get_json()["data"]["address"]["is_default"] is True
    listed = mine(client, me)
    assert [x["label"] for x in listed] == ["Site", "Shop"]
    assert [x["is_default"] for x in listed] == [True, False]

    # A new default takes over from the old one.
    add(client, me, label="Home", is_default=True)
    assert [x["label"] for x in mine(client, me) if x["is_default"]] == ["Home"]
    assert first["id"] in {x["id"] for x in mine(client, me)}


def test_at_most_five(client, me):
    for i in range(5):
        assert add(client, me, label=f"Place {i}").status_code == 201
    r = add(client, me, label="Sixth")
    assert r.status_code == 409 and r.get_json()["code"] == "TOO_MANY_ADDRESSES"
    # Removing one makes room again.
    client.delete(f"{URL}/{mine(client, me)[0]['id']}", headers=me)
    assert add(client, me, label="Sixth").status_code == 201


def test_a_retried_save_lands_once(client, me):
    headers = {**me, "Idempotency-Key": "save-home-address-1"}
    a = client.post(URL, headers=headers, json=HOME)
    b = client.post(URL, headers=headers, json=HOME)
    assert a.status_code == 201 and b.status_code == 201
    assert a.get_json()["data"]["address"]["id"] == b.get_json()["data"]["address"]["id"]
    assert len(mine(client, me)) == 1


def test_someone_elses_address_is_not_found(client, me, other):
    theirs = add(client, other).get_json()["data"]["address"]["id"]
    assert mine(client, me) == []
    assert client.patch(f"{URL}/{theirs}", headers=me, json={"label": "Mine now"}).status_code == 404
    assert client.post(f"{URL}/{theirs}/default", headers=me).status_code == 404
    assert client.delete(f"{URL}/{theirs}", headers=me).status_code == 404
    # Untouched for its owner.
    [still] = mine(client, other)
    assert still["label"] == "Home" and still["is_default"] is False


@pytest.mark.parametrize(
    "body",
    [
        {**HOME, "label": ""},
        {**HOME, "label": "x" * 31},
        {**HOME, "address_text": "abc"},
        {**HOME, "address_text": "x" * 301},
        {**HOME, "latitude": 51.5, "longitude": -0.12},  # London
        {**HOME, "latitude": -25.9, "longitude": 45.0},  # at sea
        {**HOME, "latitude": "NaN"},
        {**HOME, "latitude": 1e308},
        {**HOME, "user_id": str(uuid.uuid4())},  # trying to save for someone else
        {**HOME, "is_deleted": True},
        {k: v for k, v in HOME.items() if k != "latitude"},
        {**HOME, "label": "Shop\u0000"},
        ["not", "an", "object"],
        "just text",
    ],
)
def test_bad_input_is_refused(client, me, body):
    r = client.post(URL, headers=me, json=body)
    # 400: the app-wide guard refuses NUL characters before any route runs.
    assert r.status_code in (400, 422)
    assert mine(client, me) == []


@pytest.mark.parametrize(
    "body",
    [{}, {"latitude": -26.0}, {"longitude": 28.0}, {"is_default": True}, {"label": "   "}],
)
def test_bad_changes_are_refused(client, me, body):
    a = add(client, me).get_json()["data"]["address"]
    assert client.patch(f"{URL}/{a['id']}", headers=me, json=body).status_code == 422
    assert mine(client, me)[0] == a


def test_bad_ids_are_not_found(client, me):
    assert client.patch(f"{URL}/not-a-uuid", headers=me, json={"label": "x"}).status_code == 404
    assert client.delete(f"{URL}/{uuid.uuid4()}", headers=me).status_code == 404


def test_audit_has_ids_never_the_address(app, client, me):
    a = add(client, me).get_json()["data"]["address"]
    client.delete(f"{URL}/{a['id']}", headers=me)
    from src.shared.queue.queue import wait_until_idle

    wait_until_idle(5)
    with app.app_context():
        rows = AuditEventRecord.query.filter(AuditEventRecord.event_name.like("delivery_address.%")).all()
        names = {r.event_name for r in rows}
        assert {"delivery_address.added", "delivery_address.removed"} <= names
        text = " ".join(str(r.event_metadata) for r in rows)
        assert "Mthembu" not in text and "-25.99" not in text


def test_writes_are_rate_limited(app, client, me):
    was = limiter.enabled
    limiter.enabled = True
    with app.app_context():
        limiter.reset()
    try:
        codes = [client.post(f"{URL}/{uuid.uuid4()}/default", headers=me).status_code for _ in range(21)]
        assert codes[:20] == [404] * 20 and codes[20] == 429
    finally:
        with app.app_context():
            limiter.reset()
        limiter.enabled = was
