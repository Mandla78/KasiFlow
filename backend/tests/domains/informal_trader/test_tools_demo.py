"""
`flask tools seed --me EMAIL`: demo data in one account's credit book, jobs
and order book, made through the real services -- checked here the way the
app sees it (the API), plus: run twice changes nothing, development only.
"""
from __future__ import annotations

import re
from collections import Counter

import pytest

from src.domains.informal_trader.jobs import demo as jobs_demo
from src.domains.informal_trader.jobs.services import job_photo_service
from src.domains.informal_trader.order_book.services.orders_service import today
from src.shared.media.provider import get_provider

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
EMAIL = "demo@example.com"
API = "/api/v1"


@pytest.fixture
def me(client, outbox):
    client.post(f"{API}/auth/register", json={"email": EMAIL, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post(f"{API}/auth/verify-email", json={"email": EMAIL, "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def photos_without_cloudinary(monkeypatch):
    """The fake storage: the "upload" puts the file there; reading it gives bytes."""
    monkeypatch.setattr(jobs_demo, "_send", lambda form, path: get_provider().put(form.fields["public_id"]))
    monkeypatch.setattr(job_photo_service, "fetch_bytes", lambda url: b"a stage photo")


def seed(app, email=EMAIL):
    return app.test_cli_runner().invoke(args=["tools", "seed", "--me", email])


def get(client, me, path, key):
    r = client.get(f"{API}{path}", headers=me)
    assert r.status_code == 200, r.get_json()
    return r.get_json()["data"][key]


def test_the_three_tools_get_an_ordinary_day(app, client, me):
    r = seed(app)
    assert r.exit_code == 0, r.output

    credit = get(client, me, "/me/credit-book/summary", "summary")
    assert credit["due_today_count"] == 1 and credit["overdue_count"] == 1 and credit["customers_owe_cents"] == 4_800 + 7_200 + 15_000
    assert sorted(e["status"] for e in get(client, me, "/me/credit-book/history", "entries")) == ["cancelled", "paid"]
    assert len(get(client, me, "/me/credit-book/bin", "entries")) == 1

    jobs = {j["title"]: j for j in get(client, me, "/me/jobs", "jobs")}
    assert set(jobs) == {"Bathroom renovation", "Room extension", "Boundary wall"}
    done = jobs["Bathroom renovation"]
    assert done["status"] == "done" and all(s["status"] == "confirmed" and s["photo"] and s["photo"]["sha256"] for s in done["stages"])
    ext = {s["name"]: s["status"] for s in jobs["Room extension"]["stages"]}
    assert ext == {"Deposit": "confirmed", "Walls": "waiting", "Roof": "not_started", "Final": "not_started"}
    assert [j["title"] for j in get(client, me, "/me/jobs/bin", "jobs")] == ["Garage door"]
    assert get(client, me, "/me/jobs/summary", "summary")["waiting_on_clients_cents"] == 1_200_000

    assert len(get(client, me, "/me/order-book/menu", "items")) == 6
    week = get(client, me, f"/me/order-book/week?end={today().isoformat()}", "days")
    assert all(d["orders"] >= 13 for d in week[:6])  # 14-20 a day, one cancelled
    todays = get(client, me, f"/me/order-book/orders?day={today().isoformat()}", "orders")
    assert Counter(o["status"] for o in todays) == {"collected": 5, "ready": 1, "preparing": 1, "new": 1}
    assert [o["number"] for o in todays] == list(range(1, 9))

    tools = get(client, me, "/me/business-profile", "profile")["tools"]
    assert tools["creditBook"] and tools["jobs"] and tools["orderBook"]


def test_run_twice_nothing_changes(app, client, me):
    seed(app)
    before = (len(get(client, me, "/me/jobs", "jobs")), len(get(client, me, "/me/credit-book/entries", "entries")), len(get(client, me, "/me/order-book/menu", "items")))
    r = seed(app)
    assert r.exit_code == 0 and r.output.count("already there") == 3
    after = (len(get(client, me, "/me/jobs", "jobs")), len(get(client, me, "/me/credit-book/entries", "entries")), len(get(client, me, "/me/order-book/menu", "items")))
    assert after == before


def test_only_for_an_existing_account(app):
    r = seed(app, "nobody@example.com")
    assert r.exit_code != 0 and "No account" in r.output


def test_never_outside_development(app, me, monkeypatch):
    monkeypatch.setitem(app.config, "ENV_NAME", "production")
    r = seed(app)
    assert r.exit_code != 0 and "Development only" in r.output
