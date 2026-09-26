"""
The trader-facing supplier API: the recommendation engine, supplier pages,
catalogues, and connections. Loaded with the real seed feeds.
"""
from __future__ import annotations

import re
import uuid
from pathlib import Path

import pytest

from src.domains.supplier.connections.models import SupplierConnection
from src.domains.supplier.integration.services.feed_loader import load_directory
from src.domains.supplier.recommendation.services import recommendation_service
from src.domains.supplier.supplier_profile.models import Supplier
from src.extensions import db
from src.shared.constants.categories import CATEGORIES

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
SEED = Path(__file__).resolve().parents[3] / "seed" / "suppliers"

# A spaza in Tembisa that buys groceries and drinks, delivered.
PROFILE = {
    "business": {"business_name": "Nomsa's Spaza", "business_type": "spaza", "trade": None, "owner_name": "Nomsa Dlamini", "years_trading": "3_plus", "cellphone": "082 123 4567"},
    "location": {"building": "", "street": "Andrew Mapheto Drive", "suburb": "Tembisa", "city": "Ekurhuleni", "province": "Gauteng", "postal_code": "1632", "latitude": -25.9964, "longitude": 28.2268},
    "buying": {"categories": ["food_grocery", "beverages"], "restock": "weekly", "spend": "1k_5k", "payment": "both", "fulfilment": "delivery"},
}
NEVER_SHOWN = {"orders_email", "legal_name", "vat_number", "phone", "payout_merchant_id", "external_id", "product_code", "unit_barcode", "case_barcode", "stock_qty"}


def signed_in(client, outbox, email) -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def seeded(app):
    with app.app_context():
        for folder in sorted(p for p in SEED.iterdir() if p.is_dir()):
            load_directory(folder, source="seed", verified=True)
        return {s.trading_name: str(s.id) for s in Supplier.query.all()}


@pytest.fixture
def me(client, outbox, seeded):
    headers = signed_in(client, outbox, "nomsa@example.com")
    assert client.patch("/api/v1/me/business-profile", headers=headers, json=PROFILE).status_code == 200
    return headers


def data(r):
    assert r.status_code == 200, r.get_json()
    return r.get_json()["data"]


def keys_everywhere(obj) -> set[str]:
    if isinstance(obj, dict):
        return set(obj) | set().union(*(keys_everywhere(v) for v in obj.values()))
    if isinstance(obj, list):
        return set().union(*(keys_everywhere(v) for v in obj)) if obj else set()
    return set()


# ------------------------------------------------------------------ access


@pytest.mark.parametrize(
    "method, url",
    [("get", "/api/v1/suppliers/recommended"), ("get", f"/api/v1/suppliers/{uuid.uuid4()}"), ("get", f"/api/v1/suppliers/{uuid.uuid4()}/products"),
     ("get", f"/api/v1/products/{uuid.uuid4()}"), ("get", "/api/v1/me/suppliers"), ("put", f"/api/v1/me/suppliers/{uuid.uuid4()}")],
)
def test_everything_needs_a_signed_in_trader(client, method, url):
    assert getattr(client, method)(url).status_code == 401


def test_no_pin_yet_asks_for_the_location(client, outbox, seeded):
    headers = signed_in(client, outbox, "new@example.com")
    r = client.get("/api/v1/suppliers/recommended", headers=headers)
    assert r.status_code == 409 and r.get_json()["code"] == "LOCATION_NEEDED"


# ------------------------------------------------------------------ engine


def test_every_supplier_is_ranked_none_hidden_best_first(client, me, seeded):
    suppliers = data(client.get("/api/v1/suppliers/recommended", headers=me))["suppliers"]
    names = [s["name"] for s in suppliers]
    assert len(suppliers) == 11
    assert names[0] in ("Mahlangu Wholesale", "Dlamini Drinks")  # sells what she buys and delivers to her
    assert names.index("Soweto Cash & Carry") > names.index("Mahlangu Wholesale")
    scores = [s["score"] for s in suppliers]
    assert scores == sorted(scores, reverse=True)


def test_reasons_are_honest(client, me, seeded):
    by_name = {s["name"]: s for s in data(client.get("/api/v1/suppliers/recommended", headers=me))["suppliers"]}
    mahlangu, soweto, ndlovu = by_name["Mahlangu Wholesale"], by_name["Soweto Cash & Carry"], by_name["Ndlovu Hardware"]
    assert mahlangu["delivers_to_you"] and mahlangu["within_reach"]
    assert "delivers to you" in mahlangu["reasons"][0]
    assert "outside their delivery area" in soweto["reasons"][0] and not soweto["within_reach"]
    assert ndlovu["shared_categories"] == [] and ndlovu["reasons"][1].startswith("Sells Building Materials")


def test_every_category_has_a_label_for_reasons():
    assert set(recommendation_service._LABELS) == set(CATEGORIES)


# ---------------------------------------------------------- supplier page


def test_supplier_page_is_public_facts_only(client, me, seeded):
    page = data(client.get(f"/api/v1/suppliers/{seeded['Mahlangu Wholesale']}", headers=me))["supplier"]
    assert page["name"] == "Mahlangu Wholesale" and page["verified"] is True
    assert page["reasons"] and page["distance_km"] < 5
    assert page["cash_limit_cents"] == 100_000  # theirs is R5,000; ours caps it at R1,000
    assert not NEVER_SHOWN & keys_everywhere(page)


