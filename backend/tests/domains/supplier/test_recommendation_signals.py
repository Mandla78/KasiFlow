"""
The tools feed the supplier engine (TEAMMATE 20): what a trader's own
switched-on tools say they need now -- open job stages, this week's
sales -- lifts the suppliers that sell it, with a reason they can read.
It only ever lifts, never hides a supplier, never moves anyone else's
list, and a tool that's off, empty or failing leaves today's ranking.
"""
from __future__ import annotations

import itertools
import logging
import re
from pathlib import Path

import pytest
from order_book_helpers import place, save_menu
from sqlalchemy import text

from src.domains.informal_trader.jobs.models import Job
from src.domains.informal_trader.jobs.services import jobs_service
from src.domains.supplier.integration.services.feed_loader import load_directory
from src.domains.supplier.recommendation.services import recommendation_service
from src.domains.supplier.recommendation.services.recommendation_service import _LABELS, REASON_MAX_CHARS, _demand_reason
from src.domains.supplier.supplier_profile.models import Supplier
from src.extensions import db

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
SEED = Path(__file__).resolve().parents[3] / "seed" / "suppliers"
URL = "/api/v1/suppliers/recommended"
PIN = {"building": "", "street": "1 Main Road", "suburb": "Tembisa", "city": "Ekurhuleni", "province": "Gauteng", "postal_code": "1632", "latitude": -25.9964, "longitude": 28.2268}
BUYING = {"restock": "weekly", "spend": "5k_20k", "payment": "both", "fulfilment": "delivery"}
TOOLS_OFF = {"creditBook": False, "orderStock": True, "myRecord": True, "jobs": False, "orderBook": False}

# What a job and a kota menu say, none of which may ever reach a reason.
CLIENT, TITLE, PLACE = "Thandi Mokoena", "Mokoena bathroom", "12 Khumalo Street"
STAGES = [("Bathroom pipes", 432_100), ("Geyser and taps", 250_000)]


def signed_in(client, outbox, email) -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def profile(client, headers, *, kind, categories, tools) -> None:
    body = {
        "business": {"business_name": "Test Business", "business_type": kind, "trade": "general_builder" if kind == "builder" else None, "owner_name": "Test Owner", "years_trading": "3_plus", "cellphone": "082 123 4567"},
        "location": PIN,
        "buying": {**BUYING, "categories": categories},
        "tools": {**TOOLS_OFF, **tools},
    }
    r = client.patch("/api/v1/me/business-profile", headers=headers, json=body)
    assert r.status_code == 200, r.get_json()


def builder(client, outbox, email="bongani@example.com", jobs_on=True) -> dict:
    h = signed_in(client, outbox, email)
    # Signed up for paint and tools -- not plumbing.
    profile(client, h, kind="builder", categories=["paint_finishes", "tools_hardware"], tools={"jobs": jobs_on})
    return h


def switch(client, headers, **tools) -> None:
    r = client.patch("/api/v1/me/business-profile", headers=headers, json={"tools": {**TOOLS_OFF, **tools}})
    assert r.status_code == 200, r.get_json()


def add_plumbing_job(client, headers) -> dict:
    body = {
        "title": TITLE, "client_name": CLIENT, "client_phone": "082 765 4321", "place": PLACE,
        "total_cents": sum(a for _, a in STAGES), "stages": [{"name": n, "amount_cents": a} for n, a in STAGES],
    }
    r = client.post("/api/v1/me/jobs", headers=headers, json=body)
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]["job"]


def ranking(client, headers) -> list[dict]:
    r = client.get(URL, headers=headers)
    assert r.status_code == 200, r.get_json()
    return r.get_json()["data"]["suppliers"]


def rank_of(suppliers: list[dict], name: str) -> int:
    return next(i for i, s in enumerate(suppliers) if s["name"] == name)


def by_name(suppliers: list[dict]) -> dict[str, dict]:
    return {s["name"]: s for s in suppliers}


