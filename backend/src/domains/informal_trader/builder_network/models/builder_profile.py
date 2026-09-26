"""
BuilderProfile -- how a builder shows up to other builders: trades, one
line about them, how far they travel, and whether they're shown at all.

visible is off until the builder turns it on ("Show me to other
builders": specific consent, POPIA); turning it off hides them at once.
hidden_job_ids are finished jobs the builder chose NOT to show as builds.
Name, suburb, location and phone come from the business profile.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import ARRAY, UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import ABOUT_MAX, TRAVEL_CHOICES

_travel = ", ".join(str(k) for k in TRAVEL_CHOICES)


class BuilderProfile(BaseModel):
    __tablename__ = "builder_profiles"
    __table_args__ = (
        db.CheckConstraint(f"travel_km IN ({_travel})", name="ck_builder_profiles_travel"),
        db.CheckConstraint("cardinality(trades) BETWEEN 1 AND 3", name="ck_builder_profiles_trades"),
        {"schema": "trader"},
    )

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, unique=True)
    trades = db.Column(ARRAY(db.String(20)), nullable=False)
    about = db.Column(db.String(ABOUT_MAX), nullable=False, default="")
    travel_km = db.Column(db.Integer, nullable=False)
    visible = db.Column(db.Boolean, nullable=False, default=False)
    visible_changed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    hidden_job_ids = db.Column(ARRAY(UUID(as_uuid=True)), nullable=False, default=list)
