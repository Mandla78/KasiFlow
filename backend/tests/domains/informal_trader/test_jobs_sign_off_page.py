"""
The client's sign-off page (no app, no login): what it shows, what it
never shows, the match rule, one use, expiry, revocation, and the same
answer for every link that doesn't work.
"""
from __future__ import annotations

import re
from datetime import timedelta

import pytest

from src.core.base_model import utcnow
from src.domains.informal_trader.jobs.models import JobSignOff
from src.domains.informal_trader.jobs.services import job_photo_service
from src.extensions import db
from src.shared.media.provider import get_provider

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
BASE = "/api/v1/me/jobs"
# An odd amount, easy to spot if it ever leaks onto the client's page.
BUILDER_CENTS = 1_234_567
JOB = {
    "title": "Room extension",
    "client_name": "Mokoena family",
    "client_phone": "082 123 4567",
    "total_cents": 3_000_000,
    "stages": [{"name": "Walls", "amount_cents": 1_800_000}, {"name": "Roof", "amount_cents": 1_200_000}],
}


def signed_in(client, outbox) -> dict:
    client.post("/api/v1/auth/register", json={"email": "bongani@example.com", "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": "bongani@example.com", "code": code}).get_json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    client.patch("/api/v1/me/business-profile", headers=headers, json={"business": {"business_name": "Bongani Builds", "business_type": "builder", "trade": "general_builder"}})
    return headers


@pytest.fixture
def me(client, outbox):
    return signed_in(client, outbox)


@pytest.fixture
def job(client, me, monkeypatch):
    monkeypatch.setattr(job_photo_service, "fetch_bytes", lambda url: b"photo")
    job = client.post(BASE, headers=me, json=JOB).get_json()["data"]["job"]
    walls = job["stages"][0]["id"]
    form = client.post(f"{BASE}/{job['id']}/stages/{walls}/photo/upload-signature", headers=me).get_json()["data"]
    get_provider().put(form["fields"]["public_id"])
    client.post(f"{BASE}/{job['id']}/stages/{walls}/photo", headers=me, json={"public_id": form["fields"]["public_id"]})
    return job


def link_for(client, me, job, stage_index=0, cents=BUILDER_CENTS) -> str:
    stage = job["stages"][stage_index]["id"]
    return client.post(f"{BASE}/{job['id']}/stages/{stage}/sign-off", headers=me, json={"builder_amount_cents": cents}).get_json()["data"]["link"]


def ticket_of(link: str) -> str:
    return link.split("ticket=")[1]


def stage_now(client, me, job, index=0) -> dict:
    return client.get(f"{BASE}/{job['id']}", headers=me).get_json()["data"]["job"]["stages"][index]


def answer(client, ticket, **form):
    return client.post("/sign-off", data={"ticket": ticket, **form})


INVALID = "This link doesn't work any more"


def test_the_page_shows_the_stage_but_never_the_builders_amount(client, me, job):
    r = client.get(f"/sign-off?ticket={ticket_of(link_for(client, me, job))}")
    html = r.get_data(as_text=True)
    assert r.status_code == 200
    assert "Bongani Builds asks you to sign off" in html and "Walls stage" in html and "R18,000" in html and "Room extension" in html
    assert "res.cloudinary.com" in html  # the stage photo
    for secret in ["12,345.67", "12345.67", "1234567", "Mokoena", "0821234567"]:
        assert secret not in html, secret
    assert 'name="robots" content="noindex"' in html
    assert r.headers["Cache-Control"] == "no-store" and r.headers["Referrer-Policy"] == "no-referrer"


def test_the_same_amount_is_confirmed_by_both(client, me, job):
    html = answer(client, ticket_of(link_for(client, me, job, cents=1_800_000)), answer="done", amount="R18 000").get_data(as_text=True)
    assert "confirmed by both of you" in html
    stage = stage_now(client, me, job)
    assert stage["status"] == "confirmed" and stage["client_amount_cents"] == 1_800_000 and stage["confirmed_at"]


def test_a_different_amount_is_a_dispute_with_both_numbers_kept(client, me, job):
    html = answer(client, ticket_of(link_for(client, me, job, cents=1_800_000)), answer="done", amount="15000,50").get_data(as_text=True)
    assert "don't match" in html and "18,000" not in html
    stage = stage_now(client, me, job)
    assert stage["status"] == "amounts_dont_match" and stage["builder_amount_cents"] == 1_800_000 and stage["client_amount_cents"] == 1_500_050


