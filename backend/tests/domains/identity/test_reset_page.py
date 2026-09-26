"""
The page the reset email's button opens: an https link (email apps strip
akayza:// links), a new-password form, one use.
"""
from __future__ import annotations

import re

EMAIL = "reset@example.com"
PASSWORD = "Spaza2026!"
NEW = "NewSpaza2026#"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}


def ticket_from_email(client, outbox) -> str:
    client.post("/api/v1/auth/register", json={"email": EMAIL, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    client.post("/api/v1/auth/verify-email", json={"email": EMAIL, "code": code})
    client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    html = outbox[-1]["html_body"]
    link = re.search(r'href="([^"]+)"', html).group(1)
    assert link.startswith("http") and "/reset-password?ticket=" in link  # a real web link, not akayza://
    return link.split("ticket=")[1]


def test_email_button_opens_the_form(client, outbox):
    ticket = ticket_from_email(client, outbox)
    r = client.get(f"/reset-password?ticket={ticket}")
    assert r.status_code == 200 and b"Choose a new password" in r.data
    assert f"akayza://reset-password?token={ticket}".encode() in r.data  # "open the app" still offered
    assert r.headers["Referrer-Policy"] == "no-referrer" and r.headers["Cache-Control"] == "no-store"


def test_form_changes_the_password_once(client, outbox):
    ticket = ticket_from_email(client, outbox)
    r = client.post("/reset-password", data={"ticket": ticket, "password": NEW, "confirm": NEW})
    assert b"Password changed" in r.data
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": NEW}).status_code == 202  # new password works
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 401
    again = client.post("/reset-password", data={"ticket": ticket, "password": "Other2026#x", "confirm": "Other2026#x"})
    assert b"doesn&#39;t work any more" in again.data or b"doesn't work any more" in again.data
    assert b"doesn" in client.get(f"/reset-password?ticket={ticket}").data  # used: no form any more


def test_mismatch_and_weak_password_keep_the_form(client, outbox):
    ticket = ticket_from_email(client, outbox)
    r = client.post("/reset-password", data={"ticket": ticket, "password": NEW, "confirm": NEW + "x"})
    assert b"don&#39;t match" in r.data or b"don't match" in r.data
    r = client.post("/reset-password", data={"ticket": ticket, "password": "password", "confirm": "password"})
    assert b"capital letter" in r.data
    # still usable after those mistakes
    assert b"Password changed" in client.post("/reset-password", data={"ticket": ticket, "password": NEW, "confirm": NEW}).data


def test_bad_or_missing_ticket(client):
    assert b"Link incomplete" in client.get("/reset-password").data
    assert b"work any more" in client.get("/reset-password?ticket=" + "x" * 43).data