@pytest.fixture
def seeded(app):
    with app.app_context():
        for folder in sorted(p for p in SEED.iterdir() if p.is_dir()):
            load_directory(folder, source="seed", verified=True)
        return {s.trading_name: str(s.id) for s in Supplier.query.all()}


# ------------------------------------------------------------ builders


def test_open_plumbing_work_lifts_the_plumbing_supplier(client, outbox, seeded):
    h = builder(client, outbox)
    before = ranking(client, h)
    add_plumbing_job(client, h)
    after = ranking(client, h)

    # Midrand Build & Plumb sells plumbing but none of the sign-up categories: it rises, and says why.
    assert rank_of(after, "Midrand Build & Plumb") < rank_of(before, "Midrand Build & Plumb")
    assert "Your open jobs need plumbing" in by_name(after)["Midrand Build & Plumb"]["reasons"]
    # Every supplier is still there; demand only lifts, it never pushes one down.
    assert len(after) == len(before) == len(seeded)
    old = by_name(before)
    assert all(s["score"] >= old[s["name"]]["score"] for s in after)
    # A reason only where demand added something: the grocers sell no plumbing.
    assert not any(r.startswith("Your open jobs") for r in by_name(after)["Mahlangu Wholesale"]["reasons"])


def test_the_supplier_page_gives_the_same_reason(client, outbox, seeded):
    h = builder(client, outbox)
    add_plumbing_job(client, h)
    page = client.get(f"/api/v1/suppliers/{seeded['Midrand Build & Plumb']}", headers=h).get_json()["data"]["supplier"]
    assert "Your open jobs need plumbing" in page["reasons"]


def test_no_open_work_or_the_tool_off_is_todays_ranking(app, client, outbox, seeded):
    h = builder(client, outbox, jobs_on=False)
    today = ranking(client, h)
    # Jobs on, but no jobs: the trade alone says nothing about NOW.
    switch(client, h, jobs=True)
    assert ranking(client, h) == today
    # Open plumbing work, but the tool switched off: not read at all.
    add_plumbing_job(client, h)
    switch(client, h, jobs=False)
    assert ranking(client, h) == today
    # And when every stage is confirmed, the job is done: nothing open.
    switch(client, h, jobs=True)
    assert ranking(client, h) != today
    with app.app_context():
        for job in Job.query.all():
            job.status = "done"
        db.session.commit()
    assert ranking(client, h) == today


def test_another_traders_work_never_moves_my_list(client, outbox, seeded):
    mine = builder(client, outbox, "bongani@example.com")
    before = ranking(client, mine)
    theirs = builder(client, outbox, "sipho@example.com")
    add_plumbing_job(client, theirs)
    assert ranking(client, mine) == before
    assert ranking(client, theirs) != before


def test_reasons_never_carry_a_client_a_job_or_an_amount(client, outbox, seeded):
    h = builder(client, outbox)
    add_plumbing_job(client, h)
    said = " | ".join(r for s in ranking(client, h) for r in [*s["reasons"], s["caution"] or ""])
    for secret in (CLIENT, "Mokoena", TITLE, PLACE, "Khumalo", "Bathroom pipes", "Geyser", "4,321", "4321", "432100", "2,500"):
        assert secret.lower() not in said.lower(), secret


# ------------------------------------------------------------ food sellers


def test_this_weeks_sales_lift_the_matching_category(client, outbox, seeded):
    h = signed_in(client, outbox, "lindiwe@example.com")
    profile(client, h, kind="food", categories=["food_grocery"], tools={"orderBook": True})
    before = ranking(client, h)
    menu = save_menu(client, h, [{"name": "Gogo's quarter loaf", "price_cents": 1500, "ingredients": ["quarter_loaf"]}])
    place(client, h, menu, ("Gogo's quarter loaf", 12))
    after = ranking(client, h)

    assert rank_of(after, "Kasi Bakers") < rank_of(before, "Kasi Bakers")
    reasons = by_name(after)["Kasi Bakers"]["reasons"]
    assert "Your sales need bakery" in reasons
    said = " | ".join(r for s in after for r in s["reasons"])
    assert "Gogo" not in said and "quarter" not in said.lower() and "R15" not in said
    assert len(after) == len(before)


