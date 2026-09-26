"""
Address search: our backend in front of Mapbox. Mapbox itself is faked
here (no network, no cost); scripts can check the real thing.
"""
from __future__ import annotations

import re

import pytest

from src.shared.geocoding import mapbox

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
SESSION = "3f1c2b8e-1111-4a2b-9c3d-123456789abc"


@pytest.fixture
def me(client, outbox):
    client.post("/api/v1/auth/register", json={"email": "geo@example.com", "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": "geo@example.com", "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def fake_mapbox(monkeypatch):
    calls = []

    def fake_get(url, params):
        calls.append((url, params))
        if url.endswith("/suggest"):
            return {"suggestions": [{"mapbox_id": "dXJuOm1ieGFkcjo=", "name": "12 Khumalo Street", "full_address": "12 Khumalo Street, Tokoza, 1426"}]}
        if "/retrieve/" in url:
            return {"features": [{"geometry": {"coordinates": [28.128, -26.359]}}]}
        return {"features": [{"properties": {"context": {"address": {"name": "31 Jabu Mdunge Street"}, "neighborhood": {"name": "Tlamatlama"}, "place": {"name": "Tembisa"}, "region": {"name": "Gauteng"}, "postcode": {"name": "1632"}}}}]}

    monkeypatch.setattr(mapbox, "_get", fake_get)
    return calls


def test_needs_sign_in(client):
    assert client.get(f"/api/v1/geocoding/suggest?q=Tembisa&session={SESSION}").status_code == 401


def test_suggest_retrieve_reverse(client, me, fake_mapbox):
    r = client.get(f"/api/v1/geocoding/suggest?q=12 Khumalo Street&session={SESSION}&lat=-26.3&lng=28.1", headers=me)
    assert r.status_code == 200
    s = r.get_json()["data"]["suggestions"][0]
    assert s == {"id": "dXJuOm1ieGFkcjo=", "name": "12 Khumalo Street", "full_address": "12 Khumalo Street, Tokoza, 1426"}
    assert fake_mapbox[0][1]["country"] == "za" and fake_mapbox[0][1]["proximity"] == "28.1,-26.3"

    r = client.get(f"/api/v1/geocoding/retrieve?id={s['id']}&session={SESSION}", headers=me)
    assert r.get_json()["data"] == {"latitude": -26.359, "longitude": 28.128}

    r = client.get("/api/v1/geocoding/reverse?lat=-25.9964&lng=28.2268", headers=me)
    assert r.get_json()["data"]["address"] == {
        "street": "31 Jabu Mdunge Street", "suburb": "Tlamatlama", "city": "Tembisa", "province": "Gauteng", "postal_code": "1632",
    }


def test_the_token_never_reaches_the_app(client, me, fake_mapbox, monkeypatch):
    monkeypatch.setenv("MAPBOX_TOKEN", "pk.secret-test-token")
    r = client.get(f"/api/v1/geocoding/suggest?q=Tembisa&session={SESSION}", headers=me)
    assert "secret-test-token" not in r.get_data(as_text=True)


@pytest.mark.parametrize(
    "url",
    [
        "/api/v1/geocoding/suggest?q=&session=" + SESSION,
        "/api/v1/geocoding/suggest?q=a&session=" + SESSION,
        "/api/v1/geocoding/suggest?q=" + "x" * 150 + "&session=" + SESSION,
        "/api/v1/geocoding/suggest?q=Tembisa%00&session=" + SESSION,
        "/api/v1/geocoding/suggest?q=Tembisa&session=bad!",
        "/api/v1/geocoding/suggest?q=Tembisa&session=" + SESSION + "&lat=NaN&lng=28",
        "/api/v1/geocoding/retrieve?id=../../etc&session=" + SESSION,
        "/api/v1/geocoding/reverse?lat=abc&lng=28",
        "/api/v1/geocoding/reverse?lat=-26",
        "/api/v1/geocoding/reverse?lat=999&lng=28",
        "/api/v1/geocoding/reverse?lat=Infinity&lng=28",
    ],
)
def test_bad_input_never_reaches_mapbox(client, me, fake_mapbox, url):
    r = client.get(url, headers=me)
    assert r.status_code in (400, 422), (url, r.status_code)
    assert fake_mapbox == []


def test_mapbox_down_is_a_calm_503(client, me, monkeypatch):
    def down(url, params):
        raise mapbox.GeocodingUnavailable("unreachable")

    monkeypatch.setattr(mapbox, "_get", down)
    r = client.get(f"/api/v1/geocoding/suggest?q=Tembisa&session={SESSION}", headers=me)
    assert r.status_code == 503 and r.get_json()["code"] == "GEOCODING_UNAVAILABLE"
