"""
Identity: the security promises, tested end to end through the API.
"""
from __future__ import annotations

import base64
import re

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

EMAIL = "nomsa@example.com"
PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}


def b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def device(platform="android") -> dict:
    """What the phone sends: its public key, signed with its private key."""
    private = Ed25519PrivateKey.generate()
    public = b64(private.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw))
    signature = b64(private.sign(f"akayza-device:{public}".encode()))
    return {"public_key": public, "signature": signature, "platform": platform, "label": "Test phone"}


def register(client, email=EMAIL, password=PASSWORD, consent=CONSENT):
    return client.post(
        "/api/v1/auth/register",
        json={"business_name": "Nomsa's Spaza", "email": email, "password": password, "consent": consent},
    )


def last_code(outbox) -> str:
    return re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)


def signed_up(client, outbox, phone=None) -> dict:
    assert register(client).status_code == 202
    body = {"email": EMAIL, "code": last_code(outbox)}
    if phone:
        body["device"] = phone
    r = client.post("/api/v1/auth/verify-email", json=body)
    assert r.status_code == 200, r.get_json()
    return r.get_json()["data"]


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ----------------------------------------------------------------- sign-up


def test_sign_up_verify_and_me(client, outbox):
    data = signed_up(client, outbox, phone=device())
    me = client.get("/api/v1/me", headers=bearer(data["access_token"]))
    assert me.status_code == 200
    assert me.get_json()["data"]["email"] == EMAIL
    assert me.get_json()["data"]["status"] == "active"
    assert "password" not in str(me.get_json())


def test_weak_password_rejected_with_one_message(client):
    r = register(client, password="12345678")
    assert r.status_code == 422
    assert r.get_json()["code"] == "WEAK_PASSWORD"
    assert "capital letter" in r.get_json()["message"]


def test_outdated_consent_rejected(client):
    r = register(client, consent={"privacy_version": "0.0-old", "terms_version": "0.1-draft"})
    assert r.status_code == 422
    assert r.get_json()["code"] == "CONSENT_OUTDATED"


def test_unknown_fields_rejected(client):
    r = client.post("/api/v1/auth/register", json={"email": EMAIL, "password": PASSWORD, "is_admin": True})
    assert r.status_code == 422


def test_register_existing_email_looks_identical_and_warns_owner(client, outbox):
    signed_up(client, outbox)
    outbox.clear()
    r = register(client, password="Other2026!")
    assert r.status_code == 202  # same answer as a brand-new email
    assert outbox[-1]["subject"] == "Someone tried to sign up with your email"
    assert not re.search(r">(\d{6})<", outbox[-1]["html_body"])  # no code sent
    # and the real owner's password still works
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 200


def test_email_is_case_and_space_insensitive(client, outbox):
    signed_up(client, outbox)
    r = client.post("/api/v1/auth/login", json={"email": "  NOMSA@Example.com ", "password": PASSWORD})
    assert r.status_code == 200


# ------------------------------------------------------------------- codes


def test_wrong_code_is_generic_and_burns_after_max_attempts(client, outbox):
    register(client)
    good = last_code(outbox)
    bad = "000000" if good != "000000" else "111111"
    for _ in range(5):
        r = client.post("/api/v1/auth/verify-email", json={"email": EMAIL, "code": bad})
        assert r.status_code == 400 and r.get_json()["code"] == "INVALID_CODE"
    # the right code no longer works: it was burnt
    r = client.post("/api/v1/auth/verify-email", json={"email": EMAIL, "code": good})
    assert r.status_code == 400


def test_verify_for_unknown_email_is_the_same_error(client):
    r = client.post("/api/v1/auth/verify-email", json={"email": "nobody@example.com", "code": "123456"})
    assert r.status_code == 400 and r.get_json()["code"] == "INVALID_CODE"


def test_resend_is_the_same_answer_for_everyone(client, outbox):
    a = client.post("/api/v1/auth/resend-code", json={"email": "nobody@example.com"})
    assert a.status_code == 202 and outbox == []
    register(client)
    b = client.post("/api/v1/auth/resend-code", json={"email": EMAIL})
    assert b.status_code == 202 and a.get_json()["message"] == b.get_json()["message"]


# ------------------------------------------------------------------- login


def test_wrong_password_and_unknown_email_get_the_same_error(client, outbox):
    signed_up(client, outbox)
    a = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "Wrong2026!"})
    b = client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "Wrong2026!"})
    assert a.status_code == b.status_code == 401
    assert a.get_json()["message"] == b.get_json()["message"]
    assert a.get_json()["code"] == b.get_json()["code"] == "INVALID_CREDENTIALS"


