"""
Jobs: stages that add up, camera photos kept with the server's time and
hash, sign-off links, and a book nobody else can read.
"""
from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import datetime, timezone

import pytest

from src.domains.informal_trader.jobs.services import job_photo_service
from src.domains.security.audit.models import AuditEventRecord
from src.shared.media.provider import get_provider

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}
BASE = "/api/v1/me/jobs"
PHOTO_BYTES = b"\xff\xd8 a stage photo \xff\xd9"

JOB = {
    "title": "Room extension",
    "client_name": "Mokoena family",
    "client_phone": "082 123 4567",
    "place": "Tembisa, Ext 5",
    "total_cents": 3_800_000,
    "stages": [
        {"name": "Deposit", "amount_cents": 500_000},
        {"name": "Walls", "amount_cents": 1_200_000},
        {"name": "Roof", "amount_cents": 1_200_000},
        {"name": "Final", "amount_cents": 900_000},
    ],
}


def signed_in(client, outbox, email="bongani@example.com", business="Bongani Builds") -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    client.patch("/api/v1/me/business-profile", headers=headers, json={"business": {"business_name": business, "business_type": "builder", "trade": "general_builder"}})
    return headers


@pytest.fixture
def me(client, outbox):
    return signed_in(client, outbox)


@pytest.fixture
def other(client, outbox):
    return signed_in(client, outbox, email="sipho@example.com", business="Sipho Plumbing")


@pytest.fixture(autouse=True)
def stored_photo_bytes(monkeypatch):
    """The fake storage has no real files: reading one gives these bytes."""
    monkeypatch.setattr(job_photo_service, "fetch_bytes", lambda url: PHOTO_BYTES)


def create(client, headers, **overrides):
    return client.post(BASE, headers=headers, json={**JOB, **overrides})


def job_of(r) -> dict:
    assert r.status_code in (200, 201), r.get_json()
    return r.get_json()["data"]["job"]


def field_errors(r) -> dict:
    assert r.status_code == 422, (r.status_code, r.get_json())
    return r.get_json()["errors"][0]


def upload_photo(client, headers, job_id, stage_id):
    """What the phone does: ask for a form, 'upload' to storage, then tell us."""
    form = client.post(f"{BASE}/{job_id}/stages/{stage_id}/photo/upload-signature", headers=headers).get_json()["data"]
    public_id = form["fields"]["public_id"]
    get_provider().put(public_id)
    return client.post(f"{BASE}/{job_id}/stages/{stage_id}/photo", headers=headers, json={"public_id": public_id})


def send(client, headers, job_id, stage_id, cents=1_200_000):
    return client.post(f"{BASE}/{job_id}/stages/{stage_id}/sign-off", headers=headers, json={"builder_amount_cents": cents})


# ------------------------------------------------------------------ access


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", ""),
        ("post", ""),
        ("get", "/summary"),
        ("get", "/{j}"),
        ("post", "/{j}/stages/{s}/photo/upload-signature"),
        ("post", "/{j}/stages/{s}/photo"),
        ("post", "/{j}/stages/{s}/sign-off"),
    ],
)
def test_every_route_needs_a_token(client, method, path):
    url = BASE + path.format(j=uuid.uuid4(), s=uuid.uuid4())
    assert getattr(client, method)(url, json={}).status_code == 401


# ------------------------------------------------------------------ jobs


def test_create_and_read_a_job(client, me):
    job = job_of(create(client, me))
    assert job["title"] == "Room extension" and job["client_phone"] == "0821234567" and job["status"] == "active"
    assert [(s["name"], s["amount_cents"], s["status"], s["position"]) for s in job["stages"]] == [
        ("Deposit", 500_000, "not_started", 0),
        ("Walls", 1_200_000, "not_started", 1),
        ("Roof", 1_200_000, "not_started", 2),
        ("Final", 900_000, "not_started", 3),
    ]
    assert client.get(f"{BASE}/{job['id']}", headers=me).get_json()["data"]["job"] == job
    assert [j["id"] for j in client.get(BASE, headers=me).get_json()["data"]["jobs"]] == [job["id"]]


def test_stages_must_add_up_to_the_total(client, me):
    assert "stages" in field_errors(create(client, me, total_cents=3_800_001))


