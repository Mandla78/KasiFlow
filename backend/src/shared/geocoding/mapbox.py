"""
Mapbox Search Box (suggest, retrieve) and Geocoding v6 (reverse).

Search Box bills per SESSION: suggest + the retrieve that follows share
the session token the app generated, so a whole search counts once.

Failures (no token, Mapbox down, slow, unexpected answer) raise
GeocodingUnavailable; the route turns that into a calm 503 and the app's
map picker still works without search.

The token goes only in the request to Mapbox, never in a log line or a
response.
"""
from __future__ import annotations

import os
from typing import Optional
from urllib.parse import quote

import requests

SEARCH_URL = "https://api.mapbox.com/search/searchbox/v1"
REVERSE_URL = "https://api.mapbox.com/search/geocode/v6/reverse"
TIMEOUT_SECONDS = 6
MAX_SUGGESTIONS = 6


class GeocodingUnavailable(Exception):
    pass


def _token() -> str:
    token = os.environ.get("MAPBOX_TOKEN", "")
    if not token:
        raise GeocodingUnavailable("no token")
    return token


def _get(url: str, params: dict) -> dict:
    try:
        r = requests.get(url, params={**params, "access_token": _token()}, timeout=TIMEOUT_SECONDS)
    except requests.RequestException:
        raise GeocodingUnavailable("unreachable") from None
    if r.status_code != 200:
        raise GeocodingUnavailable(f"status {r.status_code}")
    try:
        return r.json()
    except ValueError:
        raise GeocodingUnavailable("not json") from None


def suggest(query: str, session: str, near: Optional[tuple[float, float]] = None) -> list[dict]:
    params = {"q": query, "session_token": session, "country": "za", "language": "en", "limit": MAX_SUGGESTIONS}
    if near:
        params["proximity"] = f"{near[1]},{near[0]}"  # Mapbox: longitude,latitude
    data = _get(f"{SEARCH_URL}/suggest", params)
    return [
        {"id": s["mapbox_id"], "name": s.get("name") or "", "full_address": s.get("full_address") or s.get("place_formatted") or ""}
        for s in data.get("suggestions", [])
        if s.get("mapbox_id")
    ]


def retrieve(suggestion_id: str, session: str) -> Optional[tuple[float, float]]:
    data = _get(f"{SEARCH_URL}/retrieve/{quote(suggestion_id, safe='')}", {"session_token": session})
    features = data.get("features") or []
    if not features:
        return None
    longitude, latitude = features[0]["geometry"]["coordinates"][:2]
    return float(latitude), float(longitude)


def reverse(latitude: float, longitude: float) -> dict:
    data = _get(REVERSE_URL, {"latitude": latitude, "longitude": longitude, "country": "za", "language": "en", "limit": 1})
    features = data.get("features") or []
    ctx = features[0]["properties"].get("context", {}) if features else {}

    def name(key: str) -> Optional[str]:
        return (ctx.get(key) or {}).get("name") or None

    return {
        "street": name("address") or name("street"),
        "suburb": name("neighborhood") or name("locality"),
        "city": name("place"),
        "province": name("region"),
        "postal_code": name("postcode"),
    }