def test_lockout_after_five_failures_only_revealed_to_real_owner(client, outbox):
    signed_up(client, outbox)
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "Wrong2026!"})
    wrong = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "Wrong2026!"})
    assert wrong.status_code == 401  # an attacker still sees the generic error
    right = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert right.status_code == 423 and right.get_json()["code"] == "ACCOUNT_LOCKED"


def test_unverified_login_resends_code(client, outbox):
    register(client)
    outbox.clear()
    r = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 403 and r.get_json()["code"] == "EMAIL_NOT_VERIFIED"
    assert re.search(r">(\d{6})<", outbox[-1]["html_body"])


# ---------------------------------------------------------------- sessions


def test_logout_ends_access_immediately(client, outbox):
    data = signed_up(client, outbox)
    assert client.post("/api/v1/auth/logout", headers=bearer(data["access_token"])).status_code == 200
    r = client.get("/api/v1/me", headers=bearer(data["access_token"]))
    assert r.status_code == 401 and r.get_json()["code"] == "SESSION_ENDED"


def test_refresh_rotates_and_reuse_kills_the_session(client, outbox):
    data = signed_up(client, outbox)
    first = client.post("/api/v1/auth/refresh", headers=bearer(data["refresh_token"]))
    assert first.status_code == 200
    new = first.get_json()["data"]
    # replaying the OLD refresh token = stolen copy -> session revoked
    replay = client.post("/api/v1/auth/refresh", headers=bearer(data["refresh_token"]))
    assert replay.status_code == 401
    assert client.get("/api/v1/me", headers=bearer(new["access_token"])).status_code == 401


def test_new_phone_switches_off_the_old_one(client, outbox):
    old = signed_up(client, outbox, phone=device())
    new = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD, "device": device()})
    assert new.status_code == 200
    assert client.get("/api/v1/me", headers=bearer(old["access_token"])).status_code == 401
    assert client.get("/api/v1/me", headers=bearer(new.get_json()["data"]["access_token"])).status_code == 200


def test_invalid_device_key_rejected(client, outbox):
    signed_up(client, outbox)
    # A copied public key with someone else's signature: no proof of possession.
    stolen = device()
    stolen["signature"] = device()["signature"]
    r = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD, "device": stolen})
    assert r.status_code == 422 and r.get_json()["code"] == "INVALID_DEVICE_KEY"
    # And 32 bytes of junk that parse as a key but can't sign anything.
    junk = {**device(), "public_key": "A" * 43}
    r = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD, "device": junk})
    assert r.status_code == 422 and r.get_json()["code"] == "INVALID_DEVICE_KEY"


def test_me_without_token_or_with_garbage(client):
    assert client.get("/api/v1/me").status_code == 401
    assert client.get("/api/v1/me", headers=bearer("not-a-token")).status_code == 401


# ---------------------------------------------------------- password reset


def test_forgot_password_same_answer_and_reset_works_once(client, outbox):
    data = signed_up(client, outbox)
    outbox.clear()
    a = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
    assert a.status_code == 202 and outbox == []
    b = client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    assert b.status_code == 202 and a.get_json()["message"] == b.get_json()["message"]

    token = re.search(r"token=([A-Za-z0-9_\-]+)", outbox[-1]["html_body"]).group(1)
    ok = client.post("/api/v1/auth/reset-password", json={"token": token, "password": "NewPass2026#"})
    assert ok.status_code == 200
    again = client.post("/api/v1/auth/reset-password", json={"token": token, "password": "Another2026#"})
    assert again.status_code == 400  # one use only

    # signed out everywhere, old password dead, new one works
    assert client.get("/api/v1/me", headers=bearer(data["access_token"])).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "NewPass2026#"}).status_code == 200


def test_reset_rejects_weak_password(client, outbox):
    signed_up(client, outbox)
    client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    token = re.search(r"token=([A-Za-z0-9_\-]+)", outbox[-1]["html_body"]).group(1)
    r = client.post("/api/v1/auth/reset-password", json={"token": token, "password": "password"})
    assert r.status_code == 422 and r.get_json()["code"] == "WEAK_PASSWORD"


# ------------------------------------------------------------------ storage


def test_secrets_are_never_stored_in_plain_text(app, client, outbox):
    from src.domains.identity.auth.models import EmailCode, PasswordCredential

    register(client)
    code = last_code(outbox)
    with app.app_context():
        stored = EmailCode.query.first()
        assert stored.code_hash != code and len(stored.code_hash) == 64
        cred = PasswordCredential.query.first()
        assert cred.password_hash.startswith("$2") and PASSWORD not in cred.password_hash


def test_verification_emails_are_capped_per_address(client, outbox):
    """Someone hammering "resend" can't flood a person's inbox."""
    register(client)
    for _ in range(10):
        client.post("/api/v1/auth/resend-code", json={"email": EMAIL})
    assert len(outbox) == 6
