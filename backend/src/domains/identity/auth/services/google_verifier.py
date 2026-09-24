"""
Verifies a Google ID token on OUR server. The app never tells us who the
user is; Google's signed token does, and we check it ourselves:

  * signature, against Google's published keys (google-auth fetches and
    caches them)
  * issuer is Google, and the token hasn't expired
  * audience is one of OUR client IDs (a token minted for another app is
    refused)
  * Google has verified the email

Tests replace `verify` with a fake; nothing else in the code talks to Google.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from flask import current_app

from src.core.exceptions import AppError

GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


@dataclass(frozen=True)
class GoogleClaims:
    sub: str  # Google's stable user id
    email: str
    name: Optional[str]


class GoogleNotConfigured(AppError):
    status_code = 503
    code = "GOOGLE_NOT_CONFIGURED"


class InvalidGoogleToken(AppError):
    status_code = 401
    code = "INVALID_GOOGLE_TOKEN"


def verify(id_token_value: str) -> GoogleClaims:
    client_ids = current_app.config.get("GOOGLE_CLIENT_IDS") or []
    if not client_ids:
        raise GoogleNotConfigured("Google sign-in isn't available yet.")

    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    try:
        # audience=None here, then checked against ALL our client IDs below
        # (Android and web tokens carry different ones).
        claims = id_token.verify_oauth2_token(id_token_value, google_requests.Request(), audience=None)
    except ValueError:
        raise InvalidGoogleToken("Google sign-in failed. Please try again.") from None

    if claims.get("iss") not in GOOGLE_ISSUERS or claims.get("aud") not in client_ids:
        raise InvalidGoogleToken("Google sign-in failed. Please try again.")
    if not claims.get("email") or claims.get("email_verified") is not True:
        raise InvalidGoogleToken("Your Google account's email isn't verified.")
    return GoogleClaims(sub=str(claims["sub"]), email=claims["email"], name=claims.get("name"))
