"""
DeliveryAddress -- a place the trader has stock delivered to, besides the
business address (which stays in the business profile).

Removing one soft-deletes it (BaseModel), so an order that went there
still reads right. At most one LIVE default per trader (partial unique
index); the business address is used when none is the default.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db


class DeliveryAddress(BaseModel):
    __tablename__ = "delivery_addresses"
    __table_args__ = (
        db.Index(
            "uq_delivery_addresses_one_default",
            "user_id",
            unique=True,
            postgresql_where=db.text("is_default AND NOT is_deleted"),
        ),
        # Roughly South Africa, as the business profile's pin.
        db.CheckConstraint("latitude BETWEEN -35.5 AND -21.5", name="ck_delivery_addresses_latitude"),
        db.CheckConstraint("longitude BETWEEN 16.0 AND 33.5", name="ck_delivery_addresses_longitude"),
        {"schema": "trader"},
    )

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, index=True)
    label = db.Column(db.String(30), nullable=False)
    address_text = db.Column(db.String(300), nullable=False)
    latitude = db.Column(db.Numeric(9, 6), nullable=False)
    longitude = db.Column(db.Numeric(9, 6), nullable=False)
    is_default = db.Column(db.Boolean, nullable=False, default=False)