@pytest.mark.parametrize(
    "overrides,field",
    [
        ({"title": "123"}, "title"),
        ({"title": "x" * 61}, "title"),
        ({"client_name": "  "}, "client_name"),
        ({"client_phone": "011 123 4567"}, "client_phone"),
        ({"client_phone": None}, "client_phone"),
        ({"place": "x" * 121}, "place"),
        ({"total_cents": 0}, "total_cents"),
        ({"total_cents": 500_000_001, "stages": [{"name": "All", "amount_cents": 500_000_001}]}, "total_cents"),
        ({"total_cents": True}, "total_cents"),
        ({"stages": []}, "stages"),
        ({"stages": [{"name": "S", "amount_cents": 1}] * 13, "total_cents": 13}, "stages"),
        ({"stages": [{"name": "999", "amount_cents": 3_800_000}]}, "stages"),
        ({"stages": [{"name": "All", "amount_cents": 3_800_000, "status": "confirmed"}]}, "stages"),
        ({"status": "done"}, "status"),
    ],
)
def test_job_validation(client, me, overrides, field):
    assert field in field_errors(create(client, me, **overrides))


def test_the_same_idempotency_key_never_adds_twice(client, me):
    key = {"Idempotency-Key": f"job-{uuid.uuid4()}"}
    first, second = create(client, {**me, **key}), create(client, {**me, **key})
    assert first.status_code == second.status_code == 201 and first.get_json() == second.get_json()
    assert len(client.get(BASE, headers=me).get_json()["data"]["jobs"]) == 1


# ---------------------------------------------------------------- photos


def test_a_stage_photo_is_kept_with_the_servers_time_and_hash(client, me):
    job = job_of(create(client, me))
    walls = job["stages"][1]["id"]
    before = datetime.now(timezone.utc)
    job = job_of(upload_photo(client, me, job["id"], walls))
    stage = job["stages"][1]
    assert stage["status"] == "photo_taken"
    assert stage["photo"]["sha256"] == hashlib.sha256(PHOTO_BYTES).hexdigest()
    assert datetime.fromisoformat(stage["photo"]["taken_at"]) >= before
    assert stage["photo"]["url"].startswith("https://res.cloudinary.com/")


def test_a_retake_replaces_the_old_photo(client, me):
    job = job_of(create(client, me))
    walls = job["stages"][1]["id"]
    first = job_of(upload_photo(client, me, job["id"], walls))["stages"][1]["photo"]["url"]
    second = job_of(upload_photo(client, me, job["id"], walls))["stages"][1]["photo"]["url"]
    assert first != second and any(first.endswith(d + ".jpg") for d in get_provider().deleted)


def test_a_photo_from_another_jobs_folder_is_refused(client, me):
    a = job_of(create(client, me))
    b = job_of(create(client, me, title="Boundary wall"))
    form = client.post(f"{BASE}/{b['id']}/stages/{b['stages'][0]['id']}/photo/upload-signature", headers=me).get_json()["data"]
    get_provider().put(form["fields"]["public_id"])
    r = client.post(f"{BASE}/{a['id']}/stages/{a['stages'][0]['id']}/photo", headers=me, json={"public_id": form["fields"]["public_id"]})
    assert r.status_code == 404


def test_nothing_is_kept_if_the_photo_cant_be_read(client, me, monkeypatch):
    job = job_of(create(client, me))
    walls = job["stages"][1]["id"]

    def fail(url):
        raise ConnectionError("storage unreachable")

    monkeypatch.setattr(job_photo_service, "fetch_bytes", fail)
    form = client.post(f"{BASE}/{job['id']}/stages/{walls}/photo/upload-signature", headers=me).get_json()["data"]
    get_provider().put(form["fields"]["public_id"])
    r = client.post(f"{BASE}/{job['id']}/stages/{walls}/photo", headers=me, json={"public_id": form["fields"]["public_id"]})
    assert r.status_code == 503 and r.get_json()["code"] == "PHOTO_CHECK_FAILED"
    assert client.get(f"{BASE}/{job['id']}", headers=me).get_json()["data"]["job"]["stages"][1]["photo"] is None
    # The same upload can be tried again once the storage answers.
    monkeypatch.setattr(job_photo_service, "fetch_bytes", lambda url: PHOTO_BYTES)
    r = client.post(f"{BASE}/{job['id']}/stages/{walls}/photo", headers=me, json={"public_id": form["fields"]["public_id"]})
    assert job_of(r)["stages"][1]["status"] == "photo_taken"


