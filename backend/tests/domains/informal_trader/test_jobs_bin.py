"""
History and the bin for jobs (CONTRACT_bin.txt, with Mandla's change): done
jobs in history; "delete" hides a job and turns off every sign-off link the
client hasn't answered (it then answers like an expired one), restore
brings the job back but never those links; and the builder network drops
the job's help posts and unanswered invites while it's in the bin.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from network_helpers import API, IVORY_PARK, builder, confirm_stage, data, deal, error, finish, job, stage_id
from src.domains.informal_trader.jobs.models import Job
from src.domains.informal_trader.jobs.services import job_photo_service
from src.domains.security.audit.models import AuditEventRecord
from src.extensions import db
from src.shared.media.provider import get_provider

BASE = f"{API}/me/jobs"
INVALID = "This link doesn't work any more"


@pytest.fixture
def nomsa(client, outbox):
    return builder(client, outbox, "nomsa@example.com", "Nomsa Dlamini", phone="0821111111")


@pytest.fixture
def thabo(client, outbox):
    return builder(client, outbox, "thabo@example.com", "Thabo Nkosi", trade="plumber", pin=IVORY_PARK, suburb="Ivory Park", phone="0761234501")


@pytest.fixture(autouse=True)
def stored_photo_bytes(monkeypatch):
    monkeypatch.setattr(job_photo_service, "fetch_bytes", lambda url: b"photo")


def photo(client, who, job_id, stage):
    form = client.post(f"{BASE}/{job_id}/stages/{stage}/photo/upload-signature", headers=who.headers).get_json()["data"]
    get_provider().put(form["fields"]["public_id"])
    assert client.post(f"{BASE}/{job_id}/stages/{stage}/photo", headers=who.headers, json={"public_id": form["fields"]["public_id"]}).status_code == 200


def link(client, who, job_id, stage, cents=1_200_000) -> str:
    r = client.post(f"{BASE}/{job_id}/stages/{stage}/sign-off", headers=who.headers, json={"builder_amount_cents": cents})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]["link"].split("ticket=")[1]


def page(client, ticket) -> str:
    return client.get(f"/sign-off?ticket={ticket}").get_data(as_text=True)


def answer(client, ticket, **form) -> str:
    return client.post("/sign-off", data={"ticket": ticket, **form}).get_data(as_text=True)


def history(client, who, q=None) -> list[dict]:
    return data(client.get(f"{BASE}/history", headers=who.headers, query_string={"q": q} if q is not None else {}), "jobs")


def binned(client, who) -> list[dict]:
    return data(client.get(f"{BASE}/bin", headers=who.headers), "jobs")


def ids(jobs) -> list[str]:
    return [j["id"] for j in jobs]


# ------------------------------------------------------------------ access


@pytest.mark.parametrize("method,path", [("get", "/history"), ("get", "/bin"), ("delete", "/{j}"), ("post", "/{j}/restore")])
def test_every_route_needs_a_token(client, method, path):
    assert getattr(client, method)(BASE + path.format(j=uuid.uuid4())).status_code == 401


# ------------------------------------------------------------------ history


def test_history_is_done_jobs_latest_confirmation_first(app, client, nomsa):
    older = job(client, nomsa, title="Boundary wall", client_name="Dube family")
    newer = job(client, nomsa, title="Room extension", client_name="Mokoena family")
    job(client, nomsa, title="Still busy")
    finish(app, newer["id"])
    finish(app, older["id"])
    # The job made first was finished last: it's the latest activity.
    with app.app_context():
        for s in db.session.get(Job, uuid.UUID(older["id"])).stages:
            s.confirmed_at = datetime.now(timezone.utc)
        db.session.commit()
    got = history(client, nomsa)
    assert ids(got) == [older["id"], newer["id"]] and all(j["status"] == "done" and j["binned_at"] is None for j in got)


def test_history_searches_title_and_client(app, client, nomsa):
    for title, who in (("Room extension", "Mokoena family"), ("Boundary wall", "Dube family"), ("Roof_repair 100%", "Nkosi family")):
        finish(app, job(client, nomsa, title=title, client_name=who)["id"])
    assert [j["title"] for j in history(client, nomsa, "wall")] == ["Boundary wall"]
    assert [j["title"] for j in history(client, nomsa, "MOKOENA")] == ["Room extension"]
    assert [j["title"] for j in history(client, nomsa, "_")] == ["Roof_repair 100%"]
    assert [j["title"] for j in history(client, nomsa, "100%")] == ["Roof_repair 100%"]
    assert history(client, nomsa, "plumbing") == []


@pytest.mark.parametrize("query,status", [({"q": "x" * 61}, 422), ({"q": "a‮b"}, 422), ({"page": "2"}, 422), ({"q": "a\x00b"}, 400)])
def test_history_refuses_odd_queries(client, nomsa, query, status):
    assert client.get(f"{BASE}/history", headers=nomsa.headers, query_string=query).status_code == status


# ---------------------------------------------------------------------- bin


def test_delete_hides_a_job_everywhere_and_restore_brings_it_back(client, nomsa):
    keep = job(client, nomsa, title="Boundary wall")
    gone = job(client, nomsa)
    walls = stage_id(gone, "Walls")
    photo(client, nomsa, gone["id"], walls)
    before = data(client.get(f"{BASE}/summary", headers=nomsa.headers), "summary")

    r = client.delete(f"{BASE}/{gone['id']}", headers=nomsa.headers)
    assert r.status_code == 200 and r.get_json()["data"] == {}

    assert ids(data(client.get(BASE, headers=nomsa.headers), "jobs")) == [keep["id"]]
    assert data(client.get(f"{BASE}/summary", headers=nomsa.headers), "summary")["active_jobs"] == 1
    assert client.get(f"{BASE}/{gone['id']}", headers=nomsa.headers).status_code == 404
    assert client.post(f"{BASE}/{gone['id']}/stages/{walls}/photo/upload-signature", headers=nomsa.headers).status_code == 404
    assert client.post(f"{BASE}/{gone['id']}/stages/{walls}/sign-off", headers=nomsa.headers, json={"builder_amount_cents": 1}).status_code == 404
    assert client.delete(f"{BASE}/{gone['id']}", headers=nomsa.headers).status_code == 404

    in_bin = binned(client, nomsa)
    assert ids(in_bin) == [gone["id"]] and in_bin[0]["binned_at"]

    back = data(client.post(f"{BASE}/{gone['id']}/restore", headers=nomsa.headers), "job")
    assert back["id"] == gone["id"] and back["binned_at"] is None
    assert back["stages"][1]["status"] == "photo_taken" and back["stages"][1]["photo"]
    assert binned(client, nomsa) == []
    assert data(client.get(f"{BASE}/summary", headers=nomsa.headers), "summary") == before
    assert client.post(f"{BASE}/{gone['id']}/restore", headers=nomsa.headers).status_code == 404


def test_an_open_link_answers_like_an_expired_one_after_the_bin(client, nomsa):
    j = job(client, nomsa)
    walls = stage_id(j, "Walls")
    photo(client, nomsa, j["id"], walls)
    ticket = link(client, nomsa, j["id"], walls)
    assert "asks you to sign off" in page(client, ticket)

    client.delete(f"{BASE}/{j['id']}", headers=nomsa.headers)
    assert INVALID in page(client, ticket)
    assert INVALID in answer(client, ticket, answer="done", amount="12000")

    # Restoring doesn't bring the link back; the stage is no longer waiting, and a new link works.
    back = data(client.post(f"{BASE}/{j['id']}/restore", headers=nomsa.headers), "job")
    walls_now = next(s for s in back["stages"] if s["id"] == walls)
    assert walls_now["status"] == "photo_taken" and walls_now["client_amount_cents"] is None
    assert INVALID in page(client, ticket)
    assert data(client.get(f"{BASE}/summary", headers=nomsa.headers), "summary")["waiting_on_clients_cents"] == 0
    fresh = link(client, nomsa, j["id"], walls)
    assert "confirmed by both of you" in answer(client, fresh, answer="done", amount="12000")


def test_confirmed_stages_stay_confirmed_through_the_bin(app, client, nomsa):
    j = job(client, nomsa)
    confirm_stage(app, j["id"], 0)
    deposit = stage_id(j, "Deposit")
    client.delete(f"{BASE}/{j['id']}", headers=nomsa.headers)
    back = data(client.post(f"{BASE}/{j['id']}/restore", headers=nomsa.headers), "job")
    assert next(s for s in back["stages"] if s["id"] == deposit)["status"] == "confirmed"


def test_after_30_days_it_leaves_the_bin_but_stays_in_the_database(app, client, nomsa):
    j = job(client, nomsa)
    client.delete(f"{BASE}/{j['id']}", headers=nomsa.headers)
    with app.app_context():
        db.session.get(Job, uuid.UUID(j["id"])).deleted_at = datetime.now(timezone.utc) - timedelta(days=31)
        db.session.commit()
    assert binned(client, nomsa) == []
    assert client.post(f"{BASE}/{j['id']}/restore", headers=nomsa.headers).status_code == 404
    with app.app_context():
        assert db.session.get(Job, uuid.UUID(j["id"])).is_deleted is True


def test_nobody_else_can_bin_restore_or_see(app, client, nomsa, thabo):
    j = job(client, nomsa)
    finish(app, j["id"])
    assert client.delete(f"{BASE}/{j['id']}", headers=thabo.headers).status_code == 404
    assert history(client, thabo) == [] and history(client, thabo, "Room") == []
    client.delete(f"{BASE}/{j['id']}", headers=nomsa.headers)
    assert binned(client, thabo) == []
    assert client.post(f"{BASE}/{j['id']}/restore", headers=thabo.headers).status_code == 404
    assert ids(binned(client, nomsa)) == [j["id"]]


# ------------------------------------------------------ the builder network


def test_a_binned_job_takes_its_help_posts_and_unanswered_invites_with_it(client, nomsa, thabo):
    j = job(client, nomsa)
    post = data(client.post(f"{API}/me/jobs/{j['id']}/help-posts", headers=nomsa.headers, json={**deal(j, "Walls"), "suburb": "Tembisa"}), "post")
    invite = data(client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json={"builder_id": thabo.id, **deal(j)}), "partner")
    assert len(data(client.get(f"{API}/builders", headers=thabo.headers))["help_wanted"]) == 1
    assert len(data(client.get(f"{API}/me/partner-invites", headers=thabo.headers), "invites")) == 1

    client.delete(f"{BASE}/{j['id']}", headers=nomsa.headers)
    assert data(client.get(f"{API}/builders", headers=thabo.headers))["help_wanted"] == []
    assert data(client.get(f"{API}/builders", headers=nomsa.headers))["my_posts"] == []
    assert data(client.get(f"{API}/me/partner-invites", headers=thabo.headers), "invites") == []
    error(client.get(f"{API}/help-posts/{post['id']}", headers=thabo.headers), 404)
    error(client.post(f"{API}/help-posts/{post['id']}/interested", headers=thabo.headers), 404)
    error(client.post(f"{API}/me/partner-invites/{invite['id']}/answer", headers=thabo.headers, json={"accept": True}), 404)

    client.post(f"{BASE}/{j['id']}/restore", headers=nomsa.headers)
    assert len(data(client.get(f"{API}/builders", headers=thabo.headers))["help_wanted"]) == 1
    assert len(data(client.get(f"{API}/me/partner-invites", headers=thabo.headers), "invites")) == 1


def test_a_partner_who_accepted_keeps_their_pay_record(client, nomsa, thabo):
    j = job(client, nomsa)
    invite = data(client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json={"builder_id": thabo.id, **deal(j)}), "partner")
    data(client.post(f"{API}/me/partner-invites/{invite['id']}/answer", headers=thabo.headers, json={"accept": True}))
    paid = data(client.post(f"{API}/me/job-partners/{invite['id']}/payments", headers=nomsa.headers, json={"amount_cents": 450_000}), "partner")
    client.delete(f"{BASE}/{j['id']}", headers=nomsa.headers)

    invites = data(client.get(f"{API}/me/partner-invites", headers=thabo.headers), "invites")
    assert [i["status"] for i in invites] == ["accepted"]
    assert data(client.get(f"{API}/me/partner-invites/{invite['id']}", headers=thabo.headers), "invite")["status"] == "accepted"
    # Thabo can still confirm the cash he got; Nomsa's side of the job is in her bin.
    payment = paid["payments"][0]["id"]
    confirmed = data(client.post(f"{API}/me/partner-invites/{invite['id']}/payments/{payment}/confirm", headers=thabo.headers, json={"amount_cents": 450_000}), "invite")
    assert confirmed["payments"][0]["status"] == "confirmed"
    error(client.post(f"{API}/me/job-partners/{invite['id']}/payments", headers=nomsa.headers, json={"amount_cents": 1000}), 404)


# -------------------------------------------------------------------- audit


def test_bin_and_restore_are_audited_without_names(app, client, nomsa):
    since = datetime.now(timezone.utc)
    j = job(client, nomsa)
    walls = stage_id(j, "Walls")
    photo(client, nomsa, j["id"], walls)
    link(client, nomsa, j["id"], walls)
    client.delete(f"{BASE}/{j['id']}", headers=nomsa.headers)
    client.post(f"{BASE}/{j['id']}/restore", headers=nomsa.headers)
    with app.app_context():
        rows = AuditEventRecord.query.filter(AuditEventRecord.event_name.in_(("job.binned", "job.restored")), AuditEventRecord.timestamp >= since).all()
        events = sorted(r.event_name for r in rows)
        meta = {r.event_name: r.event_metadata for r in rows}
        dumped = json.dumps(list(meta.values())).lower()
    assert events == ["job.binned", "job.restored"]
    assert meta["job.binned"]["links_turned_off"] == 1
    assert "mokoena" not in dumped and "room extension" not in dumped and "0821234567" not in dumped
