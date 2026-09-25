"""
The builder network's security rules (CONTRACT_jobs_v2.txt §6): nobody
reaches another builder's jobs, invites or payments; hidden and blocked
builders don't exist; numbers only between partners; no client data, no
pins; hostile input is refused cleanly; the audit trail has no names.
"""
from __future__ import annotations

import json
import uuid

import pytest

from network_helpers import API, builder, data, deal, error, job
from src.domains.security.audit.models import AuditEventRecord


@pytest.fixture
def nomsa(client, outbox):
    return builder(client, outbox, "nomsa@example.com", "Nomsa Dlamini", phone="0821111111")


@pytest.fixture
def thabo(client, outbox):
    return builder(client, outbox, "thabo@example.com", "Thabo Nkosi", trade="plumber", phone="0761234501")


@pytest.fixture
def mallory(client, outbox):
    return builder(client, outbox, "mallory@example.com", "Mallory Snoop", trade="plumber", phone="0791239999")


def invited(client, nomsa, thabo):
    j = job(client, nomsa)
    p = data(client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json={"builder_id": thabo.id, **deal(j)}), "partner")
    return j, p


def test_someone_elses_job_is_not_found(client, nomsa, thabo, mallory):
    j = job(client, nomsa)
    for r in (
        client.get(f"{API}/me/jobs/{j['id']}/partners", headers=mallory.headers),
        client.get(f"{API}/me/jobs/{j['id']}/candidates?trade=plumber", headers=mallory.headers),
        client.post(f"{API}/me/jobs/{j['id']}/partners", headers=mallory.headers, json={"builder_id": thabo.id, **deal(j)}),
        client.post(f"{API}/me/jobs/{j['id']}/help-posts", headers=mallory.headers, json={**deal(j), "suburb": "Tembisa"}),
    ):
        error(r, 404)


def test_someone_elses_invite_and_payment_are_not_found(client, nomsa, thabo, mallory):
    _, p = invited(client, nomsa, thabo)
    error(client.get(f"{API}/me/partner-invites/{p['id']}", headers=mallory.headers), 404)
    error(client.post(f"{API}/me/partner-invites/{p['id']}/answer", headers=mallory.headers, json={"accept": True}), 404)
    error(client.post(f"{API}/me/job-partners/{p['id']}/payments", headers=mallory.headers, json={"amount_cents": 100}), 404)
    # The partner can't record payments as if they were the owner, nor the owner answer for the partner.
    error(client.post(f"{API}/me/job-partners/{p['id']}/payments", headers=thabo.headers, json={"amount_cents": 100}), 404)
    error(client.post(f"{API}/me/partner-invites/{p['id']}/answer", headers=nomsa.headers, json={"accept": True}), 404)
    data(client.post(f"{API}/me/partner-invites/{p['id']}/answer", headers=thabo.headers, json={"accept": True}))
    pay = data(client.post(f"{API}/me/job-partners/{p['id']}/payments", headers=nomsa.headers, json={"amount_cents": 100}), "partner")["payments"][0]
    error(client.post(f"{API}/me/partner-invites/{p['id']}/payments/{pay['id']}/confirm", headers=mallory.headers, json={"amount_cents": 100}), 404)
    error(client.post(f"{API}/me/partner-invites/{p['id']}/payments/{uuid.uuid4()}/confirm", headers=thabo.headers, json={"amount_cents": 100}), 404)


def test_invited_is_not_enough_for_a_phone_number(client, nomsa, thabo):
    _, p = invited(client, nomsa, thabo)
    inv = data(client.get(f"{API}/me/partner-invites/{p['id']}", headers=thabo.headers), "invite")
    assert inv["owner"]["phone"] is None and p["builder"]["phone"] is None
    assert data(client.get(f"{API}/builders/{thabo.id}", headers=nomsa.headers), "builder")["phone"] is None


def test_hidden_builders_cannot_be_invited_or_found(client, outbox, nomsa):
    quiet = builder(client, outbox, "quiet@example.com", "Quiet Plumber", trade="plumber", visible=False)
    j = job(client, nomsa)
    error(client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json={"builder_id": quiet.id, **deal(j)}), 404)
    c = data(client.get(f"{API}/me/jobs/{j['id']}/candidates?trade=plumber", headers=nomsa.headers))
    assert c == {"partners": [], "saved": [], "nearby": []}


