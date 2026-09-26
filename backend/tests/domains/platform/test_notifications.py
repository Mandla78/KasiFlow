"""
Notifications, step 2 (CONTRACT_notifications.txt): an alert published
anywhere lands once for its owner, in the tab its template says, only
when the owner's switch allows it; the list, the unread counts and read
state; the switches; the 90-day clean-up; the templates themselves.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from notification_helpers import BASE, ORDER, SETTINGS, listed, publish, trader, unread
from src.domains.platform.notifications.jobs import cleanup_old
from src.domains.platform.notifications.models import Notification
from src.domains.platform.notifications.templates import TEMPLATES, placeholders, render
from src.domains.security.audit.models import AuditEventRecord
from src.extensions import db


@pytest.fixture
def me(client, outbox):
    return trader(client, outbox, "lindiwe@example.com")


@pytest.fixture
def other(client, outbox):
    return trader(client, outbox, "sipho@example.com")


def rows(app, who) -> list[Notification]:
    with app.app_context():
        return Notification.query.filter_by(user_id=uuid.UUID(who.id)).all()


# ------------------------------------------------------------------ access


@pytest.mark.parametrize(
    "method,path",
    [("get", BASE + "?tab=orders"), ("get", f"{BASE}/unread"), ("post", f"{BASE}/{uuid.uuid4()}/read"), ("post", f"{BASE}/read-all"), ("get", SETTINGS), ("put", SETTINGS)],
)
def test_every_route_needs_a_token(client, method, path):
    assert getattr(client, method)(path, json={}).status_code == 401


# ------------------------------------------------------------- publishing


def test_an_alert_lands_once_in_its_tab(app, client, me):
    publish(me, "order.accepted", dedupe="order:1:accepted", link=("order", "o-1"), **ORDER)
    publish(me, "order.accepted", dedupe="order:1:accepted", link=("order", "o-1"), **ORDER)  # a retry
    publish(me, "account.new_phone", dedupe="account:x:phone:1")
    got = rows(app, me)
    assert sorted((n.tab, n.kind) for n in got) == [("inbox", "account.new_phone"), ("orders", "order.accepted")]


@pytest.mark.parametrize(
    "template,params,link",
    [
        ("order.made_up", ORDER, None),  # no such template
        ("order.accepted", {"ref": "AKZ-1"}, None),  # a param missing
        ("order.accepted", ORDER, ("somewhere", "1")),  # a link the app can't open
    ],
)
def test_a_broken_alert_is_dropped_not_half_written(app, client, me, template, params, link):
    publish(me, template, link=link, **params)
    assert rows(app, me) == []


def test_switches_stop_their_topic_but_never_security(app, client, me):
    r = client.put(SETTINGS, headers=me.headers, json={"orders": False, "jobs": False, "credit": False})
    assert r.status_code == 200 and r.get_json()["data"]["settings"] == {"orders": False, "jobs": False, "credit": False, "security": True}
    publish(me, "order.accepted", **ORDER)
    publish(me, "job.done", job="Room extension")
    publish(me, "credit.due_today", customers="2 customers", amount_cents=14_000)
    publish(me, "account.password_changed")
    assert [n.kind for n in rows(app, me)] == ["account.password_changed"]


# ------------------------------------------------------------------ reading


def test_the_list_is_newest_first_rendered_and_paged(app, client, me):
    for i in range(5):
        publish(me, "order.on_its_way_cash", dedupe=f"o:{i}", link=("order", f"o-{i}"), **{**ORDER, "ref": f"AKZ-{i}"})
    publish(me, "job.done", job="Room extension")  # the other tab
    first = listed(client, me, "orders", limit=2)
    items = first["notifications"]
    assert [n["body"] for n in items] == [
        "Mahlangu Wholesale is delivering AKZ-4. Have R2,340 cash ready.",
        "Mahlangu Wholesale is delivering AKZ-3. Have R2,340 cash ready.",
    ]
    assert items[0]["title"] == "On its way" and items[0]["icon"] == "truck" and items[0]["tab"] == "orders"
    assert items[0]["link"] == {"type": "order", "id": "o-4"} and items[0]["read_at"] is None
    second = listed(client, me, "orders", limit=2, before=first["next_before"])
    third = listed(client, me, "orders", limit=2, before=second["next_before"])
    assert [re.search(r"AKZ-\d", n["body"]).group() for n in second["notifications"] + third["notifications"]] == ["AKZ-2", "AKZ-1", "AKZ-0"]
    assert third["next_before"] is None
    assert [n["kind"] for n in listed(client, me, "inbox")["notifications"]] == ["job.done"]


def test_unread_counts_per_tab_and_the_newest_id(client, me):
    assert unread(client, me) == {"orders": 0, "inbox": 0, "latest_id": None}
    publish(me, "order.accepted", **ORDER)
    publish(me, "job.done", job="Room extension")
    publish(me, "account.new_phone")
    u = unread(client, me)
    assert u["orders"] == 1 and u["inbox"] == 2 and u["latest_id"] == listed(client, me, "inbox")["notifications"][0]["id"]


def test_reading_one_is_once_and_says_the_new_counts(client, me):
    publish(me, "order.accepted", **ORDER)
    n = listed(client, me, "orders")["notifications"][0]
    r = client.post(f"{BASE}/{n['id']}/read", headers=me.headers)
    body = r.get_json()["data"]
    assert r.status_code == 200 and body["notification"]["read_at"] and body["unread"]["orders"] == 0
    again = client.post(f"{BASE}/{n['id']}/read", headers=me.headers).get_json()["data"]
    assert again["notification"]["read_at"] == body["notification"]["read_at"]


def test_read_all_is_that_tab_only(client, me):
    publish(me, "order.accepted", **ORDER)
    publish(me, "order.paid", **ORDER)
    publish(me, "job.done", job="Room extension")
    r = client.post(f"{BASE}/read-all", headers=me.headers, json={"tab": "orders"})
    assert r.status_code == 200 and r.get_json()["data"]["unread"]["orders"] == 0 and r.get_json()["data"]["unread"]["inbox"] == 1


# --------------------------------------------------------------------- IDOR


def test_nobody_else_sees_or_marks_my_alerts(client, me, other):
    publish(me, "order.accepted", **ORDER)
    mine = listed(client, me, "orders")["notifications"][0]
    assert listed(client, other, "orders")["notifications"] == []
    assert unread(client, other) == {"orders": 0, "inbox": 0, "latest_id": None}
    assert client.post(f"{BASE}/{mine['id']}/read", headers=other.headers).status_code == 404
    assert client.get(BASE, headers=other.headers, query_string={"tab": "orders", "before": mine["id"]}).status_code == 404
    client.post(f"{BASE}/read-all", headers=other.headers, json={"tab": "orders"})
    assert unread(client, me)["orders"] == 1


# ---------------------------------------------------------------- settings


def test_settings_start_on_and_changes_are_audited(app, client, me):
    since = datetime.now(timezone.utc)
    assert client.get(SETTINGS, headers=me.headers).get_json()["data"]["settings"] == {"orders": True, "jobs": True, "credit": True, "security": True}
    client.put(SETTINGS, headers=me.headers, json={"orders": True, "jobs": False, "credit": True})
    with app.app_context():
        rows_ = AuditEventRecord.query.filter(AuditEventRecord.event_name == "notification.settings_changed", AuditEventRecord.timestamp >= since).all()
        meta = [r.event_metadata for r in rows_]
    assert meta == [{"switch": "jobs", "on": False}]


# --------------------------------------------------------------- clean-up


def test_alerts_older_than_90_days_are_deleted(app, client, me):
    publish(me, "order.accepted", dedupe="old", **ORDER)
    publish(me, "order.paid", dedupe="new", **ORDER)
    with app.app_context():
        old = Notification.query.filter_by(dedupe_key="old").one()
        old.created_at = datetime.now(timezone.utc) - timedelta(days=91)
        db.session.commit()
        result = cleanup_old.run()
    assert result.success and result.count == 1
    assert [n.dedupe_key for n in rows(app, me)] == ["new"]


# --------------------------------------------------------------- templates


SAMPLE = {
    "ref": "AKZ-1", "supplier": "Mahlangu", "total_cents": 100, "minutes": 15, "stage": "Walls", "job": "Room extension",
    "amount_cents": 100, "owner": "Nomsa", "partner": "Thabo", "builder": "Sipho", "trade": "plumber", "stages": "Final",
    "pay": "R4,500", "day": "Tue 29 Sep", "suburb": "Tembisa", "customers": "2 customers",
}  # fmt: skip


@pytest.mark.parametrize("kind", sorted(TEMPLATES))
def test_every_template_renders_with_its_params(kind):
    title, body = render(kind, SAMPLE)
    assert title and body and "{" not in body and "{" not in title
    assert placeholders(TEMPLATES[kind]) <= {k.removesuffix("_cents") for k in SAMPLE}


def test_no_template_can_carry_an_ip_email_phone_or_a_clients_details():
    for kind, t in TEMPLATES.items():
        assert "{" not in t.title, kind  # titles are fixed text
        for name in placeholders(t):
            for banned in ("ip", "email", "phone", "address", "street", "client", "customer_name", "note", "device"):
                assert banned not in name.lower(), (kind, name)


def test_only_the_provider_verified_alert_says_paid():
    # "Paid" as a fact (title or "confirmed by the payment provider") only after mark_paid;
    # "wasn't paid" and a partner's own "says they paid you" are not claims of payment.
    titled_paid = [k for k, t in TEMPLATES.items() if "paid" in t.title.lower()]
    provider = [k for k, t in TEMPLATES.items() if "payment provider" in t.body or "paid in the app" in t.body.lower()]
    assert titled_paid == ["order.paid"] and provider == ["order.paid"]


def test_the_locked_alert_never_says_why():
    t = TEMPLATES["account.locked"]
    text = (t.title + " " + t.body).lower()
    assert "password 5" not in text and "wrong" not in text and "times" not in text


def test_a_stored_alert_whose_params_went_missing_still_renders(app, client, me):
    publish(me, "order.accepted", **ORDER)
    with app.app_context():
        n = Notification.query.one()
        n.params = {}
        db.session.commit()
    body = listed(client, me, "orders")["notifications"][0]["body"]
    assert body == " accepted ."
    assert json.dumps(body)
