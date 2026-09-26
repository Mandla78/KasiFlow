"""
Notifications step 3: the hooks (CONTRACT_notifications.txt section 3).
Each action -> exactly one alert with the right template, to the RIGHT
person (never the one who acted); a retry or a refused action -> nothing
new; switches respected; what each alert may and may not say.
(order.paid is tested with the payment flow in commerce/test_payments.py.)
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import timedelta
from pathlib import Path

import pytest

from network_helpers import API, IVORY_PARK, builder, data, deal, job, stage_id
from notification_helpers import BASE, SETTINGS
from src.core.base_model import utcnow
from src.domains.commerce.orders.services import order_service
from src.domains.informal_trader.credit_book.services.credit_book_service import today
from src.domains.informal_trader.jobs.services import job_photo_service
from src.domains.platform.notifications.models import Notification
from src.domains.supplier.catalogue.models import Product
from src.domains.supplier.integration.services.feed_loader import load_directory
from src.domains.supplier.supplier_profile.models import Supplier
from src.shared.media.provider import get_provider
from src.shared.queue.queue import wait_until_idle

SEED = Path(__file__).resolve().parents[3] / "seed" / "suppliers"
PASSWORD = "Spaza2026!"


def alerts(app, user_id) -> list[Notification]:
    wait_until_idle(timeout=10)
    with app.app_context():
        return Notification.query.filter_by(user_id=uuid.UUID(str(user_id))).order_by(Notification.created_at).all()


def kinds(app, user_id) -> list[str]:
    """Sorted: each alert is written by one of several background workers,
    so two alerts from one action can land in either order."""
    return sorted(n.kind for n in alerts(app, user_id))


def shown(client, headers, tab="inbox") -> list[dict]:
    wait_until_idle(timeout=10)
    return client.get(BASE, headers=headers, query_string={"tab": tab}).get_json()["data"]["notifications"]


def one(client, headers, kind, tab="inbox") -> dict:
    found = [n for n in shown(client, headers, tab) if n["kind"] == kind]
    assert len(found) == 1, (kind, [n["kind"] for n in shown(client, headers, tab)])
    return found[0]


def rand(cents: int) -> str:
    whole, part = divmod(cents, 100)
    return f"R{whole:,}" + (f".{part:02d}" if part else "")


@pytest.fixture
def nomsa(client, outbox):
    return builder(client, outbox, "nomsa@example.com", "Nomsa Dlamini", phone="0821111111")


@pytest.fixture
def thabo(client, outbox):
    return builder(client, outbox, "thabo@example.com", "Thabo Nkosi", trade="plumber", pin=IVORY_PARK, suburb="Ivory Park", phone="0761234501")


# ---------------------------------------------------------- supplier orders


@pytest.fixture
def supplier(app):
    with app.app_context():
        load_directory(SEED / "mahlangu-wholesale", source="seed", verified=True)
        s = Supplier.query.one()
        p = next(p for p in Product.query.filter_by(supplier_id=s.id).order_by(Product.price_cents) if p.stock_qty >= 50 and p.max_qty >= 50)
        return {"id": str(s.id), "product": str(p.id), "qty": -(-s.minimum_order_cents // p.price_cents)}


def order_body(s, payment="cash"):
    return {"supplier_id": s["id"], "lines": [{"product_id": s["product"], "qty": s["qty"]}], "fulfilment": "delivery", "payment": payment}


def test_an_order_tells_the_trader_each_step_the_supplier_takes(app, client, nomsa, supplier):
    client.put(f"{API}/me/suppliers/{supplier['id']}", headers=nomsa.headers)
    r = client.post(f"{API}/me/orders", headers=nomsa.headers, json=order_body(supplier))
    assert r.status_code == 201, r.get_json()
    o = r.get_json()["data"]["order"]
    with app.app_context():
        order_service.supplier_move(uuid.UUID(o["id"]), "accepted")
        order_service.supplier_move(uuid.UUID(o["id"]), "out_for_delivery")
        with pytest.raises(Exception):
            order_service.supplier_move(uuid.UUID(o["id"]), "collected")  # refused: no alert
    assert kinds(app, nomsa.id) == sorted(["order.sent", "order.accepted", "order.on_its_way_cash"])
    on_way = one(client, nomsa.headers, "order.on_its_way_cash", "orders")
    assert on_way["body"] == f"{o['supplier_name']} is delivering {o['reference']}. Have {rand(o['total_cents'])} cash ready."
    assert on_way["link"] == {"type": "order", "id": o["id"]}


def test_cancelling_your_own_order_is_not_an_alert_and_an_unpaid_one_lapses_once(app, client, nomsa, supplier):
    client.put(f"{API}/me/suppliers/{supplier['id']}", headers=nomsa.headers)
    cash = client.post(f"{API}/me/orders", headers=nomsa.headers, json=order_body(supplier)).get_json()["data"]["order"]
    client.post(f"{API}/me/orders/{cash['id']}/cancel", headers=nomsa.headers)
    digital = client.post(f"{API}/me/orders", headers=nomsa.headers, json=order_body(supplier, "in_app")).get_json()["data"]["order"]
    with app.app_context():
        order_service.expire_unpaid(utcnow() + timedelta(hours=25))
        order_service.expire_unpaid(utcnow() + timedelta(hours=26))  # again: nothing new
    assert kinds(app, nomsa.id) == sorted(["order.sent", "order.awaiting_payment", "order.expired"])
    assert digital["reference"] in one(client, nomsa.headers, "order.expired", "orders")["body"]


def test_orders_switched_off_means_no_order_alerts(app, client, nomsa, supplier):
    client.put(SETTINGS, headers=nomsa.headers, json={"orders": False, "jobs": True, "credit": True})
    client.put(f"{API}/me/suppliers/{supplier['id']}", headers=nomsa.headers)
    client.post(f"{API}/me/orders", headers=nomsa.headers, json=order_body(supplier))
    assert kinds(app, nomsa.id) == []


# ---------------------------------------------------------------- account


def test_a_locked_account_tells_its_owner_once_and_never_why(app, client, nomsa):
    email = "nomsa@example.com"
    for _ in range(5):
        client.post(f"{API}/auth/login", json={"email": email, "password": "Wrong2026!"})
    client.post(f"{API}/auth/login", json={"email": email, "password": "Wrong2026!"})  # while locked: no second alert
    assert kinds(app, nomsa.id) == ["account.locked"]
    body = one(client, nomsa.headers, "account.locked")["body"]
    assert "15 minutes" in body and "wrong" not in body.lower() and "password 5" not in body


def test_password_changed_and_phones_signed_out(app, client, nomsa):
    r = client.post(f"{API}/auth/change-password", headers=nomsa.headers, json={"current_password": PASSWORD, "new_password": "Spaza2027!"})
    assert r.status_code == 200, r.get_json()
    client.post(f"{API}/auth/logout-others", headers=nomsa.headers)
    assert kinds(app, nomsa.id) == sorted(["account.password_changed", "account.phones_signed_out"])


def test_signing_in_on_a_new_phone_tells_the_owner_but_sign_up_doesnt(app, client, outbox, nomsa):
    assert "account.new_phone" not in kinds(app, nomsa.id)
    outbox.clear()
    step1 = client.post(f"{API}/auth/login", json={"email": "nomsa@example.com", "password": PASSWORD}).get_json()["data"]
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    assert client.post(f"{API}/auth/login/verify", json={"challenge": step1["challenge"], "code": code}).status_code == 200
    assert kinds(app, nomsa.id).count("account.new_phone") == 1
    text = json.dumps([n.params for n in alerts(app, nomsa.id)]).lower()
    assert "127.0.0.1" not in text and "nomsa@example.com" not in text


def test_security_alerts_ignore_the_switches(app, client, nomsa):
    client.put(SETTINGS, headers=nomsa.headers, json={"orders": False, "jobs": False, "credit": False})
    client.post(f"{API}/auth/logout-others", headers=nomsa.headers)
    assert kinds(app, nomsa.id) == ["account.phones_signed_out"]


# ------------------------------------------------------------- job sign-off


@pytest.fixture(autouse=True)
def stored_photo_bytes(monkeypatch):
    monkeypatch.setattr(job_photo_service, "fetch_bytes", lambda url: b"photo")


def signed_off(client, who, j, stage, cents):
    form = client.post(f"{API}/me/jobs/{j['id']}/stages/{stage}/photo/upload-signature", headers=who.headers).get_json()["data"]
    get_provider().put(form["fields"]["public_id"])
    client.post(f"{API}/me/jobs/{j['id']}/stages/{stage}/photo", headers=who.headers, json={"public_id": form["fields"]["public_id"]})
    link = client.post(f"{API}/me/jobs/{j['id']}/stages/{stage}/sign-off", headers=who.headers, json={"builder_amount_cents": cents}).get_json()["data"]["link"]
    return link.split("ticket=")[1]


def test_the_clients_answers_reach_the_builder_and_the_last_one_says_done(app, client, nomsa):
    j = job(client, nomsa, stages=[{"name": "Walls", "amount_cents": 1_000_000}, {"name": "Roof", "amount_cents": 500_000}], total_cents=1_500_000)
    walls, roof = stage_id(j, "Walls"), stage_id(j, "Roof")
    client.post("/sign-off", data={"ticket": signed_off(client, nomsa, j, walls, 1_000_000), "answer": "done", "amount": "10000"})
    client.post("/sign-off", data={"ticket": signed_off(client, nomsa, j, roof, 500_000), "answer": "not_yet", "note": "Gutters not on"})
    client.post("/sign-off", data={"ticket": signed_off(client, nomsa, j, roof, 500_000), "answer": "done", "amount": "4000"})
    client.post("/sign-off", data={"ticket": signed_off(client, nomsa, j, roof, 400_000), "answer": "done", "amount": "4000"})
    assert kinds(app, nomsa.id) == sorted(["job.stage_confirmed", "job.not_yet", "job.amounts_dont_match", "job.stage_confirmed", "job.done"])
    texts = [n["title"] + " " + n["body"] for n in shown(client, nomsa.headers)]
    assert "Job done Room extension: every stage confirmed by the client." in texts
    assert "Stage confirmed The client confirmed Walls of Room extension: R10,000." in texts
    for t in texts:  # never the client's name or phone, never the note they typed
        assert "Mokoena" not in t and "0821234567" not in t and "Gutters" not in t


# ------------------------------------------------------ the builder network


def test_an_invite_and_its_answer_reach_the_other_builder(app, client, nomsa, thabo):
    j = job(client, nomsa)
    p = data(client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json={"builder_id": thabo.id, **deal(j)}), "partner")
    assert kinds(app, nomsa.id) == [] and kinds(app, thabo.id) == ["partner.invited"]
    invite = one(client, thabo.headers, "partner.invited")
    assert invite["body"].startswith("Nomsa invites you: plumber, Final · R4,500 · starts ")
    assert invite["link"] == {"type": "invite", "id": p["id"]}
    client.post(f"{API}/me/partner-invites/{p['id']}/answer", headers=thabo.headers, json={"accept": True})
    assert kinds(app, nomsa.id) == ["partner.accepted"]
    assert one(client, nomsa.headers, "partner.accepted")["body"] == "Thabo is on Room extension. You have each other's number now."


def test_payments_between_partners_reach_the_other_side(app, client, nomsa, thabo):
    j = job(client, nomsa)
    p = data(client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json={"builder_id": thabo.id, **deal(j)}), "partner")
    client.post(f"{API}/me/partner-invites/{p['id']}/answer", headers=thabo.headers, json={"accept": True})
    paid = data(client.post(f"{API}/me/job-partners/{p['id']}/payments", headers=nomsa.headers, json={"amount_cents": 450_000}), "partner")
    first = paid["payments"][0]["id"]
    assert "partner.payment_recorded" in kinds(app, thabo.id)
    assert one(client, thabo.headers, "partner.payment_recorded")["body"] == "Nomsa says they paid you R4,500. Confirm what you got."
    client.post(f"{API}/me/partner-invites/{p['id']}/payments/{first}/confirm", headers=thabo.headers, json={"amount_cents": 450_000})
    paid = data(client.post(f"{API}/me/job-partners/{p['id']}/payments", headers=nomsa.headers, json={"amount_cents": 100_000}), "partner")
    second = next(x["id"] for x in paid["payments"] if x["id"] != first)
    client.post(f"{API}/me/partner-invites/{p['id']}/payments/{second}/confirm", headers=thabo.headers, json={"amount_cents": 90_000})
    assert kinds(app, nomsa.id) == sorted(["partner.accepted", "partner.payment_confirmed", "partner.payment_mismatch"])


def test_help_posts_interest_and_a_pick(app, client, nomsa, thabo):
    j = job(client, nomsa)
    post = data(client.post(f"{API}/me/jobs/{j['id']}/help-posts", headers=nomsa.headers, json={**deal(j, "Walls"), "suburb": "Tembisa"}), "post")
    client.post(f"{API}/help-posts/{post['id']}/interested", headers=thabo.headers)
    client.post(f"{API}/help-posts/{post['id']}/interested", headers=thabo.headers)  # again: one alert
    assert kinds(app, nomsa.id) == ["help.interested"]
    assert one(client, nomsa.headers, "help.interested")["body"] == "Thabo can do your plumber post."
    client.post(f"{API}/me/help-posts/{post['id']}/pick", headers=nomsa.headers, json={"builder_id": thabo.id})
    assert kinds(app, thabo.id) == ["help.picked"]
    assert one(client, thabo.headers, "help.picked")["body"] == "Nomsa picked you: plumber, Walls in Tembisa · R4,500."


def test_partner_alerts_never_carry_the_clients_details_or_price(app, client, nomsa, thabo):
    j = job(client, nomsa)
    p = data(client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json={"builder_id": thabo.id, **deal(j)}), "partner")
    client.post(f"{API}/me/partner-invites/{p['id']}/answer", headers=thabo.headers, json={"accept": True})
    client.post(f"{API}/me/job-partners/{p['id']}/payments", headers=nomsa.headers, json={"amount_cents": 450_000})
    text = json.dumps(shown(client, thabo.headers))
    for secret in ["Mokoena", "0821234567", "R9,000", "900000", "R38,000", "3800000", "Room extension"]:
        assert secret not in text, secret


def test_jobs_switched_off_means_no_job_or_partner_alerts(app, client, nomsa, thabo):
    client.put(SETTINGS, headers=thabo.headers, json={"orders": True, "jobs": False, "credit": True})
    j = job(client, nomsa)
    client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json={"builder_id": thabo.id, **deal(j)})
    assert kinds(app, thabo.id) == []


def test_a_refused_action_leaves_no_alert(app, client, nomsa, thabo):
    j = job(client, nomsa)
    p = data(client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json={"builder_id": thabo.id, **deal(j)}), "partner")
    r = client.post(f"{API}/me/job-partners/{p['id']}/payments", headers=nomsa.headers, json={"amount_cents": 450_000})
    assert r.status_code == 409  # not accepted yet
    assert kinds(app, thabo.id) == ["partner.invited"]


# ------------------------------------------------------ credit due today


def credit_sale(client, who, name, cents, due_in=0):
    body = {"customer": {"name": name}, "amount_cents": cents, "description": "", "due_on": (today() + timedelta(days=due_in)).isoformat()}
    assert client.post(f"{API}/me/credit-book/entries", headers=who.headers, json=body).status_code == 201


def poll(client, who) -> dict:
    return client.get(f"{BASE}/unread", headers=who.headers).get_json()["data"]["unread"]


def test_pay_backs_due_today_once_a_day_with_no_names(app, client, nomsa):
    credit_sale(client, nomsa, "Thandi Mokoena", 4_800)
    credit_sale(client, nomsa, "Sipho Dube", 9_200)
    credit_sale(client, nomsa, "Lerato", 1_000, due_in=3)
    poll(client, nomsa)
    poll(client, nomsa)  # the 20 s poll again: no second alert
    assert kinds(app, nomsa.id) == ["credit.due_today"]
    alert = one(client, nomsa.headers, "credit.due_today")
    assert alert["body"] == "2 customers pay you back today: R140." and alert["link"] == {"type": "credit", "id": None}
    assert "Thandi" not in alert["body"] and "Sipho" not in alert["body"]
    assert poll(client, nomsa)["inbox"] == 1


def test_nothing_due_or_the_credit_switch_off_means_no_alert(app, client, outbox, nomsa):
    credit_sale(client, nomsa, "Lerato", 1_000, due_in=3)
    poll(client, nomsa)
    assert kinds(app, nomsa.id) == []
    other = builder(client, outbox, "sipho@example.com", "Sipho Dube", phone="0821112222")
    client.put(SETTINGS, headers=other.headers, json={"orders": True, "jobs": True, "credit": False})
    credit_sale(client, other, "Thandi", 4_800)
    poll(client, other)
    assert kinds(app, other.id) == []


def test_a_broken_alert_never_breaks_the_action(app, client, monkeypatch, nomsa, thabo):
    from src.domains.informal_trader.builder_network.services import network_alerts

    def broken(key):
        raise RuntimeError("a bug while building the alert")

    monkeypatch.setattr(network_alerts, "_trade", broken)
    j = job(client, nomsa)
    r = client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json={"builder_id": thabo.id, **deal(j)})
    assert r.status_code == 201  # the invite is saved and answered normally
    assert kinds(app, thabo.id) == []
