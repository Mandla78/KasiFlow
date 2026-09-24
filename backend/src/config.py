"""
Configuration, per environment. Every secret and environment-specific
value comes from environment variables (.env, loaded by python-dotenv);
nothing secret is written here.

(Structure reused from TruConnect; see REUSE.md.)
"""
from __future__ import annotations

import os
from datetime import timedelta
from urllib.parse import quote

# PostgreSQL schemas. These group TABLES (storage, backups, access
# rights); they are NOT the same thing as the code's domains, and don't
# have to line up one-to-one. A feature's models say which schema they
# live in with __table_args__ = {"schema": "..."}. The first migration
# creates them all, so a fresh database has the full shape from day one.
DB_SCHEMAS = (
    "identity",   # accounts, credentials, device keys
    "trader",     # informal trader data: business profile, credit book, jobs
    "supplier",   # supplier profiles, catalogue, integration keys
    "commerce",   # orders and payments between traders and suppliers
    "proof",      # sealed events, handshakes, flags, reputation, share links
    "audit",      # security and audit events
    "platform",   # infrastructure no domain owns: idempotency keys
)


def _bool(name: str, default: str) -> bool:
    return os.environ.get(name, default).lower() in ("true", "1", "yes")


def _database_uri(db_name_var: str = "POSTGRES_DB", default_db: str = "akayza_dev") -> str:
    """DATABASE_URL wins if set (managed hosts give one string). Otherwise
    built from POSTGRES_* parts; user and password are URL-encoded so a
    special character in a password can't break the URI."""
    if os.environ.get("DATABASE_URL") and db_name_var == "POSTGRES_DB":
        return os.environ["DATABASE_URL"]
    user = quote(os.environ.get("POSTGRES_USER", "akayza"))
    password = quote(os.environ.get("POSTGRES_PASSWORD", ""))
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    name = os.environ.get(db_name_var, default_db)
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"


class BaseConfig:
    SECRET_KEY = os.environ.get("SECRET_KEY", "")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # Tokens: short access, rotating refresh (PLAN 02).
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", 15)))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 30)))
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_TYPE = "Bearer"

    # Email ("fake" prints codes to the log; a real provider later).
    MAIL_PROVIDER = os.environ.get("MAIL_PROVIDER", "fake")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "Akayza <no-reply@akayza.co.za>")

    # Sign-in hardening.
    EMAIL_CODE_EXPIRY_MINUTES = int(os.environ.get("EMAIL_CODE_EXPIRY_MINUTES", 15))
    EMAIL_CODE_MAX_ATTEMPTS = int(os.environ.get("EMAIL_CODE_MAX_ATTEMPTS", 5))
    LOGIN_MAX_FAILED_ATTEMPTS = int(os.environ.get("LOGIN_MAX_FAILED_ATTEMPTS", 5))
    LOGIN_LOCKOUT_MINUTES = int(os.environ.get("LOGIN_LOCKOUT_MINUTES", 15))

    # Password reset links (one use).
    PASSWORD_RESET_EXPIRY_MINUTES = int(os.environ.get("PASSWORD_RESET_EXPIRY_MINUTES", 30))
    # Where the reset link opens: the app's deep link.
    PASSWORD_RESET_URL = os.environ.get("PASSWORD_RESET_URL", "akayza://reset-password")

    # The legal document versions a new account must accept. Must match the
    # app's content/legal files; bump both when a document changes.
    PRIVACY_POLICY_VERSION = os.environ.get("PRIVACY_POLICY_VERSION", "0.1-draft")
    TERMS_VERSION = os.environ.get("TERMS_VERSION", "0.1-draft")

    # Mapbox token for address search and reverse geocoding. Server-side
    # only: the app has its own public token for drawing the map.
    MAPBOX_TOKEN = os.environ.get("MAPBOX_TOKEN", "")

    # Rate limiting (in-memory for dev; Redis in production).
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_HEADERS_ENABLED = True


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = _database_uri()


class TestingConfig(BaseConfig):
    TESTING = True
    SECRET_KEY = os.environ.get("SECRET_KEY", "test-secret-key")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "test-jwt-secret-key-long-enough-32b")
    SQLALCHEMY_DATABASE_URI = os.environ.get("TEST_DATABASE_URL") or _database_uri("POSTGRES_TEST_DB", "akayza_test")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)
    MAIL_PROVIDER = "fake"
    MAIL_ASYNC = False  # send inline so tests can read the fake outbox
    RATELIMIT_ENABLED = False


class ProductionConfig(BaseConfig):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = _database_uri()


CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(env_name: str | None = None):
    env_name = env_name or os.environ.get("FLASK_ENV", "development")
    config = CONFIG_MAP.get(env_name, DevelopmentConfig)
    # Refuse to start with empty secrets outside tests: an app that runs
    # with a blank JWT key signs tokens anyone can forge.
    if env_name != "testing":
        missing = [k for k in ("SECRET_KEY", "JWT_SECRET_KEY") if not os.environ.get(k)]
        if missing:
            raise RuntimeError(f"Missing required settings: {', '.join(missing)}. Copy .env.example to .env.")
    return config
