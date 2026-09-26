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

from src.shared.constants.constants import (
    DEFAULT_MAIL_MAX_RETRIES,
    DEFAULT_MAIL_RETRY_DELAYS_SECONDS,
    DEFAULT_MAIL_TIMEOUT_SECONDS,
)

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
    # Requests are small JSON; photos go straight to the media provider.
    # Anything bigger is refused before it is read (413).
    MAX_CONTENT_LENGTH = 1 * 1024 * 1024

    # Tokens: short access, rotating refresh (PLAN 02).
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", 15)))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 30)))
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_TYPE = "Bearer"

    # Email. "smtp" (the default) sends through any SMTP relay (Gmail today;
    # Brevo, SendGrid, Amazon SES, Mailgun later): swapping providers is only
    # these settings, never code. "fake" keeps emails in memory for the
    # tests and sends nothing; codes are never written to any log.
    MAIL_PROVIDER = os.environ.get("MAIL_PROVIDER", "smtp")
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = _bool("MAIL_USE_TLS", "true")  # STARTTLS, port 587
    MAIL_USE_SSL = _bool("MAIL_USE_SSL", "false")  # implicit TLS, port 465
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "Akayza <no-reply@akayza.co.za>")
    MAIL_REPLY_TO = os.environ.get("MAIL_REPLY_TO", "")

    # Delivery BEHAVIOUR is decided in code, not per environment: reviewed,
    # the same on every machine, and not changeable by a stray .env line.
    MAIL_TIMEOUT = DEFAULT_MAIL_TIMEOUT_SECONDS  # 10 s per SMTP attempt
    MAIL_MAX_RETRIES = DEFAULT_MAIL_MAX_RETRIES  # 3 attempts
    MAIL_RETRY_DELAYS = DEFAULT_MAIL_RETRY_DELAYS_SECONDS  # 5, 15, 60 s between attempts
    MAIL_ASYNC = True  # send in the background; a slow mail server never slows a request

    # Sign-in hardening.
    EMAIL_CODE_EXPIRY_MINUTES = int(os.environ.get("EMAIL_CODE_EXPIRY_MINUTES", 15))
    EMAIL_CODE_MAX_ATTEMPTS = int(os.environ.get("EMAIL_CODE_MAX_ATTEMPTS", 5))
    LOGIN_MAX_FAILED_ATTEMPTS = int(os.environ.get("LOGIN_MAX_FAILED_ATTEMPTS", 5))
    LOGIN_LOCKOUT_MINUTES = int(os.environ.get("LOGIN_LOCKOUT_MINUTES", 15))
    # Two-factor: a phone that passed the email code skips it until it goes
    # this many days unused (or is signed out from Security).
    TRUSTED_PHONE_DAYS = 90

    # Password reset links (one use).
    PASSWORD_RESET_EXPIRY_MINUTES = int(os.environ.get("PASSWORD_RESET_EXPIRY_MINUTES", 30))
    # The backend's public address, used in links inside emails (email apps
    # strip akayza:// links, so the reset button opens {APP_BASE_URL}/reset-password).
    # Development: the PC's Wi-Fi address (like the app's API URL). Production: https.
    APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:5000").rstrip("/")

    # PayFast (docs/supplier/07). sandbox or live; the key and passphrase
    # never leave the server. PAYFAST_TRUST_PROXY: behind a tunnel or load
    # balancer, take PayFast's address from the last X-Forwarded-For entry
    # (the one our own proxy added) instead of the direct connection.
    PAYFAST_MODE = os.environ.get("PAYFAST_MODE", "sandbox")
    PAYFAST_MERCHANT_ID = os.environ.get("PAYFAST_MERCHANT_ID", "").strip()
    PAYFAST_MERCHANT_KEY = os.environ.get("PAYFAST_MERCHANT_KEY", "").strip()
    PAYFAST_PASSPHRASE = os.environ.get("PAYFAST_PASSPHRASE", "").strip()
    PAYFAST_TRUST_PROXY = _bool("PAYFAST_TRUST_PROXY", "false")

    # The legal document versions a new account must accept. Must match the
    # app's content/legal files; bump both when a document changes.
    PRIVACY_POLICY_VERSION = os.environ.get("PRIVACY_POLICY_VERSION", "0.2-draft")
    TERMS_VERSION = os.environ.get("TERMS_VERSION", "0.2-draft")

    # Continue with Google: the OAuth client IDs our app uses (Android and
    # web), comma-separated. A Google token is only accepted if it was
    # issued to one of these. Empty = Google sign-in switched off.
    GOOGLE_CLIENT_IDS = [c.strip() for c in os.environ.get("GOOGLE_CLIENT_IDS", "").split(",") if c.strip()]

    # CIPC company check (business profile). "sandbox" = a small fake
    # register for development and tests; "none" = no provider connected,
    # so every check answers "unavailable" (never a fake "verified").
    CIPC_PROVIDER = os.environ.get("CIPC_PROVIDER", "sandbox")

    # Mapbox token for address search and reverse geocoding. Server-side
    # only: the app has its own public token for drawing the map.
    MAPBOX_TOKEN = os.environ.get("MAPBOX_TOKEN", "")

    # Background jobs (clean-ups). Off in tests, which call jobs directly.
    SCHEDULER_ENABLED = True

    # Rate limiting (in-memory for dev; Redis in production).
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_HEADERS_ENABLED = True