def test_not_yet_goes_back_to_the_builder_with_the_note(client, me, job):
    answer(client, ticket_of(link_for(client, me, job)), answer="not_yet", note="The window frames aren't in yet")
    stage = stage_now(client, me, job)
    assert stage["status"] == "photo_taken" and stage["client_note"] == "The window frames aren't in yet"


def test_an_empty_amount_means_no_cash(client, me, job):
    answer(client, ticket_of(link_for(client, me, job, cents=0)), answer="done", amount="")
    assert stage_now(client, me, job)["status"] == "confirmed"


@pytest.mark.parametrize("amount", ["abc", "12.345", "-5", "1e3", "9" * 12])
def test_a_bad_amount_asks_again_and_uses_nothing(client, me, job, amount):
    ticket = ticket_of(link_for(client, me, job))
    html = answer(client, ticket, answer="done", amount=amount).get_data(as_text=True)
    assert "Type the cash you paid" in html
    assert stage_now(client, me, job)["status"] == "waiting"
    assert "asks you to sign off" in client.get(f"/sign-off?ticket={ticket}").get_data(as_text=True)


def test_a_link_works_once(client, me, job):
    ticket = ticket_of(link_for(client, me, job, cents=1_800_000))
    answer(client, ticket, answer="done", amount="18000")
    assert INVALID in answer(client, ticket, answer="done", amount="1").get_data(as_text=True)
    assert INVALID in client.get(f"/sign-off?ticket={ticket}").get_data(as_text=True)
    assert stage_now(client, me, job)["client_amount_cents"] == 1_800_000


def test_a_new_link_revokes_the_old_one(client, me, job):
    old = ticket_of(link_for(client, me, job))
    new = ticket_of(link_for(client, me, job))
    assert INVALID in client.get(f"/sign-off?ticket={old}").get_data(as_text=True)
    assert "asks you to sign off" in client.get(f"/sign-off?ticket={new}").get_data(as_text=True)


def test_a_link_expires_after_7_days(app, client, me, job):
    ticket = ticket_of(link_for(client, me, job))
    with app.app_context():
        for row in JobSignOff.query.all():
            row.expires_at = utcnow() - timedelta(minutes=1)
        db.session.commit()
    assert INVALID in client.get(f"/sign-off?ticket={ticket}").get_data(as_text=True)


def test_every_link_that_doesnt_work_looks_the_same(client, me, job):
    used = ticket_of(link_for(client, me, job, cents=0))
    answer(client, used, answer="done", amount="")
    pages = [client.get(f"/sign-off?ticket={t}").get_data(as_text=True) for t in [used, "x" * 43, "", "a" * 500]]
    assert all(INVALID in p for p in pages) and len(set(pages)) == 1


def test_the_ticket_is_stored_only_as_a_hash(app, client, me, job):
    ticket = ticket_of(link_for(client, me, job))
    assert len(ticket) >= 43  # 256 bits
    with app.app_context():
        stored = [r.ticket_hash for r in JobSignOff.query.all()]
    assert ticket not in stored and all(len(h) == 64 for h in stored)


def test_confirming_every_stage_finishes_the_job(client, me, job):
    for i, cents in [(0, 1_800_000), (1, 1_200_000)]:
        answer(client, ticket_of(link_for(client, me, job, stage_index=i, cents=cents)), answer="done", amount=str(cents // 100))
    assert client.get(f"{BASE}/{job['id']}", headers=me).get_json()["data"]["job"]["status"] == "done"


def test_a_confirmed_stage_takes_no_new_link_or_photo(client, me, job):
    answer(client, ticket_of(link_for(client, me, job, cents=0)), answer="done", amount="")
    stage = job["stages"][0]["id"]
    r = client.post(f"{BASE}/{job['id']}/stages/{stage}/sign-off", headers=me, json={"builder_amount_cents": 1})
    assert r.status_code == 409 and r.get_json()["code"] == "STAGE_CONFIRMED"
    r = client.post(f"{BASE}/{job['id']}/stages/{stage}/photo/upload-signature", headers=me)
    assert r.status_code == 409
