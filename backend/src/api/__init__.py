"""
The /api/v1 blueprint. Platform-level routes (health) live here; each
domain registers its own routes on this blueprint from its api/ package.
"""
from __future__ import annotations

from flask import Blueprint
from sqlalchemy import text

from src.core.responses import error_response, success_response
from src.extensions import db

api_bp = Blueprint("api", __name__)


@api_bp.get("/health")
def health():
    """Public. Reports whether the API and the database answer; used by
    the app on start-up and by monitoring."""
    try:
        db.session.execute(text("SELECT 1"))
        return success_response({"status": "ok", "database": "ok"}, message="Akayza API is healthy")
    except Exception:  # noqa: BLE001
        return error_response(message="Database unavailable", status_code=503, code="DB_UNAVAILABLE")


# Each feature's routes attach to api_bp by being imported here.
from src.domains.identity.accounts.api import routes as _accounts_routes  # noqa: E402,F401
from src.domains.identity.auth.api import routes as _auth_routes  # noqa: E402,F401
from src.domains.informal_trader.business_profile.api import routes as _business_profile_routes  # noqa: E402,F401
from src.domains.informal_trader.credit_book.api import routes as _credit_book_routes  # noqa: E402,F401
from src.domains.informal_trader.jobs.api import routes as _jobs_routes  # noqa: E402,F401
from src.domains.informal_trader.builder_network.api import routes as _builder_network_routes  # noqa: E402,F401
from src.domains.informal_trader.order_book.api import routes as _order_book_routes  # noqa: E402,F401
from src.domains.commerce.orders.api import routes as _orders_routes  # noqa: E402,F401
from src.domains.commerce.payments.api import routes as _payments_routes  # noqa: E402,F401
from src.domains.commerce.documents.api import routes as _documents_routes  # noqa: E402,F401
from src.domains.supplier.catalogue.api import routes as _catalogue_routes  # noqa: E402,F401
from src.domains.supplier.connections.api import routes as _connections_routes  # noqa: E402,F401
from src.domains.supplier.recommendation.api import routes as _recommendation_routes  # noqa: E402,F401
from src.shared.geocoding import routes as _geocoding_routes  # noqa: E402,F401
