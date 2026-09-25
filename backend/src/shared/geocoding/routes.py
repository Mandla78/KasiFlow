"""
/api/v1/geocoding/* -- the location picker's address search.

  GET /geocoding/suggest?q=...&session=...[&lat=..&lng=..]
  GET /geocoding/retrieve?id=...&session=...
  GET /geocoding/reverse?lat=...&lng=...

Signed-in users only (sign-up has reached onboarding by then), rate
limited per IP (Mapbox charges per request), inputs checked before any
call leaves our server.
"""
from __future__ import annotations

import math
import re

from flask import request

from src.api import api_bp
from src.core.decorators import auth_required
from src.core.exceptions import AppError, ValidationError
from src.core.responses import success_response
from src.shared.rate_limit.limiter import limiter
from src.shared.validation.text import clean_text

from . import mapbox

SEARCH_LIMIT = "120 per minute"  # typing fires a request per pause
LOOKUP_LIMIT = "60 per minute"
_SESSION = re.compile(r"^[A-Za-z0-9-]{8,64}$")
_SUGGESTION_ID = re.compile(r"^[A-Za-z0-9_=-]{4,300}$")  # Mapbox ids: base64url


class GeocodingUnavailableError(AppError):
    status_code = 503
    code = "GEOCODING_UNAVAILABLE"


def _bad(field: str, message: str):
    raise ValidationError("Please check the highlighted fields.", errors=[{field: [message]}])


def _coord(name: str, low: float, high: float, required: bool = True):
    raw = request.args.get(name)
    if raw is None or raw == "":
        if required:
            _bad(name, "Required.")
        return None
    try:
        value = float(raw)
    except ValueError:
        _bad(name, "Must be a number.")
    if not math.isfinite(value) or not low <= value <= high:
        _bad(name, "Out of range.")
    return value


def _session() -> str:
    session = request.args.get("session", "")
    if not _SESSION.match(session):
        _bad("session", "Invalid.")
    return session


def _unavailable():
    raise GeocodingUnavailableError("Address search isn't available right now. Place the pin on the map instead.")


@api_bp.get("/geocoding/suggest")
@limiter.limit(SEARCH_LIMIT)
@auth_required
def geocoding_suggest():
    try:
        query = clean_text(request.args.get("q", ""), min_len=2, max_len=100)
    except ValueError as e:
        _bad("q", str(e))
    session = _session()
    lat, lng = _coord("lat", -90, 90, required=False), _coord("lng", -180, 180, required=False)
    try:
        suggestions = mapbox.suggest(query, session, (lat, lng) if lat is not None and lng is not None else None)
    except mapbox.GeocodingUnavailable:
        _unavailable()
    return success_response({"suggestions": suggestions})


@api_bp.get("/geocoding/retrieve")
@limiter.limit(LOOKUP_LIMIT)
@auth_required
def geocoding_retrieve():
    suggestion_id = request.args.get("id", "")
    if not _SUGGESTION_ID.match(suggestion_id):
        _bad("id", "Invalid.")
    try:
        found = mapbox.retrieve(suggestion_id, _session())
    except mapbox.GeocodingUnavailable:
        _unavailable()
    if found is None:
        raise AppError("That place couldn't be found. Place the pin on the map instead.", status_code=404, code="PLACE_NOT_FOUND")
    return success_response({"latitude": found[0], "longitude": found[1]})


@api_bp.get("/geocoding/reverse")
@limiter.limit(LOOKUP_LIMIT)
@auth_required
def geocoding_reverse():
    lat, lng = _coord("lat", -90, 90), _coord("lng", -180, 180)
    try:
        address = mapbox.reverse(lat, lng)
    except mapbox.GeocodingUnavailable:
        _unavailable()
    return success_response({"address": address})
