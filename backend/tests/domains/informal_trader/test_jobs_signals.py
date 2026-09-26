"""
jobs_service.demand_signals: what a builder's open work needs, for the
supplier engine -- aggregated, the builder's own data only.
"""
from __future__ import annotations

import json
import re
import uuid

import pytest

from src.domains.identity.accounts.services import account_service
from src.domains.informal_trader.jobs.models import Job
from src.domains.informal_trader.jobs.services import jobs_service
from src.domains.informal_trader.jobs.services.jobs_signals import _stage_categories
from src.extensions import db

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}


def builder(client, outbox, email="bongani@example.com", trade="general_builder", pin=(-25.9964, 28.2268)):
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    body = {"business": {"business_name": "Bongani Builds", "business_type": "builder", "trade": trade}}
    if pin:
        body["location"] = {"building": "", "street": "1 Main Road", "suburb": "Tembisa", "city": "Ekurhuleni", "province": "Gauteng", "postal_code": "", "latitude": pin[0], "longitude": pin[1]}
    assert client.patch("/api/v1/me/business-profile", headers=headers, json=body).status_code == 200
    return headers


def add_job(client, headers, stages, title="Room extension"):
    body = {
        "title": title, "client_name": "Mokoena family", "client_phone": "082 123 4567", "place": "Tembisa, Ext 5",
        "total_cents": sum(a for _, a in stages), "stages": [{"name": n, "amount_cents": a} for n, a in stages],
    }
    r = client.post("/api/v1/me/jobs", headers=headers, json=body)
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]["job"]


def signals(app, email="bongani@example.com"):
    with app.app_context():
        return jobs_service.demand_signals(account_service.find_by_email(email))


def confirm(app, job_id, positions):
    with app.app_context():
        job = db.session.get(Job, uuid.UUID(job_id))
        for s in job.stages:
            if s.position in positions:
                s.status = "confirmed"
        db.session.commit()


@pytest.mark.parametrize(
    "name,cats",
    [
        ("Walls", ("building_materials",)),
        ("Roof", ("building_materials", "tools_hardware")),
        ("Bathroom pipes", ("plumbing",)),
        ("Plug points and wiring", ("electrical",)),
        ("Floor tiles", ("paint_finishes",)),
        ("Gate", ("tools_hardware", "building_materials")),
        ("Deposit", ()),
    ],
)
def test_stage_names_pick_categories(name, cats):
    assert _stage_categories(name) == cats


def test_open_stages_weighted_by_what_is_left(app, client, outbox):
    h = builder(client, outbox)
    job = add_job(client, h, [("Deposit", 100_000), ("Walls", 600_000), ("Bathroom pipes", 400_000)])
    confirm(app, job["id"], {0})  # the deposit is in: only walls and pipes are still to buy for
    s = signals(app)
    assert s["categories"] == {"building_materials": 0.6, "plumbing": 0.4}
    assert s["next_stages"] == ["walls"]
    assert s["active_sites"] == [{"lat": -26.0, "lng": 28.23}]


def test_unknown_stage_names_fall_back_to_the_trade(app, client, outbox):
    h = builder(client, outbox, trade="plumber")
    add_job(client, h, [("Deposit", 300_000), ("Walls", 300_000)])
    # "Deposit" says nothing: a plumber's usual buys share its half; "Walls" is building materials.
    assert signals(app)["categories"] == {"building_materials": 0.67, "plumbing": 0.17, "tools_hardware": 0.17}


def test_trade_fallback_and_nothing_open(app, client, outbox):
    h = builder(client, outbox, trade="electrician")
    # No jobs: the trade alone, no site, no next stages.
    s = signals(app)
    assert s == {"categories": {"electrical": 0.5, "tools_hardware": 0.5}, "active_sites": [], "next_stages": []}
    add_job(client, h, [("Stage one", 200_000)])
    s = signals(app)
    assert s["categories"] == {"electrical": 0.5, "tools_hardware": 0.5} and s["next_stages"] == ["stage one"] and len(s["active_sites"]) == 1


def test_next_stages_one_per_job_newest_first_max_five(app, client, outbox):
    h = builder(client, outbox)
    for i in range(7):
        add_job(client, h, [("Foundation", 100_000), (f"Walls {i}", 100_000)], title=f"Job {i}")
    s = signals(app)
    assert s["next_stages"] == ["foundation"]  # the same next stage everywhere counts once
    assert len(s["next_stages"]) <= 5


def test_done_and_binned_jobs_do_not_count(app, client, outbox):
    h = builder(client, outbox)
    job = add_job(client, h, [("Walls", 100_000)])
    with app.app_context():
        j = db.session.get(Job, uuid.UUID(job["id"]))
        j.status = "done"
        db.session.commit()
    assert signals(app)["active_sites"] == []


def test_no_pin_no_site(app, client, outbox):
    h = builder(client, outbox, pin=None)
    add_job(client, h, [("Walls", 100_000)])
    assert signals(app)["active_sites"] == []


def test_only_aggregates_no_client_data_or_money(app, client, outbox):
    h = builder(client, outbox)
    add_job(client, h, [("Walls", 1_234_567)], title="Mokoena room")
    text = json.dumps(signals(app))
    for secret in ("Mokoena", "0821234567", "1234567", "Tembisa", "Room"):
        assert secret not in text


def test_each_builder_gets_their_own(app, client, outbox):
    a = builder(client, outbox)
    b = builder(client, outbox, email="sipho@example.com", trade="plumber")
    add_job(client, a, [("Walls", 100_000)])
    add_job(client, b, [("Geyser", 100_000)])
    assert signals(app)["categories"] == {"building_materials": 1.0}
    assert signals(app, "sipho@example.com")["categories"] == {"plumbing": 1.0}
