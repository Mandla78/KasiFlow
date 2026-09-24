"""
The audit trail: identity actions are stored, and history can't be edited.

audit_events is append-only (it can't even be truncated between tests),
so each test looks only at rows for its own email, written after it began.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from src.domains.security.audit.models import AuditEventRecord
from src.extensions import db

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}


def fresh_email() -> str:
    return f"audit-{uuid.uuid4().hex[:10]}@example.com"


def events_for(app, email: str, since: datetime) -> list[AuditEventRecord]:
    with app.app_context():
        return (
            AuditEventRecord.query.filter(AuditEventRecord.email == email, AuditEventRecord.timestamp >= since)
            .order_by(AuditEventRecord.timestamp)
            .all()
        )


def sign_up(client, outbox, email) -> dict:
    client.post("/api/v1/auth/register", json={"business_name": "Audit Spaza", "email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    return client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]


def test_sign_up_and_logins_are_stored(app, client, outbox):
    since = datetime.now(timezone.utc)
    email = fresh_email()
    sign_up(client, outbox, email)
    client.post("/api/v1/auth/login", json={"email": email, "password": "Wrong2026!"})
    client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})

    names = [e.event_name for e in events_for(app, email, since)]
    for expected in (
        "auth.register_success",
        "auth.otp_sent",
        "auth.email_verified",
        "auth.token_created",
        "auth.login_failed",
        "auth.login_success",
    ):
        assert expected in names, f"{expected} missing from {names}"

    register = next(e for e in events_for(app, email, since) if e.event_name == "auth.register_success")
    assert register.event_metadata["privacy_version"] == "0.1-draft"  # consent is on record
    assert register.ip_address  # where it came from


def test_attempt_to_reuse_an_email_is_stored_but_not_revealed(app, client, outbox):
    since = datetime.now(timezone.utc)
    email = fresh_email()
    sign_up(client, outbox, email)
    r = client.post("/api/v1/auth/register", json={"business_name": "Someone Else", "email": email, "password": PASSWORD, "consent": CONSENT})
    assert r.status_code == 202  # the caller learns nothing
    failed = [e for e in events_for(app, email, since) if e.event_name == "auth.register_failed"]
    assert failed and failed[0].failure_reason == "email_already_registered"


def test_stolen_refresh_token_is_stored_as_high_severity(app, client, outbox):
    email = fresh_email()
    data = sign_up(client, outbox, email)
    since = datetime.now(timezone.utc)
    client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {data['refresh_token']}"})
    client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {data['refresh_token']}"})  # replay
    with app.app_context():
        rows = AuditEventRecord.query.filter(
            AuditEventRecord.event_name == "auth.token_revoked",
            AuditEventRecord.failure_reason == "refresh_token_reuse",
            AuditEventRecord.timestamp >= since,
        ).all()
    assert rows and rows[0].severity == "high" and rows[0].status == "failure"


def test_audit_trail_cannot_be_edited_or_deleted(app, client, outbox):
    email = fresh_email()
    sign_up(client, outbox, email)
    for sql in (
        "UPDATE audit.audit_events SET email = 'hacked@example.com' WHERE email = :e",
        "DELETE FROM audit.audit_events WHERE email = :e",
    ):
        with app.app_context():
            with pytest.raises(Exception, match="append-only"):
                with db.engine.begin() as conn:
                    conn.execute(text(sql), {"e": email})


def test_login_limit_is_keyed_on_ip_and_email(app):
    from src.domains.identity.auth.rate_limit.policies import login_key_func

    with app.test_request_context("/api/v1/auth/login", method="POST", json={"email": " Nomsa@Example.com "}, environ_base={"REMOTE_ADDR": "10.0.0.5"}):
        assert login_key_func() == "10.0.0.5:nomsa@example.com"
    with app.test_request_context("/api/v1/auth/login", method="POST", json={}, environ_base={"REMOTE_ADDR": "10.0.0.5"}):
        assert login_key_func() == "10.0.0.5"