def test_no_sales_this_week_is_todays_ranking(client, outbox, seeded):
    h = signed_in(client, outbox, "lindiwe@example.com")
    profile(client, h, kind="food", categories=["food_grocery"], tools={"orderBook": False})
    today = ranking(client, h)
    switch(client, h, orderBook=True)
    save_menu(client, h)
    assert ranking(client, h) == today


# ------------------------------------------------------------ failures


def test_a_failing_tool_leaves_todays_ranking(app, client, outbox, seeded, monkeypatch, caplog):
    h = builder(client, outbox)
    add_plumbing_job(client, h)
    switch(client, h, jobs=False)
    today = ranking(client, h)
    switch(client, h, jobs=True)

    def broken(user):
        raise RuntimeError("jobs are down")

    monkeypatch.setattr(jobs_service, "demand_signals", broken)
    # Migrating the test database (Alembic's fileConfig) switches existing loggers off: back on for this check.
    monkeypatch.setattr(app.logger, "disabled", False)
    with caplog.at_level(logging.WARNING):
        assert ranking(client, h) == today
    logged = " ".join(r.getMessage() for r in caplog.records if "supplier engine" in r.getMessage())
    assert "jobs signals unavailable (RuntimeError)" in logged
    assert "bongani" not in logged and "@" not in logged


def test_a_failed_query_in_a_tool_cant_spoil_the_request(client, outbox, seeded, monkeypatch):
    h = builder(client, outbox)
    add_plumbing_job(client, h)
    switch(client, h, jobs=False)
    today = ranking(client, h)
    switch(client, h, jobs=True)

    def bad_query(user):
        db.session.execute(text("SELECT * FROM no_such_table"))

    monkeypatch.setattr(jobs_service, "demand_signals", bad_query)
    assert ranking(client, h) == today  # the savepoint rolled it back: no 500


# ------------------------------------------------------------ the reason itself


def test_every_demand_reason_fits_one_line_and_uses_labels():
    codes = [c for c in _LABELS if c != "other"]
    for source, (a, b) in itertools.product(("jobs", "sales"), itertools.permutations(codes, 2)):
        reason = _demand_reason(source, [a, b], {a: 0.6, b: 0.4})
        assert len(reason) <= REASON_MAX_CHARS or " and " not in reason, reason
        assert _LABELS[a].lower() in reason and "_" not in reason
    # The biggest share first; two when the line fits, else the top one.
    assert _demand_reason("sales", ["bakery", "meat_frozen"], {"meat_frozen": 0.4, "bakery": 0.2}) == "Your sales need meat & frozen and bakery"
    assert _demand_reason("jobs", ["electrical", "plumbing"], {"plumbing": 0.7, "electrical": 0.3}) == "Your open jobs need plumbing"


def test_demand_blends_in_by_half_and_only_ever_lifts():
    lift = recommendation_service._lift
    assert recommendation_service.DEMAND_WEIGHT == 0.5
    # Sells 1 of 3 sign-up categories, and all of the open work: halfway between.
    fit, reason = lift(1 / 3, ["plumbing"], {"jobs": {"plumbing": 1.0}})
    assert fit == pytest.approx(2 / 3) and reason == "Your open jobs need plumbing"
    # Already a full fit, or demand below today's fit: unchanged, and no reason.
    assert lift(1.0, ["plumbing"], {"jobs": {"plumbing": 1.0}}) == (1.0, None)
    assert lift(0.8, ["plumbing"], {"jobs": {"plumbing": 0.2}}) == (0.8, None)
    # The stronger of two tools wins, with its own words.
    fit, reason = lift(0.0, ["bakery", "plumbing"], {"jobs": {"plumbing": 0.3}, "sales": {"bakery": 0.9}})
    assert fit == pytest.approx(0.45) and reason == "Your sales need bakery"
    # Nothing to go on: today's fit.
    assert lift(0.5, ["plumbing"], {}) == (0.5, None)
