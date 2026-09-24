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
    _register_error_handlers(app)
    _register_cli(app)

    # The master scheduler (src/master_scheduler) starts here once the
    # first feature that owns a job has its tables:
    #     from src.master_scheduler import trigger
    #     trigger.start(app)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    app.logger.info("Akayza backend ready (env=%s)", env_name or "development")
    return app


def _register_extensions(app: Flask) -> None:
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    ma.init_app(app)
    bcrypt.init_app(app)


def _register_models() -> None:
    """Import every feature's models so they're in SQLAlchemy's metadata
    (migrations and tests need them). Explicit on purpose: a clever scan
    would hide which tables exist. Add one line per feature as its tables
    are built, e.g.:
        from src.domains.identity.accounts import models  # noqa: F401
    """
    # Infrastructure (platform schema)
    from src.shared.idempotency import models  # noqa: F401


def _register_blueprints(app: Flask) -> None:
    from src.api import api_bp

    app.register_blueprint(api_bp, url_prefix="/api/v1")


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


def _register_cli(app: Flask) -> None:
    from src.cli import register_cli

    register_cli(app)
