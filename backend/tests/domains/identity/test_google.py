"""Continue with Google: verified on the server, never merged silently,
and safe against the pre-hijack attack."""
from __future__ import annotations

import pytest

from src.domains.identity.auth.services import google_verifier
from src.domains.identity.auth.services.google_verifier import GoogleClaims, InvalidGoogleToken

CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}
NOMSA = "google-token-for-nomsa-xxxxxxxxxxxx"
PASSWORD = "Spaza2026!"


@pytest.fixture
def fake_google(monkeypatch):
    """Stands in for Google: one known good token, everything else invalid."""

    def verify(token):
        if token == NOMSA:
            return GoogleClaims(sub="google-sub-123", email="nomsa.g@example.com", name="Nomsa Dlamini")
        raise InvalidGoogleToken("Google sign-in failed. Please try again.")

    monkeypatch.setattr(google_verifier, "verify", verify)


def google(client, token=NOMSA, **extra):
    return client.post("/api/v1/auth/google", json={"id_token": token, **extra})


def test_google_is_off_until_configured(client):
    r = google(client)
    assert r.status_code == 503 and r.get_json()["code"] == "GOOGLE_NOT_CONFIGURED"


def test_new_user_needs_consent_then_signs_in(client, fake_google):
    first = google(client)
    assert first.status_code == 422 and first.get_json()["code"] == "GOOGLE_SIGNUP_DETAILS_REQUIRED"
    assert first.get_json()["data"]["email"] == "nomsa.g@example.com"

    r = google(client, consent=CONSENT)
    assert r.status_code == 200
    user = r.get_json()["data"]["user"]
    assert user["signed_up_with"] == "google" and user["status"] == "active" and user["email_verified"]

    again = google(client)  # already linked: straight in
    assert again.status_code == 200


def test_existing_password_account_is_never_merged_silently(client, fake_google, outbox):
    import re

    client.post("/api/v1/auth/register", json={"email": "nomsa.g@example.com", "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    client.post("/api/v1/auth/verify-email", json={"email": "nomsa.g@example.com", "code": code})

    r = google(client, consent=CONSENT)
    assert r.status_code == 409 and r.get_json()["code"] == "GOOGLE_LINK_REQUIRED"

    wrong = client.post("/api/v1/auth/google/link", json={"id_token": NOMSA, "password": "Wrong2026!"})
    assert wrong.status_code == 400 and wrong.get_json()["code"] == "WRONG_PASSWORD"
    ok = client.post("/api/v1/auth/google/link", json={"id_token": NOMSA, "password": PASSWORD})
    assert ok.status_code == 200

    assert google(client).status_code == 200  # Google works now
    assert client.post("/api/v1/auth/login", json={"email": "nomsa.g@example.com", "password": PASSWORD}).status_code == 202  # and so does the password


def test_pre_hijack_attack_fails(client, fake_google):
    # An attacker signs up with the victim's email and a password, never verifies.
    client.post("/api/v1/auth/register", json={"email": "nomsa.g@example.com", "password": "Attacker2026!", "consent": CONSENT})
    # The real owner signs in with Google (proving the email).
    r = google(client, consent=CONSENT)
    assert r.status_code == 200 and r.get_json()["data"]["user"]["signed_up_with"] == "google"
    # The attacker's planted password is gone.
    login = client.post("/api/v1/auth/login", json={"email": "nomsa.g@example.com", "password": "Attacker2026!"})
    assert login.status_code == 401


def test_bad_google_token_is_rejected(client, fake_google):
    r = google(client, token="forged-token-xxxxxxxxxxxxxxxxxxxx")
    assert r.status_code == 401 and r.get_json()["code"] == "INVALID_GOOGLE_TOKEN"


def test_outdated_consent_rejected_on_google_path(client, fake_google):
    r = google(client, consent={"privacy_version": "0.0-old", "terms_version": "0.1-draft"})
    assert r.status_code == 422 and r.get_json()["code"] == "CONSENT_OUTDATED"
