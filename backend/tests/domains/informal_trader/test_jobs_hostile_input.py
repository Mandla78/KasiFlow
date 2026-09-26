"""
Hostile input on jobs and the public sign-off page: what a careless user
or an attacker sends. The rule (tests/domains/identity/test_hostile_input.py):
refuse if you must, but never crash (no 500) and never store junk.
"""
from __future__ import annotations

import re

import pytest

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
BASE = "/api/v1/me/jobs"

HOSTILE_TEXT = [
    "",
    " ",
    " ",
    "😀😀😀",
    "<script>alert(1)</script>",
    "'; DROP TABLE trader.jobs; --",
    "\x00\x01\x02",
    "‮evil",
    "​​",
    "a" * 5000,
    "\n\n\n",
    "{{7*7}}",
]
WRONG_TYPES = [None, 123, 1.5, True, [], {}, ["a"], {"a": 1}]
JOB = {
    "title": "Room extension",
    "client_name": "Mokoena family",
    "client_phone": "0821234567",
    "total_cents": 1_000_000,
    "stages": [{"name": "Walls", "amount_cents": 1_000_000}],
}


def signed_in(client, outbox) -> dict:
    client.post("/api/v1/auth/register", json={"email": "bongani@example.com", "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": "bongani@example.com", "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def me(client, outbox):
    return signed_in(client, outbox)


@pytest.fixture
def job(client, me):
    return client.post(BASE, headers=me, json=JOB).get_json()["data"]["job"]


def jobs(client, me) -> list:
    return client.get(BASE, headers=me).get_json()["data"]["jobs"]


@pytest.mark.parametrize("field", ["title", "client_name", "place"])
@pytest.mark.parametrize("text", HOSTILE_TEXT)
def test_job_text_never_crashes_and_junk_is_never_stored(client, me, field, text):
    r = client.post(BASE, headers=me, json={**JOB, field: text})
    assert r.status_code != 500
    if r.status_code == 201:
        stored = r.get_json()["data"]["job"][field]
        assert "\x00" not in stored and "‮" not in stored and "​" not in stored and len(stored) <= 120
        if field != "place":
            assert any(ch.isalpha() for ch in stored)
    else:
        # 400: the app-wide guard refuses NUL before any feature sees it.
        assert r.status_code in (400, 422) and jobs(client, me) == []


@pytest.mark.parametrize("text", HOSTILE_TEXT)
def test_stage_names_never_crash(client, me, text):
    r = client.post(BASE, headers=me, json={**JOB, "stages": [{"name": text, "amount_cents": 1_000_000}]})
    assert r.status_code in (201, 400, 422)


@pytest.mark.parametrize("value", WRONG_TYPES)
def test_wrong_types_never_crash(client, me, job, value):
    for key in ["title", "client_name", "client_phone", "place", "total_cents", "stages"]:
        assert client.post(BASE, headers=me, json={**JOB, key: value}).status_code == 422
    assert client.post(BASE, headers=me, json={**JOB, "stages": [value]}).status_code == 422
    stage = job["stages"][0]["id"]
    if not isinstance(value, int) or isinstance(value, bool):  # 123 cents is a real amount
        assert client.post(f"{BASE}/{job['id']}/stages/{stage}/sign-off", headers=me, json={"builder_amount_cents": value}).status_code == 422
    assert client.post(f"{BASE}/{job['id']}/stages/{stage}/photo", headers=me, json={"public_id": value}).status_code == 422


@pytest.mark.parametrize("raw", ["", "null", "[]", '"text"', "123", "{", '{"total_cents": 1e999}'])
def test_broken_bodies_never_crash(client, me, job, raw):
    stage = job["stages"][0]["id"]
    for url in [BASE, f"{BASE}/{job['id']}/stages/{stage}/sign-off", f"{BASE}/{job['id']}/stages/{stage}/photo"]:
        r = client.post(url, headers={**me, "Content-Type": "application/json"}, data=raw)
        assert r.status_code != 500, (url, raw)


@pytest.mark.parametrize("bad", ["../x", "' OR 1=1 --", "0" * 36, "%00"])
def test_ids_in_the_url_are_just_not_found(client, me, bad):
    assert client.get(f"{BASE}/{bad}", headers=me).status_code == 404


# ------------------------------------------------------------ the public page


@pytest.fixture
def ticket(client, me, job):
    stage = job["stages"][0]["id"]
    link = client.post(f"{BASE}/{job['id']}/stages/{stage}/sign-off", headers=me, json={"builder_amount_cents": 1_000_000}).get_json()["data"]["link"]
    return link.split("ticket=")[1]


@pytest.mark.parametrize("value", HOSTILE_TEXT)
def test_the_page_never_crashes_on_hostile_answers(client, ticket, value):
    for form in (
        {"ticket": ticket, "answer": "done", "amount": value},
        {"ticket": ticket, "answer": "not_yet", "note": value},
        {"ticket": ticket, "answer": value},
        {"ticket": value, "answer": "done", "amount": "1"},
    ):
        assert client.post("/sign-off", data=form).status_code != 500
    assert client.get("/sign-off", query_string={"ticket": value}).status_code != 500


def test_the_page_escapes_what_it_shows(client, me):
    body = {**JOB, "title": "<script>alert(1)</script> job", "stages": [{"name": "<b>Walls</b>", "amount_cents": 1_000_000}]}
    job = client.post(BASE, headers=me, json=body).get_json()["data"]["job"]
    link = client.post(f"{BASE}/{job['id']}/stages/{job['stages'][0]['id']}/sign-off", headers=me, json={"builder_amount_cents": 1}).get_json()["data"]["link"]
    html = client.get("/sign-off?ticket=" + link.split("ticket=")[1]).get_data(as_text=True)
    assert "<script>alert(1)</script>" not in html and "&lt;script&gt;" in html and "<b>Walls</b>" not in html


def test_the_page_refuses_unknown_fields_calmly(client, ticket):
    r = client.post("/sign-off", data={"ticket": ticket, "answer": "done", "amount": "1", "builder_amount_cents": "0"})
    assert r.status_code == 200 and "Please check what you typed" in r.get_data(as_text=True)
