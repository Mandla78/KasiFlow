"""
Digital payment through PayFast: the signature built exactly as PayFast
builds it, the pay page, and the notification (ITN) that marks an order
paid only after all four checks.
"""
from __future__ import annotations

import hashlib
import re
import uuid
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlencode

import pytest

from src.core.base_model import utcnow
from src.domains.commerce.orders.models import Order
from src.domains.commerce.payments.models import Payment
from src.domains.commerce.payments.services import payfast
from src.domains.supplier.catalogue.models import Product
from src.domains.supplier.integration.services.feed_loader import load_directory
from src.domains.supplier.supplier_profile.models import Supplier
from src.extensions import db

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}
SEED = Path(__file__).resolve().parents[3] / "seed" / "suppliers"
PROFILE = {
    "business": {"business_name": "Nomsa's Spaza", "business_type": "spaza", "trade": None, "owner_name": "Nomsa Dlamini", "years_trading": "3_plus", "cellphone": "082 123 4567"},
    "location": {"building": "", "street": "Andrew Mapheto Drive", "suburb": "Tembisa", "city": "Ekurhuleni", "province": "Gauteng", "postal_code": "1632", "latitude": -25.9964, "longitude": 28.2268},
    "buying": {"categories": ["food_grocery"], "restock": "weekly", "spend": "1k_5k", "payment": "both", "fulfilment": "delivery"},
}
PAYFAST_IP = "197.97.145.144"
PASSPHRASE = "test-pass_phrase/1"


@pytest.fixture
def payfast_on(app, monkeypatch):
    monkeypatch.setitem(app.config, "PAYFAST_MERCHANT_ID", "10000100")
    monkeypatch.setitem(app.config, "PAYFAST_MERCHANT_KEY", "46f0cd694581a")
    monkeypatch.setitem(app.config, "PAYFAST_PASSPHRASE", PASSPHRASE)
    monkeypatch.setitem(app.config, "APP_BASE_URL", "https://akayza.example.com")
    monkeypatch.setattr(payfast, "payfast_ips", lambda: {PAYFAST_IP})
    confirmed = {"answer": True}
    monkeypatch.setattr(payfast, "confirmed_by_payfast", lambda posted: confirmed["answer"])
    return confirmed