def test_a_paused_supplier_is_gone(app, client, me, seeded):
    sid = seeded["Kasi Bakers"]
    with app.app_context():
        db.session.get(Supplier, uuid.UUID(sid)).status = "paused"
        db.session.commit()
    assert client.get(f"/api/v1/suppliers/{sid}", headers=me).status_code == 404
    assert client.get(f"/api/v1/suppliers/{sid}/products", headers=me).status_code == 404
    names = [s["name"] for s in data(client.get("/api/v1/suppliers/recommended", headers=me))["suppliers"]]
    assert "Kasi Bakers" not in names


# --------------------------------------------------------------- catalogue


def test_catalogue_pages_in_stock_first_and_hides_system_fields(client, me, seeded):
    url = f"/api/v1/suppliers/{seeded['Mahlangu Wholesale']}/products"
    first = data(client.get(url, headers=me))
    assert len(first["products"]) == 60 and first["has_more"] and first["total"] == 218
    assert not NEVER_SHOWN & keys_everywhere(first)
    last = data(client.get(url + "?page=4", headers=me))
    assert not last["has_more"] and len(last["products"]) == 218 - 180
    pages = [data(client.get(f"{url}?page={n}", headers=me))["products"] for n in range(1, 5)]
    levels = [p["stock"] for page in pages for p in page]
    first_out = levels.index("out")  # the seed has some out of stock
    assert first_out > 0 and set(levels[first_out:]) == {"out"}  # in stock first


def test_search_and_category(client, me, seeded):
    url = f"/api/v1/suppliers/{seeded['Mahlangu Wholesale']}/products"
    maize = data(client.get(url + "?q=MAIZE", headers=me))["products"]
    assert maize and all("maize" in p["name"].lower() for p in maize)
    drinks = data(client.get(url + "?category=beverages", headers=me))["products"]
    assert drinks and {p["category"] for p in drinks} == {"beverages"}
    # % and _ are literal characters, never wildcards.
    assert data(client.get(url + "?q=%25", headers=me))["products"] == []


@pytest.mark.parametrize("query", ["?category=airtime_electricity", "?page=0", "?page=abc", "?page=51", "?q=" + "x" * 61, "?q=a%00b"])
def test_bad_catalogue_queries_are_refused(client, me, seeded, query):
    r = client.get(f"/api/v1/suppliers/{seeded['Mahlangu Wholesale']}/products{query}", headers=me)
    assert r.status_code in (400, 422)


def test_one_product(client, me, seeded):
    url = f"/api/v1/suppliers/{seeded['Dlamini Drinks']}/products?q=cola"
    p = data(client.get(url, headers=me))["products"][0]
    one = data(client.get(f"/api/v1/products/{p['id']}", headers=me))["product"]
    assert one == p and one["units_per_pack"] in (12, 24)
    assert client.get(f"/api/v1/products/{uuid.uuid4()}", headers=me).status_code == 404


# ------------------------------------------------------------- connections


def test_connect_disconnect_and_history(app, client, me, seeded):
    sid = seeded["Mahlangu Wholesale"]
    assert data(client.put(f"/api/v1/me/suppliers/{sid}", headers=me))["connected"] is True
    assert data(client.put(f"/api/v1/me/suppliers/{sid}", headers=me))["connected"] is True  # twice is fine
    assert data(client.get("/api/v1/me/suppliers", headers=me))["supplier_ids"] == [sid]
    top = {s["name"]: s for s in data(client.get("/api/v1/suppliers/recommended", headers=me))["suppliers"]}
    assert top["Mahlangu Wholesale"]["connected"] is True and top["Dlamini Drinks"]["connected"] is False

    data(client.delete(f"/api/v1/me/suppliers/{sid}", headers=me))
    assert data(client.get("/api/v1/me/suppliers", headers=me))["supplier_ids"] == []
    data(client.put(f"/api/v1/me/suppliers/{sid}", headers=me))
    with app.app_context():
        rows = SupplierConnection.query.filter_by(supplier_id=uuid.UUID(sid)).all()
        assert len(rows) == 2 and sum(not r.is_deleted for r in rows) == 1  # history kept


def test_connections_are_private_and_need_a_real_supplier(client, outbox, me, seeded):
    client.put(f"/api/v1/me/suppliers/{seeded['Mahlangu Wholesale']}", headers=me)
    other = signed_in(client, outbox, "thabo@example.com")
    assert data(client.get("/api/v1/me/suppliers", headers=other))["supplier_ids"] == []
    assert client.put(f"/api/v1/me/suppliers/{uuid.uuid4()}", headers=me).status_code == 404
    assert client.put("/api/v1/me/suppliers/not-a-uuid", headers=me).status_code == 404


@pytest.mark.parametrize(
    "place, lat, lng, expected_first",
    [
        ("Turfloop (University of Limpopo), Mankweng", -23.8833, 29.7333, "Mokgalaka Wholesale"),
        ("Sefako Makgatho University, Ga-Rankuwa", -25.6170, 27.9970, "Molefe Cash & Carry"),
    ],
)
def test_the_demo_places_get_a_supplier_that_delivers(client, outbox, seeded, place, lat, lng, expected_first):
    """The team demos from these two places: the Suppliers tab must be true there."""
    headers = signed_in(client, outbox, "demo@example.com")
    profile = {**PROFILE, "location": {**PROFILE["location"], "latitude": lat, "longitude": lng}}
    assert client.patch("/api/v1/me/business-profile", headers=headers, json=profile).status_code == 200
    top = data(client.get("/api/v1/suppliers/recommended", headers=headers))["suppliers"][0]
    assert top["name"] == expected_first, place
    assert top["delivers_to_you"] and top["distance_km"] < 5