class DevelopmentConfig(BaseConfig):
    ENV_NAME = "development"
    DEBUG = True
    # The Expo web preview runs in a browser at another origin. Phones don't
    # need CORS; production allows no browser origins at all.
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:8081").split(",") if o.strip()]
    SQLALCHEMY_DATABASE_URI = _database_uri()


class TestingConfig(BaseConfig):
    ENV_NAME = "testing"
    TESTING = True
    SECRET_KEY = os.environ.get("SECRET_KEY", "test-secret-key")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "test-jwt-secret-key-long-enough-32b")
    SQLALCHEMY_DATABASE_URI = os.environ.get("TEST_DATABASE_URL") or _database_uri("POSTGRES_TEST_DB", "akayza_test")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)
    MAIL_PROVIDER = "fake"
    MAIL_ASYNC = False  # send inline so tests can read the fake outbox
    SCHEDULER_ENABLED = False
    # Limiter storage must exist so rate-limit tests can switch it on;
    # tests/conftest.py turns limiting OFF for every other test.
    RATELIMIT_ENABLED = True


class ProductionConfig(BaseConfig):
    ENV_NAME = "production"
    # No real CIPC provider is contracted yet: never the sandbox in production.
    CIPC_PROVIDER = os.environ.get("CIPC_PROVIDER", "none").replace("sandbox", "none")
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
        # A short signing secret can be brute-forced, letting anyone forge tokens.
        weak = [k for k in ("SECRET_KEY", "JWT_SECRET_KEY") if len(os.environ.get(k, "")) < 32]
        if weak:
            raise RuntimeError(f"These secrets must be at least 32 characters: {', '.join(weak)}.")
    if env_name == "production":
        # The fake provider sends nothing: never in production.
        if os.environ.get("MAIL_PROVIDER", "smtp") == "fake":
            raise RuntimeError("MAIL_PROVIDER=fake is not allowed in production. Configure an SMTP provider.")
        mail_missing = [k for k in ("MAIL_SERVER", "MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_DEFAULT_SENDER") if not os.environ.get(k)]
        if mail_missing:
            raise RuntimeError(f"Missing email settings for production: {', '.join(mail_missing)}.")
        if not os.environ.get("APP_BASE_URL", "").startswith("https://"):
            raise RuntimeError("APP_BASE_URL must be the https address of this backend in production.")
        if os.environ.get("MEDIA_PROVIDER", "cloudinary") != "cloudinary":
            raise RuntimeError("MEDIA_PROVIDER must be cloudinary in production.")
        media_missing = [k for k in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET") if not os.environ.get(k)]
        if media_missing:
            raise RuntimeError(f"Missing media settings for production: {', '.join(media_missing)}.")
    return config
