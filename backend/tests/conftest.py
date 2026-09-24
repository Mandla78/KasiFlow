"""
Test setup: the real PostgreSQL test database (akayza_test), migrated to
the latest version once per run, with the identity tables emptied before
every test so tests never depend on each other.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from dotenv import load_dotenv
from sqlalchemy import text

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from src import create_app  # noqa: E402
from src.extensions import db  # noqa: E402
from src.shared.cache import cache as cache_module  # noqa: E402
from src.shared.email.email import get_fake_provider  # noqa: E402
from src.shared.rate_limit.limiter import limiter  # noqa: E402

IDENTITY_TABLES = ["sessions", "devices", "email_codes", "password_resets", "password_credentials", "consents", "users"]


@pytest.fixture(scope="session")
def app():
    app = create_app("testing")
    with app.app_context():
        from flask_migrate import upgrade

        upgrade()
    return app


@pytest.fixture(autouse=True)
def clean(app):
    with app.app_context():
        db.session.execute(text("TRUNCATE " + ", ".join(f"identity.{t}" for t in IDENTITY_TABLES) + " CASCADE"))
        db.session.commit()
    get_fake_provider().clear()
    # Per-address email limits live in memory for the whole run; each test
    # starts with fresh counters (the limit itself is tested separately).
    cache_module.cache.clear()
    # Limits off by default; tests/domains/identity/test_rate_limits.py turns them on.
    limiter.enabled = False
    yield
    with app.app_context():
        db.session.remove()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def outbox():
    return get_fake_provider().sent_emails
