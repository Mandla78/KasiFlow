"""
Invoices and receipts: in the supplier's name, the right kind for their
VAT status, only when the order is firm, and only through a signed link
that expires.
"""
from __future__ import annotations

import re
import time
import uuid
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

from src.domains.commerce.documents.services import document_service
from src.domains.commerce.orders.services import order_service
from src.domains.supplier.catalogue.models import Product
from src.domains.supplier.integration.services.feed_loader import load_directory
from src.domains.supplier.supplier_profile.models import Supplier

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}
SEED = Path(__file__).resolve().parents[3] / "seed" / "suppliers"


def profile_at(lat, lng):
    return {
        "business": {"business_name": "Nomsa's Spaza", "business_type": "spaza", "trade": None, "owner_name": "Nomsa Dlamini", "years_trading": "3_plus", "cellphone": "082 123 4567"},
        "location": {"building": "", "street": "Main Road", "suburb": "Mankweng", "city": "Polokwane", "province": "Limpopo", "postal_code": "0727", "latitude": lat, "longitude": lng},
        "buying": {"categories": ["food_grocery"], "restock": "weekly", "spend": "1k_5k", "payment": "both", "fulfilment": "delivery"},
    }


def trader(client, outbox, email):
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    client.patch("/api/v1/me/business-profile", headers=headers, json=profile_at(-23.8833, 29.7333))
    return headers


@pytest.fixture
def placed(app, client, outbox):
    """A cash order at Mokgalaka (VAT-registered) with a zero-rated and a standard-rated line."""
    with app.app_context():
        load_directory(SEED / "mokgalaka-wholesale", source="seed", verified=True)
        s = Supplier.query.one()
        products = Product.query.filter_by(supplier_id=s.id).filter(Product.stock_qty >= 20).all()
        zero = next(p for p in products if p.vat_rate == "zero")
        std = next(p for p in products if p.vat_rate == "standard" and p.price_cents < 20000)
        sid, lines = str(s.id), [{"product_id": str(zero.id), "qty": 2}, {"product_id": str(std.id), "qty": 2}]
    me = trader(client, outbox, "nomsa@example.com")
    client.put(f"/api/v1/me/suppliers/{sid}", headers=me)
    r = client.post("/api/v1/me/orders", headers=me, json={"supplier_id": sid, "lines": lines, "fulfilment": "collect", "payment": "cash"})
    assert r.status_code == 201, r.get_json()
    return me, r.get_json()["data"]["order"]


def link(client, me, order, kind):
    return client.post(f"/api/v1/me/orders/{order['id']}/documents/{kind}", headers=me)


def test_no_invoice_before_the_supplier_accepts(client, placed):
    me, o = placed
    r = link(client, me, o, "invoice")
    assert r.status_code == 409 and r.get_json()["code"] == "NOT_READY"
    assert link(client, me, o, "receipt").status_code == 409


def test_a_tax_invoice_in_the_suppliers_name_with_vat_per_line(app, client, placed):
    me, o = placed
    with app.app_context():
        order_service.supplier_move(uuid.UUID(o["id"]), "accepted")
        d = document_service.invoice(uuid.UUID(o["id"]))
    assert d["title"] == "Tax Invoice" and not d["full"]  # under R5,000: abridged
    assert d["supplier"]["vat_number"] == "4999000012" and d["supplier"]["email"].endswith(".example.com")
    # Buyer details on every invoice (required only above R5,000, shown always).
    assert d["buyer"]["business"] == "Nomsa's Spaza" and d["buyer"]["email"] == "nomsa@example.com"
    assert d["buyer"]["owner"] == "Nomsa Dlamini" and d["buyer"]["phone"]
    assert d["buyer"]["cipc_number"] is None  # none given: none shown
    assert d["number"] == "INV-" + o["reference"].removeprefix("AKZ-")
    zero, std = [l for l in d["lines"] if l.zero_rated], [l for l in d["lines"] if not l.zero_rated]
    assert zero and all(l.vat_cents == 0 for l in zero)
    assert std and all(l.vat_cents == round(l.total_cents * 15 / 115) for l in std)
    assert d["excl_cents"] + d["vat_cents"] == d["total_cents"] == o["total_cents"]

    url = link(client, me, o, "invoice").get_json()["data"]["url"]
    r = client.get(_path(url))
    assert r.status_code == 200 and r.mimetype == "application/pdf" and r.data.startswith(b"%PDF")


