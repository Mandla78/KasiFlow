"""
Two-factor sign-in: password + (a trusted phone OR a code from email).
"""
from __future__ import annotations

import re

from sqlalchemy import text

from src.extensions import db

EMAIL = "twofa@example.com"
OTHER = "other@example.com"
PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}


def bearer(t):
    return {"Authorization": f"Bearer {t}"}


def last_code(outbox) -> str:
    return re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)


def signed_up(client, outbox, email=EMAIL) -> dict:
    client.post("/api/v1/auth/register", json={"business_name": "2FA Spaza", "email": email, "password": PASSWORD, "consent": CONSENT})
    r = client.post("/api/v1/auth/verify-email", json={"email": email, "code": last_code(outbox)})
    assert r.status_code == 200
    return r.get_json()["data"]


def login(client, email=EMAIL, password=PASSWORD, **extra):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password, **extra})


def test_sign_up_trusts_the_phone_that_confirmed_the_email(client, outbox):
    data = signed_up(client, outbox)
    assert len(data["trusted_phone_token"]) >= 40
    outbox.clear()
    r = login(client, trusted_phone_token=data["trusted_phone_token"])
    assert r.status_code == 200 and "access_token" in r.get_json()["data"]
    assert outbox == []  # no code needed


def test_new_phone_needs_the_emailed_code(client, outbox):
    signed_up(client, outbox)
    outbox.clear()
    r = login(client)
    assert r.status_code == 202
    step1 = r.get_json()["data"]
    assert step1["code_required"] and "access_token" not in step1
    assert outbox[-1]["subject"] == "Your Akayza sign-in code"

    r = client.post("/api/v1/auth/login/verify", json={"challenge": step1["challenge"], "code": last_code(outbox)})
    assert r.status_code == 200
    data = r.get_json()["data"]
    assert client.get("/api/v1/me", headers=bearer(data["access_token"])).status_code == 200

    # That phone is trusted now: next time, no code.
    outbox.clear()
    assert login(client, trusted_phone_token=data["trusted_phone_token"]).status_code == 200
    assert outbox == []


def test_wrong_password_never_sends_a_code(client, outbox):
    signed_up(client, outbox)
    outbox.clear()
    r = login(client, password="Wrong2026!")
    assert r.status_code == 401 and r.get_json()["code"] == "INVALID_CREDENTIALS"
    assert outbox == []  # the code step is only reached with the right password


def test_a_trusted_token_only_works_for_its_own_account(client, outbox):
    mine = signed_up(client, outbox)
    signed_up(client, outbox, email=OTHER)
    r = login(client, email=OTHER, trusted_phone_token=mine["trusted_phone_token"])
    assert r.status_code == 202  # another account on the same phone still needs its code
    r = login(client, trusted_phone_token="x" * 43)  # made-up token
    assert r.status_code == 202


def test_the_code_needs_its_challenge(client, outbox):
    signed_up(client, outbox)
    login(client)
    r = client.post("/api/v1/auth/login/verify", json={"challenge": "y" * 43, "code": last_code(outbox)})
    assert r.status_code == 400 and r.get_json()["code"] == "INVALID_CODE"


def test_wrong_codes_burn_the_sign_in(client, outbox):
    signed_up(client, outbox)
    challenge = login(client).get_json()["data"]["challenge"]
    good = last_code(outbox)
    bad = "000000" if good != "000000" else "111111"
    for _ in range(5):
        r = client.post("/api/v1/auth/login/verify", json={"challenge": challenge, "code": bad})
        assert r.status_code == 400
    r = client.post("/api/v1/auth/login/verify", json={"challenge": challenge, "code": good})
    assert r.status_code == 400  # burnt: sign in again


def test_resend_replaces_the_code_and_is_capped(client, outbox):
    signed_up(client, outbox)
    challenge = login(client).get_json()["data"]["challenge"]
    first = last_code(outbox)
    outbox.clear()
    assert client.post("/api/v1/auth/login/resend-code", json={"challenge": challenge}).status_code == 202
    second = last_code(outbox)
    if first != second:
        r = client.post("/api/v1/auth/login/verify", json={"challenge": challenge, "code": first})
        assert r.status_code == 400  # the old code died
    client.post("/api/v1/auth/login/resend-code", json={"challenge": challenge})  # 3rd code
    outbox.clear()
    r = client.post("/api/v1/auth/login/resend-code", json={"challenge": challenge})  # 4th: refused
    assert r.status_code == 202 and outbox == []  # same answer, nothing sent


def test_resend_with_an_unknown_challenge_looks_the_same(client, outbox):
    r = client.post("/api/v1/auth/login/resend-code", json={"challenge": "z" * 43})
    assert r.status_code == 202 and outbox == []


def test_closing_the_account_untrusts_every_phone(app, client, outbox):
    data = signed_up(client, outbox)
    client.post("/api/v1/me/close-account", headers=bearer(data["access_token"]), json={"password": PASSWORD})
    with app.app_context():
        live = db.session.execute(text("SELECT count(*) FROM identity.trusted_phones WHERE revoked_at IS NULL")).scalar()
    assert live == 0


def test_trusted_tokens_are_stored_hashed(app, client, outbox):
    data = signed_up(client, outbox)
    with app.app_context():
        stored = db.session.execute(text("SELECT token_hash FROM identity.trusted_phones")).scalars().all()
    assert stored and data["trusted_phone_token"] not in stored and all(len(h) == 64 for h in stored)
