"""
Helpers for the builder network tests: builders with a pin and a phone,
a job, and a finished job with client-confirmed stage photos (set straight
in the database: the sign-off flow itself is tested in test_jobs*.py).
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

from src.domains.informal_trader.jobs.models import Job
from src.extensions import db

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}
API = "/api/v1"

TEMBISA = (-25.9964, 28.2268)
IVORY_PARK = (-25.999, 28.196)  # about 3 km from Tembisa
CAPE_TOWN = (-33.9249, 18.4241)

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
OFFER = {"kind": "fixed", "amount_cents": 450_000, "days": 3, "paid_when": "stage_confirmed"}


class Builder:
    def __init__(self, headers: dict, user_id: str, name: str):
        self.headers = headers
        self.id = user_id
        self.name = name


def builder(client, outbox, email: str, name: str, *, trade: str = "general_builder", pin=TEMBISA, suburb: str = "Tembisa", phone: str = "0821230000", visible: bool = True, trades=None, travel_km: int = 20) -> Builder:
    client.post(f"{API}/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post(f"{API}/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    r = client.patch(
        f"{API}/me/business-profile",
        headers=headers,
        json={
            "business": {"business_name": f"{name} Builds", "business_type": "builder", "trade": trade, "owner_name": name, "cellphone": phone},
            "location": {"building": "", "street": "1 Main Road", "suburb": suburb, "city": "Ekurhuleni", "province": "Gauteng", "postal_code": "", "latitude": pin[0], "longitude": pin[1]},
        },
    )
    assert r.status_code == 200, r.get_json()
    me = client.get(f"{API}/me", headers=headers).get_json()["data"]
    user_id = (me.get("user") or me)["id"]
    if visible or trades or travel_km != 20:
        profile = client.get(f"{API}/me/builder-profile", headers=headers).get_json()["data"]["profile"]
        body = {"trades": trades or profile["trades"], "about": "", "travel_km": travel_km, "visible": visible, "shown_job_ids": [b["id"] for b in profile["builds"]]}
        assert client.put(f"{API}/me/builder-profile", headers=headers, json=body).status_code == 200
    return Builder(headers, user_id, name)


def job(client, who: Builder, **overrides) -> dict:
    r = client.post(f"{API}/me/jobs", headers=who.headers, json={**JOB, **overrides})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]["job"]


def finish(app, job_id: str, *, photos: bool = True) -> None:
    """Every stage confirmed by the client (with a photo), the job done."""
    with app.app_context():
        j = db.session.get(Job, uuid.UUID(job_id))
        at = datetime.now(timezone.utc) - timedelta(days=2)
        for s in j.stages:
            s.status = "confirmed"
            s.confirmed_at = at
            s.builder_amount_cents = s.client_amount_cents = s.amount_cents
            if photos:
                s.photo_url = f"https://res.cloudinary.com/demo/image/upload/v1/akayza-test/jobs/{s.id}.jpg"
                s.photo_public_id = f"akayza-test/jobs/{s.id}"
                s.photo_taken_at = at
        j.status = "done"
        db.session.commit()


def confirm_stage(app, job_id: str, position: int) -> None:
    with app.app_context():
        j = db.session.get(Job, uuid.UUID(job_id))
        s = next(s for s in j.stages if s.position == position)
        s.status = "confirmed"
        s.confirmed_at = datetime.now(timezone.utc)
        db.session.commit()


def stage_id(job_json: dict, name: str) -> str:
    return next(s["id"] for s in job_json["stages"] if s["name"] == name)


def deal(job_json: dict, *stages: str, trade: str = "plumber", offer=None, starts_in: int = 1) -> dict:
    from src.domains.informal_trader.builder_network.services.common import today

    return {
        "stage_ids": [stage_id(job_json, s) for s in stages or ("Final",)],
        "trade": trade,
        "starts_on": (today() + timedelta(days=starts_in)).isoformat(),
        "offer": offer or OFFER,
    }


def data(r, key: str | None = None):
    assert r.status_code in (200, 201), (r.status_code, r.get_json())
    body = r.get_json()["data"]
    return body[key] if key else body


def error(r, status: int) -> dict:
    assert r.status_code == status, (r.status_code, r.get_json())
    return r.get_json()