@pytest.fixture
def order(app, client, outbox, payfast_on):
    """A signed-in trader with an unpaid digital order: (headers, order json)."""
    with app.app_context():
        load_directory(SEED / "mahlangu-wholesale", source="seed", verified=True)
        s = Supplier.query.one()
        p = next(p for p in Product.query.filter_by(supplier_id=s.id).order_by(Product.price_cents) if p.stock_qty >= 50)
        sid, pid, qty = str(s.id), str(p.id), -(-s.minimum_order_cents // p.price_cents)
    client.post("/api/v1/auth/register", json={"email": "nomsa@example.com", "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": "nomsa@example.com", "code": code}).get_json()["data"]["access_token"]
    me = {"Authorization": f"Bearer {token}"}
    client.patch("/api/v1/me/business-profile", headers=me, json=PROFILE)
    client.put(f"/api/v1/me/suppliers/{sid}", headers=me)
    r = client.post("/api/v1/me/orders", headers=me, json={"supplier_id": sid, "lines": [{"product_id": pid, "qty": qty}], "fulfilment": "delivery", "payment": "in_app"})
    assert r.status_code == 201, r.get_json()
    return me, r.get_json()["data"]["order"]


def pay_link(client, me, order_json) -> str:
    r = client.post(f"/api/v1/me/orders/{order_json['id']}/pay", headers=me)
    assert r.status_code == 200, r.get_json()
    return r.get_json()["data"]["pay_url"]


def itn(app, order_json, *, status="COMPLETE", amount=None, passphrase=PASSPHRASE, tamper=False) -> list[tuple[str, str]]:
    """What PayFast posts, in PayFast's order, signed like PayFast signs it."""
    with app.app_context():
        payment = Payment.query.filter_by(order_id=uuid.UUID(order_json["id"])).order_by(Payment.created_at.desc()).first()
    gross = amount if amount is not None else f"{order_json['total_cents'] / 100:.2f}"
    posted = [
        ("m_payment_id", str(payment.id)), ("pf_payment_id", "1089250"), ("payment_status", status),
        ("item_name", f"Order {order_json['reference']}"), ("item_description", "Mahlangu Wholesale via Akayza"),
        ("amount_gross", gross), ("amount_fee", "-2.30"), ("amount_net", "97.70"),
        ("name_first", "Nomsa"), ("name_last", "Dlamini"), ("email_address", "nomsa@example.com"), ("merchant_id", "10000100"),
    ]
    base = "&".join(f"{k}={payfast._enc(v)}" for k, v in posted) + f"&passphrase={payfast._enc(passphrase)}"
    posted.append(("signature", hashlib.md5(base.encode()).hexdigest()))
    if tamper:
        posted[5] = ("amount_gross", "0.01")  # changed after signing
    return posted


def notify(client, posted, ip=PAYFAST_IP):
    # Encoded by hand to keep PayFast's field order (it matters for the signature).
    return client.post(
        "/api/v1/payments/payfast/notify", data=urlencode(posted), content_type="application/x-www-form-urlencoded", environ_base={"REMOTE_ADDR": ip}
    )


def order_now(client, me, order_json) -> dict:
    return client.get(f"/api/v1/me/orders/{order_json['id']}", headers=me).get_json()["data"]["order"]


# ---------------------------------------------------------------- signature


def test_signature_is_built_exactly_like_payfast(app):
    fields = {
        "amount": "100.00", "merchant_id": "10000100", "merchant_key": "46f0cd694581a",  # out of order on purpose
        "item_name": "Order AKZ-2026-000101 & co", "name_first": "", "return_url": "https://a.example.com/pay/done?order=AKZ-2026-000101",
    }
    expected_string = (
        "merchant_id=10000100&merchant_key=46f0cd694581a"
        "&return_url=https%3A%2F%2Fa.example.com%2Fpay%2Fdone%3Forder%3DAKZ-2026-000101"
        "&amount=100.00&item_name=Order+AKZ-2026-000101+%26+co"
        "&passphrase=test-pass_phrase%2F1"
    )
    assert payfast.form_signature(fields, PASSPHRASE) == hashlib.md5(expected_string.encode()).hexdigest()
    assert payfast._enc("a~b*c") == "a%7Eb%2Ac"  # PHP urlencode, not Python's defaults


# ----------------------------------------------------------------- pay link


def test_the_pay_page_posts_a_signed_form_built_from_the_order(client, order):
    me, o = order
    url = pay_link(client, me, o)
    page = client.get(url.replace("https://akayza.example.com", "")).get_data(as_text=True)
    assert 'action="https://sandbox.payfast.co.za/eng/process"' in page
    assert f'name="amount" value="{o["total_cents"] // 100}.{o["total_cents"] % 100:02d}"' in page
    assert 'name="signature"' in page and "46f0cd694581a" in page
    assert PASSPHRASE not in page  # the passphrase never leaves the server


def test_only_an_unpaid_digital_order_can_be_paid(app, client, order):
    me, o = order
    with app.app_context():
        db.session.get(Order, uuid.UUID(o["id"])).pay_by = utcnow() - timedelta(minutes=1)
        db.session.commit()
    r = client.post(f"/api/v1/me/orders/{o['id']}/pay", headers=me)
    assert r.status_code == 409 and r.get_json()["code"] == "NOT_PAYABLE"


def test_no_payments_without_the_merchant_settings(app, client, order, monkeypatch):
    me, o = order
    monkeypatch.setitem(app.config, "PAYFAST_PASSPHRASE", "")
    r = client.post(f"/api/v1/me/orders/{o['id']}/pay", headers=me)
    assert r.status_code == 503 and r.get_json()["code"] == "PAYMENTS_NOT_READY"


def test_a_new_pay_link_cancels_the_old_one(client, order):
    me, o = order
    first = pay_link(client, me, o).replace("https://akayza.example.com", "")
    pay_link(client, me, o)
    assert "doesn't work any more" in client.get(first).get_data(as_text=True)


# -------------------------------------------------------------------- ITN


def test_a_verified_notification_pays_the_order_once(app, client, order, outbox):
    me, o = order
    pay_link(client, me, o)
    posted = itn(app, o)
    sent_before = len(outbox)
    assert notify(client, posted).status_code == 200
    emails = outbox[sent_before:]
    assert len(emails) == 1 and emails[0]["subject"] == f"Payment received for order {o['reference']}"
    assert o["reference"] in emails[0]["html_body"] and "1089250" in emails[0]["html_body"]
    paid = order_now(client, me, o)
    assert paid["status"] == "accepted" and paid["payment_status"] == "paid"  # paid = confirmed, no waiting
    notify(client, posted)  # PayFast repeats itself: no second email either
    assert len(outbox) == sent_before + 1
    assert [e["status"] for e in order_now(client, me, o)["events"]] == ["awaiting_payment", "accepted"]
    with app.app_context():
        p = Payment.query.one()
        assert p.status == "complete" and p.provider_reference == "1089250"
        assert "nomsa@example.com" not in str(p.itn_payload) and "Nomsa" not in str(p.itn_payload)


@pytest.mark.parametrize("case", ["bad_signature", "wrong_passphrase", "not_from_payfast", "wrong_amount", "not_confirmed"])
def test_every_check_must_pass(app, client, order, payfast_on, case):
    me, o = order
    pay_link(client, me, o)
    posted = itn(app, o, tamper=case == "bad_signature", passphrase="guess" if case == "wrong_passphrase" else PASSPHRASE,
                 amount="1.00" if case == "wrong_amount" else None)
    if case == "not_confirmed":
        payfast_on["answer"] = False
    notify(client, posted, ip="203.0.113.9" if case == "not_from_payfast" else PAYFAST_IP)
    assert order_now(client, me, o)["status"] == "awaiting_payment"


def test_a_cancelled_payment_leaves_the_order_waiting(app, client, order):
    me, o = order
    pay_link(client, me, o)
    notify(client, itn(app, o, status="CANCELLED"))
    assert order_now(client, me, o)["status"] == "awaiting_payment"
    with app.app_context():
        assert Payment.query.one().status == "cancelled"


def test_money_after_the_order_lapsed_is_kept_and_flagged_for_refund(app, client, order):
    from src.domains.commerce.orders.services import order_service

    me, o = order
    pay_link(client, me, o)
    posted = itn(app, o)
    with app.app_context():
        order_service.expire_unpaid(utcnow() + timedelta(hours=25))
    notify(client, posted)
    assert order_now(client, me, o)["status"] == "expired"
    with app.app_context():
        p = Payment.query.one()
        assert p.status == "complete" and "refund" in p.failure_reason
