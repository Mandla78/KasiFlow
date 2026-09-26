"""
The client's IP (shared/net/client_ip.py, FINDING_client_ip_behind_cloudflare
and its DECISION): with BEHIND_CLOUDFLARE off it's the connection's own
address, full stop, and a forged X-Forwarded-For or CF-Connecting-IP never
reaches sessions, consents, audit rows or rate-limit keys. With it on,
Cloudflare's CF-Connecting-IP, when it holds one valid address.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

import pytest

from src.domains.identity.accounts.models.consent import Consent
from src.domains.identity.auth.models.credentials import Session
from src.domains.security.audit.models import AuditEventRecord
from src.shared.audit.audit_context import get_ip_address
from src.shared.net.client_ip import client_ip, client_ip_key
from src.shared.rate_limit.limiter import limiter

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
TEST_CLIENT_IP = "127.0.0.1"  # what the test client's connection says
FORGED = {"X-Forwarded-For": "6.6.6.6", "CF-Connecting-IP": "7.7.7.7", "X-Real-IP": "8.8.8.8"}


@pytest.fixture
def cloudflare(app, monkeypatch):
    monkeypatch.setitem(app.config, "BEHIND_CLOUDFLARE", True)


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


def ip_for(app, headers: dict, remote: str = "10.1.2.3") -> tuple:
    with app.test_request_context("/", headers=headers, environ_base={"REMOTE_ADDR": remote}):
        return client_ip(), get_ip_address(), client_ip_key()


def sign_up(client, outbox, headers: dict) -> str:
    email = f"ip-{uuid.uuid4().hex[:8]}@example.com"
    client.post("/api/v1/auth/register", headers=headers, json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    r = client.post("/api/v1/auth/verify-email", headers=headers, json={"email": email, "code": code})
    assert r.status_code == 200, r.get_json()
    return email


def ips_recorded(app, since) -> dict:
    """Every IP the sign-up left behind: its session, its consents, its audit rows."""
    with app.app_context():
        return {
            "sessions": {s.ip_address for s in Session.query.all()},
            "consents": {c.ip_address for c in Consent.query.all()},
            "audit": {r.ip_address for r in AuditEventRecord.query.filter(AuditEventRecord.timestamp >= since)},
        }


# -------------------------------------------------------------- the helper


def test_off_by_default(app):
    assert app.config["BEHIND_CLOUDFLARE"] is False


def test_off_it_is_the_connection_full_stop(app):
    assert ip_for(app, FORGED) == ("10.1.2.3", "10.1.2.3", "10.1.2.3")
    assert ip_for(app, {}) == ("10.1.2.3", "10.1.2.3", "10.1.2.3")


def test_on_it_is_cloudflares_address(app, cloudflare):
    assert ip_for(app, {"CF-Connecting-IP": "41.13.0.7"})[:2] == ("41.13.0.7", "41.13.0.7")
    # In its normal form, so one person is one key.
    assert ip_for(app, {"CF-Connecting-IP": " 2001:DB8:0:0:0:0:0:1 "})[0] == "2001:db8::1"
    # Only Cloudflare's own header: the others stay ignored.
    assert ip_for(app, {"X-Forwarded-For": "6.6.6.6"})[0] == "10.1.2.3"


@pytest.mark.parametrize(
    "value",
    ["", "   ", "not-an-ip", "41.13.0.7, 6.6.6.6", "999.1.1.1", "localhost", "1" * 60, "41.13.0.7:443", "[2001:db8::1]", "<script>"],
)
def test_on_a_bad_header_falls_back_to_the_connection(app, cloudflare, value):
    assert ip_for(app, {"CF-Connecting-IP": value})[0] == "10.1.2.3"


def test_outside_a_request_there_is_no_ip(app):
    with app.app_context():
        assert client_ip() is None and get_ip_address() is None


# ----------------------------------------------- what the app writes down


def test_off_a_forged_header_never_reaches_sessions_consents_or_audit(app, client, outbox):
    since = datetime.now(timezone.utc)
    sign_up(client, outbox, FORGED)
    recorded = ips_recorded(app, since)
    assert recorded["sessions"] == {TEST_CLIENT_IP}
    assert recorded["consents"] == {TEST_CLIENT_IP}
    assert recorded["audit"] and recorded["audit"] <= {TEST_CLIENT_IP, None}
    for ips in recorded.values():
        assert not ips & {"6.6.6.6", "7.7.7.7", "8.8.8.8"}


def test_on_they_get_the_address_cloudflare_saw(app, client, outbox, cloudflare):
    since = datetime.now(timezone.utc)
    sign_up(client, outbox, {"CF-Connecting-IP": "41.13.0.7", "X-Forwarded-For": "6.6.6.6"})
    recorded = ips_recorded(app, since)
    assert recorded["sessions"] == {"41.13.0.7"} and recorded["consents"] == {"41.13.0.7"}
    assert "41.13.0.7" in recorded["audit"] and "6.6.6.6" not in recorded["audit"]


# ----------------------------------------------------------- rate limits


def test_off_forged_headers_dont_buy_more_tries(client, limits_on):
    codes = [
        client.post("/api/v1/auth/forgot-password", headers={"X-Forwarded-For": f"6.6.6.{i}", "CF-Connecting-IP": f"7.7.7.{i}"}, json={"email": "x@example.com"}).status_code
        for i in range(4)
    ]
    assert codes == [202, 202, 202, 429]


def test_on_two_places_have_their_own_allowance(client, limits_on, cloudflare):
    def forgot(ip):
        return client.post("/api/v1/auth/forgot-password", headers={"CF-Connecting-IP": ip}, json={"email": "x@example.com"}).status_code

    assert [forgot("41.13.0.7") for _ in range(3)] == [202, 202, 202]
    assert [forgot("41.13.0.8") for _ in range(3)] == [202, 202, 202]
    assert forgot("41.13.0.7") == 429


def test_the_429_audit_records_the_client_ip(app, client, limits_on, cloudflare):
    since = datetime.now(timezone.utc)
    body = {"email": f"rl-{uuid.uuid4().hex[:8]}@example.com", "password": "Wrong2026!"}
    codes = [client.post("/api/v1/auth/login", headers={"CF-Connecting-IP": "41.13.0.9"}, json=body).status_code for _ in range(6)]
    assert codes[5] == 429
    with app.app_context():
        rows = AuditEventRecord.query.filter(AuditEventRecord.event_name == "auth.login_rate_limited", AuditEventRecord.timestamp >= since).all()
    assert rows and {r.ip_address for r in rows} == {"41.13.0.9"}
