"""
The 11 trades (QUESTION_trades.txt, approved): one list everywhere, sign-up
takes each of them and nothing else, and every trade knows what it buys.
"""
from __future__ import annotations

import re

import pytest

from src.domains.informal_trader.builder_network.constants import TRADES as NETWORK_TRADES
from src.domains.informal_trader.business_profile.constants import TRADES
from src.domains.informal_trader.jobs.services.jobs_signals import TRADE_CATEGORIES
from src.shared.constants.categories import CATEGORIES

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
URL = "/api/v1/me/business-profile"
ELEVEN = ("general_builder", "bricklayer", "plumber", "electrician", "carpenter", "roofer", "tiler", "painter", "welder", "glazier", "other_trade")


@pytest.fixture
def me(client, outbox):
    client.post("/api/v1/auth/register", json={"email": "sipho@example.com", "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": "sipho@example.com", "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_one_list_everywhere():
    assert TRADES == ELEVEN
    assert tuple(NETWORK_TRADES) == ELEVEN
    assert tuple(TRADE_CATEGORIES) == ELEVEN
    for trade, cats in TRADE_CATEGORIES.items():
        assert cats and set(cats) <= set(CATEGORIES), trade


@pytest.mark.parametrize("trade", ELEVEN)
def test_sign_up_takes_each_trade(client, me, trade):
    r = client.patch(URL, headers=me, json={"business": {"business_name": "Sipho Builds", "business_type": "builder", "trade": trade}})
    assert r.status_code == 200, r.get_json()
    assert client.get(URL, headers=me).get_json()["data"]["profile"]["business"]["trade"] == trade


@pytest.mark.parametrize("trade", ["painter_tiler", "handyman", "paver", "Plumber", ""])
def test_sign_up_refuses_anything_else(client, me, trade):
    r = client.patch(URL, headers=me, json={"business": {"business_name": "Sipho Builds", "business_type": "builder", "trade": trade}})
    assert r.status_code == 422


def test_a_new_builder_profile_starts_from_the_sign_up_trade(client, me):
    client.patch(URL, headers=me, json={"business": {"business_name": "Sipho Builds", "business_type": "builder", "trade": "welder"}})
    profile = client.get("/api/v1/me/builder-profile", headers=me).get_json()["data"]["profile"]
    assert profile["trades"] == ["welder"]
