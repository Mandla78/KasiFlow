"""
Business profile: sign-up answers saved on the server, edited one section
at a time, and a CIPC badge only the server can award.
"""
from __future__ import annotations

import re

import pytest

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}
URL = "/api/v1/me/business-profile"

BUSINESS = {"business_name": "Nomsa's Spaza", "business_type": "spaza", "trade": None, "owner_name": "Nomsa Dlamini", "years_trading": "3_plus", "cellphone": "082 123 4567"}
LOCATION = {
    "building": "", "street": "Andrew Mapheto Drive", "suburb": "Tembisa", "city": "Ekurhuleni",
    "province": "Gauteng", "postal_code": "1632", "latitude": -25.9964, "longitude": 28.2268,
}
BUYING = {"categories": ["food_grocery", "beverages"], "restock": "weekly", "spend": None, "payment": "both", "fulfilment": "delivery"}
EVERYTHING = {
    "business": BUSINESS,
    "registration": {"sole_trader": True, "cipc_number": None},
    "location": LOCATION,
    "buying": BUYING,
    "tools": {"creditBook": True, "orderStock": True, "myRecord": True, "jobs": False},
}


def signed_in(client, outbox, email="nomsa@example.com") -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def me(client, outbox):
    return signed_in(client, outbox)


def patch(client, headers, body):
    return client.patch(URL, headers=headers, json=body)


def test_needs_a_token(client):
    assert client.get(URL).status_code == 401
    assert client.patch(URL, json={}).status_code == 401


def test_nothing_saved_yet(client, me):
    r = client.get(URL, headers=me)
    assert r.status_code == 200 and r.get_json()["data"]["profile"] is None


def test_onboarding_saves_everything(client, me):
    r = patch(client, me, EVERYTHING)
    assert r.status_code == 200
    p = r.get_json()["data"]["profile"]
    assert p["onboarded"] is True and p["verified"] is False
    assert p["business"]["cellphone"] == "0821234567"  # spaces dropped
    assert p["location"]["suburb"] == "Tembisa" and p["buying"]["categories"] == ["food_grocery", "beverages"]
    assert client.get(URL, headers=me).get_json()["data"]["profile"] == p


def test_partial_save_leaves_other_sections_alone(client, me):
    patch(client, me, EVERYTHING)
    p = patch(client, me, {"buying": {**BUYING, "fulfilment": "collect"}}).get_json()["data"]["profile"]
    assert p["buying"]["fulfilment"] == "collect"
    assert p["business"]["owner_name"] == "Nomsa Dlamini" and p["location"]["suburb"] == "Tembisa"


def test_not_onboarded_until_complete(client, me):
    p = patch(client, me, {"business": BUSINESS}).get_json()["data"]["profile"]
    assert p["onboarded"] is False and p["location"] is None


def test_my_record_cannot_be_switched_off(client, me):
    p = patch(client, me, {"tools": {"myRecord": False, "creditBook": True}}).get_json()["data"]["profile"]
    assert p["tools"]["myRecord"] is True and p["tools"]["jobs"] is False


def test_cipc_director_match_earns_the_badge(client, me):
    patch(client, me, {"business": BUSINESS})
    p = patch(client, me, {"registration": {"sole_trader": False, "cipc_number": "2020/123456/07"}}).get_json()["data"]["profile"]
    assert p["verified"] is True
    assert p["registration"]["cipc"]["status"] == "verified"
    assert p["registration"]["cipc"]["registered_name"] == "N DLAMINI TRADING (PTY) LTD"


def test_someone_elses_company_is_not_verified(client, me):
    patch(client, me, {"business": BUSINESS})
    p = patch(client, me, {"registration": {"sole_trader": False, "cipc_number": "2021/654321/07"}}).get_json()["data"]["profile"]
    assert p["verified"] is False and p["registration"]["cipc"]["status"] == "owner_unconfirmed"


def test_changing_the_owner_name_rechecks(client, me):
    patch(client, me, {"business": BUSINESS, "registration": {"sole_trader": False, "cipc_number": "2020/123456/07"}})
    p = patch(client, me, {"business": {**BUSINESS, "owner_name": "Thabo Mokoena"}}).get_json()["data"]["profile"]
    assert p["verified"] is False and p["registration"]["cipc"]["status"] == "owner_unconfirmed"


def test_other_cipc_outcomes(client, me):
    patch(client, me, {"business": BUSINESS})
    for number, status in (("2019/111111/07", "deregistered"), ("2022/000000/07", "not_found"), ("2018/999999/07", "unavailable")):
        p = patch(client, me, {"registration": {"sole_trader": False, "cipc_number": number}}).get_json()["data"]["profile"]
        assert p["registration"]["cipc"]["status"] == status


def test_the_app_cannot_set_its_own_cipc_status(client, me):
    r = patch(client, me, {"registration": {"sole_trader": False, "cipc_number": "2021/654321/07", "status": "verified"}})
    assert r.status_code == 422
    r = patch(client, me, {"verified": True})
    assert r.status_code == 422


def test_removing_the_number_removes_the_badge(client, me):
    patch(client, me, {"business": BUSINESS, "registration": {"sole_trader": False, "cipc_number": "2020/123456/07"}})
    p = patch(client, me, {"registration": {"sole_trader": True, "cipc_number": None}}).get_json()["data"]["profile"]
    assert p["verified"] is False and p["registration"]["cipc"] is None


def test_cipc_checks_are_capped_per_day(client, me):
    patch(client, me, {"business": BUSINESS})
    numbers = [f"2022/00000{i}/07" for i in range(5)]
    for n in numbers:
        assert patch(client, me, {"registration": {"sole_trader": False, "cipc_number": n}}).status_code == 200
    r = patch(client, me, {"registration": {"sole_trader": False, "cipc_number": "2022/000009/07"}})
    assert r.status_code == 429 and r.get_json()["code"] == "CIPC_CHECK_LIMIT"


@pytest.mark.parametrize(
    "body",
    [
        {"buying": {**BUYING, "categories": ["guns"]}},
        {"business": {**BUSINESS, "trade": "plumber"}},  # trade is for builders only
        {"business": {**BUSINESS, "cellphone": "12345"}},
        {"location": {**LOCATION, "latitude": 51.5, "longitude": -0.12}},  # London
        {"registration": {"sole_trader": True, "cipc_number": "2020/123456/07"}},
        {"registration": {"sole_trader": False, "cipc_number": "123"}},
        {"tools": {"admin": True}},
        {"business": {**BUSINESS, "business_type": "bank"}},
    ],
)
def test_bad_values_are_rejected(client, me, body):
    assert patch(client, me, body).status_code == 422


def test_each_trader_only_sees_their_own(client, outbox, me):
    patch(client, me, EVERYTHING)
    other = signed_in(client, outbox, email="thabo@example.com")
    assert client.get(URL, headers=other).get_json()["data"]["profile"] is None
