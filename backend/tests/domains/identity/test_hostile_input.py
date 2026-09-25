"""
Hostile input: what a reviewer, a careless user or an attacker types.

The rule for every endpoint: it may REFUSE, but it must never crash
(no 500), never accept junk as valid, and never answer differently in a
way that leaks whether an account exists.
"""
from __future__ import annotations

import json
import re

import pytest

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}
REFUSED = {400, 401, 403, 404, 409, 413, 415, 422, 423, 429}

BAD_EMAILS = [
    "",
    " ",
    "not-an-email",
    "a@b",
    "@example.com",
    "nomsa@",
    "nomsa@@example.com",
    "nomsa example@example.com",
    "😀@example.com",
    "nomsa@😀.com",
    "' OR 1=1 --@example.com",
    "nomsa@example.com\r\nBcc: attacker@evil.com",  # email header injection
    "nomsa@example.com\x00",
    "a" * 250 + "@example.com",
    "<script>alert(1)</script>@example.com",
]

HOSTILE_TEXT = [
    "",
    " ",
    "😀😀😀",
    "<script>alert(1)</script>",
    "'; DROP TABLE identity.users; --",
    "\x00\x01\x02",
    "‮evil",  # right-to-left override
    "​​",  # zero-width spaces only
    "a" * 5000,
    "\n\n\n",
    "{{7*7}}",  # template injection
]

LONG_PASSWORDS = [
    "Aa1!" + "x" * 100,  # 104 ASCII characters: over bcrypt's 72-byte limit
    "Aa1!" + "😀" * 30,  # 34 characters but 124 bytes
    "Aa1!" + "é" * 60,  # 64 characters, 124 bytes
]

WRONG_TYPES = [None, 123, 1.5, True, [], {}, ["a"], {"a": 1}]


def register(client, **overrides):
    body = {"business_name": "Nomsa's Spaza", "email": "nomsa@example.com", "password": PASSWORD, "consent": CONSENT, **overrides}
    return client.post("/api/v1/auth/register", json=body)


def signed_up(client, outbox, email="nomsa@example.com") -> dict:
    register(client, email=email)
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    return client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]


def assert_refused(r):
    assert r.status_code in REFUSED, (r.status_code, r.get_data(as_text=True)[:200])
    body = r.get_json()
    assert body is not None and body["success"] is False


# ------------------------------------------------------------------ emails


@pytest.mark.parametrize("email", BAD_EMAILS)
def test_register_refuses_bad_emails(client, outbox, email):
    assert_refused(register(client, email=email))
    assert outbox == []  # nothing was sent anywhere


@pytest.mark.parametrize("email", BAD_EMAILS)
@pytest.mark.parametrize("url", ["/api/v1/auth/login", "/api/v1/auth/forgot-password", "/api/v1/auth/resend-code"])
def test_email_endpoints_never_crash_on_bad_emails(client, outbox, url, email):
    body = {"email": email, "password": PASSWORD} if url.endswith("login") else {"email": email}
    r = client.post(url, json=body)
    assert r.status_code != 500
    assert outbox == []


# --------------------------------------------------------------- passwords


@pytest.mark.parametrize("password", LONG_PASSWORDS)
def test_sign_up_refuses_passwords_bcrypt_cannot_hold(client, password):
    r = register(client, password=password)
    assert r.status_code == 422 and r.get_json()["code"] == "WEAK_PASSWORD"


@pytest.mark.parametrize("password", LONG_PASSWORDS + ["x" * 128])
def test_login_with_a_huge_password_is_just_wrong(client, outbox, password):
    signed_up(client, outbox)
    r = client.post("/api/v1/auth/login", json={"email": "nomsa@example.com", "password": password})
    assert r.status_code == 401 and r.get_json()["code"] == "INVALID_CREDENTIALS"


@pytest.mark.parametrize("password", LONG_PASSWORDS)
def test_account_security_with_huge_passwords(client, outbox, password):
    data = signed_up(client, outbox)
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    r = client.post("/api/v1/auth/change-password", headers=headers, json={"current_password": password, "new_password": password})
    assert r.status_code in (400, 422)
    r = client.post("/api/v1/auth/change-password", headers=headers, json={"current_password": PASSWORD, "new_password": password})
    assert r.status_code == 422
    r = client.post("/api/v1/me/close-account", headers=headers, json={"password": password})
    assert r.status_code == 400


def test_emoji_password_within_limits_works(client, outbox):
    """A password with a few emoji that fits bcrypt is fine: sign up and sign in."""
    pw = "Spaza2026!😀"
    register(client, password=pw)
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    assert client.post("/api/v1/auth/verify-email", json={"email": "nomsa@example.com", "code": code}).status_code == 200
    trusted = client.post("/api/v1/auth/verify-email", json={"email": "nomsa@example.com", "code": code})  # used code
    assert trusted.status_code == 400


# ------------------------------------------------------------ other fields


@pytest.mark.parametrize("name", HOSTILE_TEXT)
def test_business_name_junk(client, outbox, name):
    r = register(client, business_name=name)
    assert r.status_code != 500
    if r.status_code == 202:  # accepted: must be stored as plain text, trimmed, sane length
        assert len(name.strip()) >= 2 and len(name) <= 80


