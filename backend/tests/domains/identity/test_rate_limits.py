"""
Rate limits, end to end. Tests normally run with limits off (so other tests
can call routes freely); these switch the limiter on just for themselves.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest

from src.domains.security.audit.models import AuditEventRecord
from src.shared.rate_limit.limiter import limiter


@pytest.fixture
def limits_on(app):
    was = limiter.enabled
    limiter.enabled = True
    with app.app_context():
        limiter.reset()
    yield
    with app.app_context():
        limiter.reset()
    limiter.enabled = was


def test_sixth_login_in_a_minute_is_blocked_and_audited(app, client, limits_on):
    since = datetime.now(timezone.utc)
    email = f"rl-{uuid.uuid4().hex[:8]}@example.com"
    body = {"email": email, "password": "Wrong2026!"}
    codes = [client.post("/api/v1/auth/login", json=body).status_code for _ in range(6)]
    assert codes[:5] == [401] * 5 and codes[5] == 429

    r = client.post("/api/v1/auth/login", json=body)
    j = r.get_json()
    assert r.status_code == 429 and j["success"] is False and j["code"] == "RATE_LIMITED"
    assert int(r.headers["Retry-After"]) > 0

    with app.app_context():
        rows = AuditEventRecord.query.filter(
            AuditEventRecord.event_name == "auth.login_rate_limited", AuditEventRecord.timestamp >= since
        ).all()
    assert rows and rows[0].email == email


def test_login_limit_is_per_email_so_a_shared_wifi_is_fine(client, limits_on):
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"email": "one@example.com", "password": "Wrong2026!"})
    # Same IP (same shop Wi-Fi), different person: not blocked.
    r = client.post("/api/v1/auth/login", json={"email": "two@example.com", "password": "Wrong2026!"})
    assert r.status_code == 401


def test_forgot_password_is_limited(client, limits_on):
    codes = [client.post("/api/v1/auth/forgot-password", json={"email": "x@example.com"}).status_code for _ in range(4)]
    assert codes == [202, 202, 202, 429]
