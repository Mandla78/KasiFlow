"""Email is production-ready: plain-text twins, proper headers, and a
production config that refuses the fake provider."""
from __future__ import annotations

import pytest

from src.config import get_config
from src.shared.email.email import EmailService, SMTPEmailProvider


def test_every_email_has_a_plain_text_version(app, outbox):
    with app.test_request_context():
        EmailService.send_template(to="a@example.com", template_name="verify_email.html", subject="Your Akayza code", context={"code": "482193", "minutes": 15})
    sent = outbox[-1]
    assert "482193" in sent["text_body"] and "<" not in sent["text_body"]
    assert "482193" in sent["html_body"]


def test_smtp_message_has_text_html_and_delivery_headers(monkeypatch):
    captured = {}

    class FakeServer:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def send_message(self, msg):
            captured["msg"] = msg

    provider = SMTPEmailProvider(
        host="smtp.example.com", port=587, use_tls=True, username="u", password="p",
        default_sender="Akayza <no-reply@akayza.co.za>", timeout=5, reply_to="help@akayza.co.za",
    )
    monkeypatch.setattr(provider, "_connect", lambda: FakeServer())
    provider.send("b@example.com", "Hi", "<p>Hello</p>", "Hello")

    msg = captured["msg"]
    assert msg["Date"] and msg["Message-ID"].endswith("@akayza.co.za>")
    assert msg["Reply-To"] == "help@akayza.co.za"
    types = [part.get_content_type() for part in msg.iter_parts()]
    assert types == ["text/plain", "text/html"]


def test_codes_never_reach_the_logs(client, outbox, caplog):
    """Sign-up codes go to the inbox only: not the log, at any level."""
    import logging
    import re

    caplog.set_level(logging.DEBUG)
    client.post(
        "/api/v1/auth/register",
        json={"email": "logs@example.com", "password": "Spaza2026!",
              "consent": {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}},
    )
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    assert code not in caplog.text


def test_production_refuses_fake_email(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "x" * 64)
    monkeypatch.setenv("JWT_SECRET_KEY", "y" * 64)
    monkeypatch.setenv("MAIL_PROVIDER", "fake")
    with pytest.raises(RuntimeError, match="not allowed in production"):
        get_config("production")


def test_production_requires_mail_settings(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "x" * 64)
    monkeypatch.setenv("JWT_SECRET_KEY", "y" * 64)
    monkeypatch.setenv("MAIL_PROVIDER", "smtp")
    for k in ("MAIL_SERVER", "MAIL_USERNAME", "MAIL_PASSWORD"):
        monkeypatch.delenv(k, raising=False)
    with pytest.raises(RuntimeError, match="Missing email settings"):
        get_config("production")
