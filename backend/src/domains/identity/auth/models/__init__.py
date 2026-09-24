"""models -- the auth tables (SQLAlchemy). Add the import to _register_models in src/__init__.py and write a migration.
"""
from .credentials import CodePurpose, EmailCode, GoogleIdentity, PasswordCredential, PasswordReset, Session  # noqa: E402,F401
from .trusted_phone import TrustedPhone  # noqa: E402,F401