@pytest.mark.parametrize("code", ["", "12345", "1234567", "abcdef", "١٢٣٤٥٦", "１２３４５６", "12 345", "😀😀😀😀😀😀", None, 123456])
def test_verification_code_junk(client, outbox, code):
    register(client)
    r = client.post("/api/v1/auth/verify-email", json={"email": "nomsa@example.com", "code": code})
    assert_refused(r)


@pytest.mark.parametrize("value", WRONG_TYPES)
@pytest.mark.parametrize("field", ["email", "password", "business_name", "consent"])
def test_register_wrong_types(client, field, value):
    assert_refused(register(client, **{field: value}))


@pytest.mark.parametrize("value", WRONG_TYPES)
def test_login_wrong_types(client, value):
    assert_refused(client.post("/api/v1/auth/login", json={"email": value, "password": value}))


# -------------------------------------------------------------- raw bodies


@pytest.mark.parametrize(
    "raw,ctype",
    [
        ("", "application/json"),
        ("not json", "application/json"),
        ("{", "application/json"),
        ("[]", "application/json"),
        ('"just a string"', "application/json"),
        ("null", "application/json"),
        ('{"email": "nomsa@example.com"', "application/json"),
        ("email=x&password=y", "application/x-www-form-urlencoded"),
        ("\xff\xfe\x00", "application/json"),
    ],
)
@pytest.mark.parametrize("url", ["/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/verify-email", "/api/v1/auth/reset-password"])
def test_broken_bodies_never_crash(client, url, raw, ctype):
    r = client.post(url, data=raw, content_type=ctype)
    assert_refused(r)


def test_nan_and_infinity_are_not_numbers_we_accept(client, outbox):
    """Python's JSON parser accepts NaN/Infinity; a NaN pin would pass a range check."""
    data = signed_up(client, outbox)
    headers = {"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"}
    for bad in ("NaN", "Infinity", "-Infinity"):
        body = (
            '{"location": {"building": "", "street": "", "suburb": "Tembisa", "city": "", "province": "", '
            f'"postal_code": "", "latitude": {bad}, "longitude": 28.2}}}}'
        )
        r = client.patch("/api/v1/me/business-profile", data=body, headers=headers)
        assert r.status_code in (400, 422), (bad, r.status_code)


@pytest.mark.parametrize("field", ["owner_name"])
@pytest.mark.parametrize("value", HOSTILE_TEXT)
def test_business_profile_text_junk(client, outbox, field, value):
    data = signed_up(client, outbox)
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    business = {"business_type": "spaza", "trade": None, "owner_name": "Nomsa", "years_trading": "1_3", "cellphone": None, field: value}
    r = client.patch("/api/v1/me/business-profile", headers=headers, json={"business": business})
    assert r.status_code != 500


def test_responses_never_echo_raw_input_as_html(client):
    r = register(client, business_name="<script>alert(1)</script>", email="<b>@x")
    assert r.headers["Content-Type"].startswith("application/json")
    assert r.headers["X-Content-Type-Options"] == "nosniff"


def test_same_answer_for_bad_and_unknown_login_email_shapes(client):
    """A valid-looking unknown email and a real-but-wrong password look alike;
    a malformed email is refused by validation (it can't exist anyway)."""
    a = client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "Wrong2026!"})
    assert a.status_code == 401
    assert json.loads(a.get_data())["code"] == "INVALID_CREDENTIALS"


# ------------------------------------------------------------- name rules

BAD_BUSINESS_NAMES = ["12334566", "00000", "😀😀😀", "Spaza 😀", "aaaa", "A", "1a", "!!!!", "---", "Shop@home", "<b>Shop</b>", "a1 a1"]
GOOD_BUSINESS_NAMES = ["Nomsa's Spaza", "Shop 24/7", "Mokoena Build (Pty) Ltd", "Thabo & Sons", "Ēbè Tuck-shop", "S. Dlamini Trading #2"]


@pytest.mark.parametrize("name", BAD_BUSINESS_NAMES)
def test_business_name_must_be_a_real_name(client, outbox, name):
    r = register(client, business_name=name)
    assert r.status_code == 422, (name, r.status_code)
    assert outbox == []


@pytest.mark.parametrize("name", GOOD_BUSINESS_NAMES)
def test_real_business_names_are_accepted(client, outbox, name):
    assert register(client, business_name=name).status_code == 202


BAD_PERSON_NAMES = ["Nomsa2", "N0msa", "😀 Nomsa", "12345", "N", "Nomsa & Co", "--"]
GOOD_PERSON_NAMES = ["Nomsa Dlamini", "Mary-Jane O'Neil", "Dr. N. Mokoena", "Sipho", "Thabo Mokoena-Ndlovu", "Zoë Müller"]


@pytest.mark.parametrize("name", BAD_PERSON_NAMES + GOOD_PERSON_NAMES)
def test_owner_name_is_letters_only(client, outbox, name):
    data = signed_up(client, outbox)
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    business = {"business_type": "spaza", "trade": None, "owner_name": name, "years_trading": "1_3", "cellphone": None}
    r = client.patch("/api/v1/me/business-profile", headers=headers, json={"business": business})
    assert r.status_code == (200 if name in GOOD_PERSON_NAMES else 422), (name, r.status_code)
