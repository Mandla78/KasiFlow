"""
User -- one person's Akayza account. OWNED BY accounts: auth/ and
devices/ read it through accounts' services and never write it directly.

The email is stored lower-cased and trimmed (the unique index is on that
form), so "Nomsa@Gmail.com " and "nomsa@gmail.com" are the same account.
"""
from __future__ import annotations

import enum

from src.core.base_model import BaseModel
from src.extensions import db


class AccountStatus(str, enum.Enum):
    UNVERIFIED = "unverified"  # created, email not confirmed yet
    ACTIVE = "active"
    DEACTIVATED = "deactivated"  # closed by the user or by us


class Dashboard(str, enum.Enum):
    """Which dashboard the account opens. Only informal businesses sign up
    in the app today; suppliers are invited through the integration."""

    INFORMAL_BUSINESS = "informal_business"
    SUPPLIER = "supplier"


class SignUpMethod(str, enum.Enum):
    EMAIL = "email"
    GOOGLE = "google"


class User(BaseModel):
    __tablename__ = "users"
    __table_args__ = (
        db.CheckConstraint("status IN ('unverified', 'active', 'deactivated')", name="ck_users_status"),
        db.CheckConstraint("dashboard IN ('informal_business', 'supplier')", name="ck_users_dashboard"),
        db.CheckConstraint("signed_up_with IN ('email', 'google')", name="ck_users_signed_up_with"),
        {"schema": "identity"},
    )

    email = db.Column(db.String(254), nullable=False, unique=True, index=True)
    status = db.Column(db.String(20), nullable=False, default=AccountStatus.UNVERIFIED.value)
    dashboard = db.Column(db.String(30), nullable=False, default=Dashboard.INFORMAL_BUSINESS.value)
    signed_up_with = db.Column(db.String(10), nullable=False, default=SignUpMethod.EMAIL.value)
    #: The trading name given at sign-up. The full business profile
    #: (type, area, categories...) lives in informal_trader/business_profile.
    business_name = db.Column(db.String(80), nullable=False)
    email_verified_at = db.Column(db.DateTime(timezone=True), nullable=True)
    last_login_at = db.Column(db.DateTime(timezone=True), nullable=True)

    @property
    def is_active(self) -> bool:
        return self.status == AccountStatus.ACTIVE.value and not self.is_deleted