# --------------------------------------------------------------- sign-off


def test_send_a_sign_off_link(client, me, app):
    job = job_of(create(client, me))
    walls = job["stages"][1]["id"]
    r = send(client, me, job["id"], walls, 1_200_000)
    assert r.status_code == 201
    data = r.get_json()["data"]
    assert data["link"].startswith(f"{app.config['APP_BASE_URL']}/sign-off?ticket=")
    assert data["job"]["stages"][1]["status"] == "waiting" and data["job"]["stages"][1]["builder_amount_cents"] == 1_200_000
    assert data["message"].startswith("Hi Mokoena family, Bongani Builds asks you to sign off the Walls stage of the room extension.")
    assert data["link"] in data["message"] and not re.search(r"R\d", data["message"])


def test_sign_off_amount_limits(client, me):
    job = job_of(create(client, me))
    stage = job["stages"][0]["id"]
    for bad in [-1, 1.5, "100", True, None, 500_000_001]:
        assert "builder_amount_cents" in field_errors(send(client, me, job["id"], stage, bad))
    assert send(client, me, job["id"], stage, 0).status_code == 201  # "no cash yet" is allowed


def test_summary(client, me):
    job = job_of(create(client, me))
    send(client, me, job["id"], job["stages"][1]["id"])
    job_of(upload_photo(client, me, job["id"], job["stages"][2]["id"]))
    s = client.get(f"{BASE}/summary", headers=me).get_json()["data"]["summary"]
    assert s == {"active_jobs": 1, "waiting_on_clients_cents": 1_200_000, "needs_sign_off": 1}


# --------------------------------------------------------------------- IDOR


def test_another_trader_gets_404_on_every_route(client, me, other):
    job = job_of(create(client, me))
    j, s = job["id"], job["stages"][0]["id"]
    attempts = [
        client.get(f"{BASE}/{j}", headers=other),
        client.post(f"{BASE}/{j}/stages/{s}/photo/upload-signature", headers=other),
        client.post(f"{BASE}/{j}/stages/{s}/photo", headers=other, json={"public_id": "akayza-test/anything/at-all"}),
        send(client, other, j, s),
    ]
    assert [r.status_code for r in attempts] == [404] * len(attempts)
    assert client.get(BASE, headers=other).get_json()["data"]["jobs"] == []
    assert client.get(f"{BASE}/summary", headers=other).get_json()["data"]["summary"]["active_jobs"] == 0
    mine = client.get(f"{BASE}/{j}", headers=me).get_json()["data"]["job"]
    assert mine["stages"][0]["status"] == "not_started"


def test_a_stage_of_another_job_is_not_found(client, me):
    a = job_of(create(client, me))
    b = job_of(create(client, me, title="Boundary wall"))
    assert send(client, me, a["id"], b["stages"][0]["id"]).status_code == 404


# -------------------------------------------------------------------- audit


def test_the_audit_trail_has_no_client_names_phones_or_tickets(app, client, me):
    since = datetime.now(timezone.utc)
    job = job_of(create(client, me))
    job_of(upload_photo(client, me, job["id"], job["stages"][1]["id"]))
    link = send(client, me, job["id"], job["stages"][1]["id"]).get_json()["data"]["link"]
    ticket = link.split("ticket=")[1]
    client.post("/sign-off", data={"ticket": ticket, "answer": "done", "amount": "12000"})

    with app.app_context():
        rows = AuditEventRecord.query.filter(AuditEventRecord.event_name.like("job.%"), AuditEventRecord.timestamp >= since).all()
        events = sorted({r.event_name for r in rows})
        dumped = json.dumps([{"meta": r.event_metadata, "reason": r.failure_reason, "endpoint": r.endpoint} for r in rows]).lower()

    assert events == ["job.created", "job.sign_off_answered", "job.sign_off_sent", "job.stage_photo_added"]
    assert '"outcome": "confirmed"' in dumped and hashlib.sha256(PHOTO_BYTES).hexdigest() in dumped
    for secret in ["mokoena", "0821234567", "082 123", ticket.lower(), "res.cloudinary"]:
        assert secret not in dumped, secret
