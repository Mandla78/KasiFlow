"""
Application factory. create_app() builds the app: config, extensions,
blueprints, one error handler for every AppError, and the CLI.
(Pattern reused from TruConnect; see REUSE.md.)
"""
from __future__ import annotations

import logging

from flask import Flask

from src.config import get_config
from src.extensions import bcrypt, db, jwt, ma, migrate


def create_app(env_name: str | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(get_config(env_name))

    _register_extensions(app)
    _register_models()
    _register_blueprints(app)
    _register_listeners(app)
    _register_error_handlers(app)
    _register_input_guard(app)
    _register_security_headers(app)
    _register_cli(app)

    # Background jobs (identity clean-up, idempotency sweep). Not in tests.
    if app.config.get("SCHEDULER_ENABLED"):
        from src.master_scheduler import trigger

        trigger.start(app)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    app.logger.info("Akayza backend ready (env=%s)", env_name or "development")
    return app


def _register_extensions(app: Flask) -> None:
    from src.shared.rate_limit import responses as rate_limit_responses
    from src.shared.rate_limit.limiter import limiter

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    from src.domains.identity.auth.services import jwt_callbacks

    jwt_callbacks.register(jwt)
    ma.init_app(app)
    bcrypt.init_app(app)
    limiter.init_app(app)
    rate_limit_responses.register(app)

    # Only where configured (development's web preview); never in production.
    if app.config.get("CORS_ORIGINS"):
        from flask_cors import CORS

        CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}}, supports_credentials=False)


def _register_models() -> None:
    """Import every feature's models so they're in SQLAlchemy's metadata
    (migrations and tests need them). Explicit on purpose: a clever scan
    would hide which tables exist. Add one line per feature as its tables
    are built, e.g.:
        from src.domains.identity.accounts import models  # noqa: F401
    """
    # Infrastructure (platform schema)
    from src.shared.idempotency import models  # noqa: F401
    # identity schema: accounts, auth, devices
    from src.domains.identity.accounts import models as _accounts  # noqa: F401
    from src.domains.identity.auth import models as _auth  # noqa: F401
    from src.domains.identity.devices import models as _devices  # noqa: F401
    # trader schema: the informal trader's own data
    from src.domains.informal_trader.business_profile import models as _business_profile  # noqa: F401
    # platform schema: every media upload, start to finish
    from src.shared.media import models as _media  # noqa: F401
    # audit schema: the append-only audit trail
    from src.domains.security.audit import models as _audit  # noqa: F401


def _register_listeners(app: Flask) -> None:
    """Subscribers to shared events: the audit trail stores every audit event."""
    from src.domains.security.audit.services import audit_service
    from src.shared.rate_limit import responses as rate_limit_responses
    from src.domains.identity.auth.rate_limit.policies import RATE_LIMIT_AUDIT_EVENTS

    audit_service.register(app)
    rate_limit_responses.register_audit_events(RATE_LIMIT_AUDIT_EVENTS)

    # Cloudinary scan verdicts, routed to the feature that owns the folder.
    from src.domains.informal_trader.business_profile.services import profile_image_service
    from src.shared.media import folders, notifications

    notifications.clear_handlers()  # create_app can run more than once (tests)
    notifications.on_verdict(folders.is_informal_trader_profile_asset, profile_image_service.apply_verdict)


def _register_blueprints(app: Flask) -> None:
    from src.api import api_bp

    app.register_blueprint(api_bp, url_prefix="/api/v1")
    # The page the reset email's button opens (outside /api/v1: it must match the emailed URL).
    from src.domains.identity.auth.api.reset_page import reset_page_bp

    app.register_blueprint(reset_page_bp)
    # Cloudinary calls this one itself (HMAC-signed), not a signed-in user.
    from src.shared.media.routes import media_webhooks_bp

    app.register_blueprint(media_webhooks_bp)


def _register_error_handlers(app: Flask) -> None:
    from src.core.exceptions import AppError
    from src.core.responses import error_response

    @app.errorhandler(AppError)
    def handle_app_error(error: AppError):
        return error_response(
            message=error.message,
            errors=error.errors,
            status_code=error.status_code,
            code=error.code,
            data=error.data,
        )

    @app.errorhandler(413)
    def handle_too_large(_error):
        return error_response(message="That request is too large.", status_code=413, code="PAYLOAD_TOO_LARGE")

    @app.errorhandler(404)
    def handle_not_found(_error):
        return error_response(message="Resource not found", status_code=404, code="NOT_FOUND")

    @app.errorhandler(405)
    def handle_method_not_allowed(_error):
        return error_response(message="Method not allowed", status_code=405, code="METHOD_NOT_ALLOWED")

    @app.errorhandler(500)
    def handle_internal_error(error):
        app.logger.exception("Unhandled server error: %s", error)
        return error_response(message="Internal server error", status_code=500, code="INTERNAL_ERROR")


def _register_input_guard(app: Flask) -> None:
    """Refuse any request carrying the NUL character anywhere (JSON, form,
    query). PostgreSQL can't store it and no human types it; it only
    arrives in attacks and broken clients. Fields also clean their own text
    (shared/validation/text.py); this is the net under them."""
    from flask import request

    from src.core.responses import error_response

    def _has_nul(value) -> bool:
        if isinstance(value, str):
            return "\x00" in value
        if isinstance(value, dict):
            return any(_has_nul(k) or _has_nul(v) for k, v in value.items())
        if isinstance(value, list):
            return any(_has_nul(v) for v in value)
        return False

    @app.before_request
    def _refuse_nul():
        found = any(_has_nul(v) for v in request.args.values()) or any(_has_nul(v) for v in request.form.values())
        if not found and request.is_json:
            found = _has_nul(request.get_json(silent=True))
        if found:
            return error_response(message="The request contains characters we don't accept.", status_code=400, code="INVALID_CHARACTERS")


def _register_security_headers(app: Flask) -> None:
    """Headers on every response. The API returns JSON with tokens and
    personal data: nothing may be cached, sniffed as another type, or framed."""

    @app.after_request
    def _headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
        response.headers.pop("Server", None)
        return response


def _register_cli(app: Flask) -> None:
    from src.cli import register_cli

    register_cli(app)
