"""Change password, sign out other phones, close account, export data."""
from __future__ import annotations

import re

EMAIL = "sec@example.com"
PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}


def bearer(t):
    return {"Authorization": f"Bearer {t}"}


def signed_up(client, outbox) -> dict:
    client.post("/api/v1/auth/register", json={"email": EMAIL, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    return client.post("/api/v1/auth/verify-email", json={"email": EMAIL, "code": code}).get_json()["data"]


def second_phone(client, outbox) -> dict:
    """Sign in on another phone: password, then the emailed code."""
    challenge = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}).get_json()["data"]["challenge"]
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    body = {"challenge": challenge, "code": code, "phone": {"platform": "android", "label": "Samsung A14"}}
    return client.post("/api/v1/auth/login/verify", json=body).get_json()["data"]


def test_change_password_keeps_this_phone_and_signs_out_others(client, outbox):
    a = signed_up(client, outbox)
    b = second_phone(client, outbox)
    r = client.post("/api/v1/auth/change-password", headers=bearer(a["access_token"]),
                    json={"current_password": PASSWORD, "new_password": "NewSpaza2026#"})
    assert r.status_code == 200 and r.get_json()["data"]["signed_out"] == 1
    assert client.get("/api/v1/me", headers=bearer(a["access_token"])).status_code == 200  # this phone stays
    assert client.get("/api/v1/me", headers=bearer(b["access_token"])).status_code == 401  # the other is out
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "NewSpaza2026#"}).status_code == 202


def test_change_password_needs_the_right_current_password(client, outbox):
    a = signed_up(client, outbox)
    r = client.post("/api/v1/auth/change-password", headers=bearer(a["access_token"]),
                    json={"current_password": "Wrong2026!", "new_password": "NewSpaza2026#"})
    assert r.status_code == 400 and r.get_json()["code"] == "WRONG_PASSWORD"
    r = client.post("/api/v1/auth/change-password", headers=bearer(a["access_token"]),
                    json={"current_password": PASSWORD, "new_password": PASSWORD})
    assert r.status_code == 422 and r.get_json()["code"] == "PASSWORD_UNCHANGED"


def test_sign_out_other_phones_and_list_them(client, outbox):
    a = signed_up(client, outbox)
    b = second_phone(client, outbox)
    sessions = client.get("/api/v1/auth/sessions", headers=bearer(a["access_token"])).get_json()["data"]["sessions"]
    assert len(sessions) == 2 and sum(s["this_phone"] for s in sessions) == 1
    assert {s["label"] for s in sessions if not s["this_phone"]} == {"Samsung A14"}  # named by the phone
    assert all("token" not in str(s) for s in sessions)  # never tokens
    r = client.post("/api/v1/auth/logout-others", headers=bearer(a["access_token"]))
    assert r.get_json()["data"]["signed_out"] == 1
    sessions = client.get("/api/v1/auth/sessions", headers=bearer(a["access_token"])).get_json()["data"]["sessions"]
    assert len(sessions) == 1 and sessions[0]["this_phone"]
    # The other phone is no longer trusted: its password alone only gets a code.
    back = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD, "trusted_phone_token": b["trusted_phone_token"]})
    assert back.status_code == 202 and back.get_json()["data"]["code_required"]
    # ...while this phone still is.
    here = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD, "trusted_phone_token": a["trusted_phone_token"]})
    assert here.status_code == 200


def test_close_account_ends_everything(client, outbox):
    a = signed_up(client, outbox)
    wrong = client.post("/api/v1/me/close-account", headers=bearer(a["access_token"]), json={"password": "Wrong2026!"})
    assert wrong.status_code == 400
    r = client.post("/api/v1/me/close-account", headers=bearer(a["access_token"]), json={"password": PASSWORD})
    assert r.status_code == 200
    assert client.get("/api/v1/me", headers=bearer(a["access_token"])).status_code == 401
    login = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert login.status_code == 403 and login.get_json()["code"] == "ACCOUNT_INACTIVE"


def test_export_contains_my_data_and_no_secrets(client, outbox):
    a = signed_up(client, outbox)
    data = client.get("/api/v1/me/export", headers=bearer(a["access_token"])).get_json()["data"]
    assert data["account"]["email"] == EMAIL
    assert {c["document"] for c in data["consents"]} == {"privacy_policy", "terms_of_use"}
    text = str(data).lower()
    assert len(data["trusted_phones"]) == 1
    for secret in ("password_hash", "code_hash", "token_hash", "refresh_jti", PASSWORD.lower(), a["trusted_phone_token"].lower()):
        assert secret not in text


def test_account_security_routes_need_a_token(client):
    for method, url in (("get", "/api/v1/auth/sessions"), ("post", "/api/v1/auth/logout-others"),
                        ("post", "/api/v1/auth/change-password"), ("post", "/api/v1/me/close-account"),
                        ("get", "/api/v1/me/export")):
        assert getattr(client, method)(url).status_code == 401
