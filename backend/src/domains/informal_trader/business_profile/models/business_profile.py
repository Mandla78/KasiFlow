"""
BusinessProfile -- what a trader told us at sign-up (and edits later from
More > Business profile). One per account.

THE SERVER OWNS THE CIPC RESULT. The app sends a registration number; only
the server's check sets cipc_status. A phone can't hand itself a verified
badge.

Soft delete (BaseModel): a closed account's profile is anonymised by the
retention job, never silently dropped while orders still point at it.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import BUSINESS_TYPES, CIPC_STATUSES, FULFILMENT, PAYMENT, RESTOCK, SPEND, TRADES, YEARS_TRADING


def _one_of(column: str, values: tuple, name: str) -> db.CheckConstraint:
    allowed = ", ".join(f"'{v}'" for v in values)
    return db.CheckConstraint(f"{column} IS NULL OR {column} IN ({allowed})", name=name)


class BusinessProfile(BaseModel):
    __tablename__ = "business_profiles"
    __table_args__ = (
        _one_of("business_type", BUSINESS_TYPES, "ck_business_profiles_business_type"),
        _one_of("trade", TRADES, "ck_business_profiles_trade"),
        _one_of("years_trading", YEARS_TRADING, "ck_business_profiles_years_trading"),
        _one_of("cipc_status", CIPC_STATUSES, "ck_business_profiles_cipc_status"),
        _one_of("restock", RESTOCK, "ck_business_profiles_restock"),
        _one_of("spend", SPEND, "ck_business_profiles_spend"),
        _one_of("payment", PAYMENT, "ck_business_profiles_payment"),
        _one_of("fulfilment", FULFILMENT, "ck_business_profiles_fulfilment"),
        {"schema": "trader"},
    )

    #: The account (identity.users). One profile per account.
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Your business
    business_type = db.Column(db.String(20), nullable=True)
    trade = db.Column(db.String(30), nullable=True)
    owner_name = db.Column(db.String(80), nullable=True)
    years_trading = db.Column(db.String(10), nullable=True)
    cellphone = db.Column(db.String(10), nullable=True)

    # Registration (optional)
    sole_trader = db.Column(db.Boolean, nullable=False, default=False)
    cipc_number = db.Column(db.String(14), nullable=True)
    cipc_status = db.Column(db.String(20), nullable=True)
    cipc_registered_name = db.Column(db.String(160), nullable=True)
    cipc_entity_type = db.Column(db.String(60), nullable=True)
    cipc_checked_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # Where you are: the pin the trader confirmed, and their own address text.
    building = db.Column(db.String(120), nullable=True)
    street = db.Column(db.String(160), nullable=True)
    suburb = db.Column(db.String(120), nullable=True)
    city = db.Column(db.String(120), nullable=True)
    province = db.Column(db.String(60), nullable=True)
    postal_code = db.Column(db.String(10), nullable=True)
    latitude = db.Column(db.Numeric(9, 6), nullable=True)
    longitude = db.Column(db.Numeric(9, 6), nullable=True)

    # What you buy: feeds the supplier recommendation engine.
    categories = db.Column(ARRAY(db.String(40)), nullable=False, default=list)
    restock = db.Column(db.String(20), nullable=True)
    spend = db.Column(db.String(20), nullable=True)
    payment = db.Column(db.String(10), nullable=True)
    fulfilment = db.Column(db.String(10), nullable=True)

    tools = db.Column(JSONB, nullable=False, default=dict)

    #: The CURRENT approved profile photo (see business_profile_image.py).
    profile_image_url = db.Column(db.String(1000), nullable=True)

    #: First time every required answer was in: onboarding finished.
    onboarded_at = db.Column(db.DateTime(timezone=True), nullable=True)
