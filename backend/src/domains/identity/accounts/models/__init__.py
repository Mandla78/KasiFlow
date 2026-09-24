"""models -- the accounts tables (SQLAlchemy). Add the import to _register_models in src/__init__.py and write a migration.
"""
from .consent import Consent, LegalDocument  # noqa: E402,F401
from .user import AccountStatus, Dashboard, SignUpMethod, User  # noqa: E402,F401