def test_a_supplier_not_registered_for_vat_gives_a_plain_invoice(app, client, placed):
    me, o = placed
    with app.app_context():
        s = Supplier.query.one()
        s.vat_number = None
        from src.extensions import db

        db.session.commit()
        order_service.supplier_move(uuid.UUID(o["id"]), "accepted")
        d = document_service.invoice(uuid.UUID(o["id"]))
    assert d["title"] == "Invoice" and d["vat_cents"] == 0 and "not registered for VAT" in d["note"]


def _path(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.path}?{parts.query}"


def test_links_are_signed_expire_and_are_private(app, client, outbox, placed):
    me, o = placed
    with app.app_context():
        order_service.supplier_move(uuid.UUID(o["id"]), "accepted")
    path = _path(link(client, me, o, "invoice").get_json()["data"]["url"])
    assert client.get(path).status_code == 200
    assert client.get(path.replace("/invoice/", "/receipt/")).status_code == 404  # signature is per kind
    sig = parse_qs(urlsplit(path).query)["sig"][0]
    forged = "f" * 64 if sig != "f" * 64 else "0" * 64
    assert client.get(path.replace(sig, forged)).status_code == 404  # altered
    q = parse_qs(urlsplit(path).query)
    old = f"/documents/invoice/{o['id']}?exp={int(time.time()) - 1}&sig={q['sig'][0]}"
    assert client.get(old).status_code == 404  # expired
    other = trader(client, outbox, "thabo@example.com")
    assert link(client, other, o, "invoice").status_code == 404


def test_a_receipt_once_the_money_is_confirmed(app, client, placed):
    me, o = placed
    oid = uuid.UUID(o["id"])
    with app.app_context():
        for step in ("accepted", "ready_for_collection", "collected"):
            order_service.supplier_move(oid, step)
        from src.domains.commerce.orders.models import Order
        from src.extensions import db

        db.session.get(Order, oid).payment_status = "confirmed_by_both"  # the cash handshake (Phase 5)
        db.session.commit()
        d = document_service.receipt(oid)
    assert d["method"] == "Cash, confirmed by both" and d["total_cents"] == o["total_cents"]
    assert client.get(_path(link(client, me, o, "receipt").get_json()["data"]["url"])).data.startswith(b"%PDF")


def test_a_given_cipc_number_is_on_the_invoice(app, client, placed):
    me, o = placed
    client.patch("/api/v1/me/business-profile", headers=me, json={"registration": {"sole_trader": False, "cipc_number": "2020/123456/07"}})
    with app.app_context():
        order_service.supplier_move(uuid.UUID(o["id"]), "accepted")
        buyer = document_service.invoice(uuid.UUID(o["id"]))["buyer"]
    assert buyer["cipc_number"] == "2020/123456/07"


def test_the_qr_opens_a_genuine_check_without_personal_details(app, client, placed):
    me, o = placed
    with app.app_context():
        order_service.supplier_move(uuid.UUID(o["id"]), "accepted")
        url = document_service.invoice(uuid.UUID(o["id"]))["verify_url"]
    page = client.get(_path(url)).get_data(as_text=True)
    assert "Genuine document" in page and o["reference"] in page
    assert "nomsa@example.com" not in page and "Nomsa" not in page
    number = url.split("/verify/")[1].split("?")[0]
    assert "can't confirm" in client.get(f"/verify/{number}?s=0000").get_data(as_text=True)
    other = number[:-1] + ("1" if number[-1] != "1" else "2")
    assert "can't confirm" in client.get(f"/verify/{other}?s={url.split('s=')[1]}").get_data(as_text=True)