def test_blocked_builders_cannot_be_invited_or_answer_posts(client, nomsa, thabo):
    j = job(client, nomsa)
    hp = data(client.post(f"{API}/me/jobs/{j['id']}/help-posts", headers=nomsa.headers, json={**deal(j), "suburb": "Tembisa"}), "post")
    data(client.post(f"{API}/builders/{nomsa.id}/block", headers=thabo.headers))
    error(client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json={"builder_id": thabo.id, **deal(j)}), 404)
    error(client.post(f"{API}/help-posts/{hp['id']}/interested", headers=thabo.headers), 404)
    assert data(client.get(f"{API}/builders", headers=thabo.headers))["help_wanted"] == []


def test_blocking_a_partner_hides_their_invites(client, nomsa, thabo):
    _, p = invited(client, nomsa, thabo)
    data(client.post(f"{API}/builders/{nomsa.id}/block", headers=thabo.headers))
    assert data(client.get(f"{API}/me/partner-invites", headers=thabo.headers), "invites") == []
    error(client.get(f"{API}/me/partner-invites/{p['id']}", headers=thabo.headers), 404)
    assert data(client.get(f"{API}/me/jobs/{p['job_id']}/partners", headers=nomsa.headers), "partners") == []


@pytest.mark.parametrize(
    "body",
    [
        {"trades": ["plumber"], "about": "nul\x00byte", "travel_km": 20, "visible": True},
        {"trades": ["plumber"], "about": "", "travel_km": 20, "visible": 1},
        {"trades": ["plumber"], "about": "", "travel_km": "20", "visible": True},
        {"trades": "plumber", "about": "", "travel_km": 20, "visible": True},
        {"trades": ["plumber"], "about": "", "travel_km": 20, "visible": True, "is_admin": True},
        {"trades": ["plumber"] * 10_000, "about": "", "travel_km": 20, "visible": True},
    ],
)
def test_hostile_profile_input(client, nomsa, body):
    assert client.put(f"{API}/me/builder-profile", headers=nomsa.headers, json=body).status_code in (400, 422)


@pytest.mark.parametrize(
    "patch",
    [
        {"offer": {"kind": "fixed", "amount_cents": -5, "days": 1, "paid_when": "end"}},
        {"offer": {"kind": "fixed", "amount_cents": 10**20, "days": 1, "paid_when": "end"}},
        {"offer": {"kind": "fixed", "amount_cents": 450.5, "days": 1, "paid_when": "end"}},
        {"offer": {"kind": "fixed", "amount_cents": True, "days": 1, "paid_when": "end"}},
        {"offer": {"kind": "fixed", "amount_cents": "450000", "days": 1, "paid_when": "end"}},
        {"offer": {"kind": "fixed", "amount_cents": 450_000, "days": 1, "paid_when": "end", "tip": 1}},
        {"stage_ids": ["not-a-uuid"]},
        {"stage_ids": []},
        {"starts_on": "tomorrow"},
        {"trade": "plumber\x00"},
        {"builder_id": "' OR 1=1 --"},
    ],
)
def test_hostile_invite_input(client, nomsa, thabo, patch):
    j = job(client, nomsa)
    body = {"builder_id": thabo.id, **deal(j), **patch}
    assert client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json=body).status_code in (400, 422)


@pytest.mark.parametrize("suburb", ["", "12345", "x" * 41, "Tem\x00bisa"])
def test_hostile_post_suburb(client, nomsa, suburb):
    j = job(client, nomsa)
    assert client.post(f"{API}/me/jobs/{j['id']}/help-posts", headers=nomsa.headers, json={**deal(j), "suburb": suburb}).status_code in (400, 422)


def test_the_audit_trail_has_ids_not_names_phones_or_money(app, client, nomsa, thabo):
    j, p = invited(client, nomsa, thabo)
    data(client.post(f"{API}/me/partner-invites/{p['id']}/answer", headers=thabo.headers, json={"accept": True}))
    data(client.post(f"{API}/me/job-partners/{p['id']}/payments", headers=nomsa.headers, json={"amount_cents": 450_000}))
    data(client.post(f"{API}/builders/{thabo.id}/report", headers=nomsa.headers, json={"reason": "other", "note": "He called me at 0761234501"}))
    with app.app_context():
        rows = [r for r in AuditEventRecord.query.all() if r.event_name.split(".")[0] in ("builder", "partner", "help_post")]
        names = {r.event_name for r in rows}
        text = json.dumps([r.event_metadata for r in rows], default=str)
    assert {"partner.invited", "partner.answered", "partner.payment_recorded", "builder.reported"} <= names
    for secret in ("Thabo", "Nomsa", "0761234501", "0821111111", "450000", "called me"):
        assert secret not in text
