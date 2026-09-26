"""
HelpPost -- an offer posted nearby from a job: the trade needed, the
stages (as words), when, the suburb (never the address) and the pay.
Builders of that trade within their travel distance see it for 7 days.
Picking someone who's interested makes them a partner on the job, on
this pay.

latitude/longitude are rounded to 0.01 (about 1 km): for matching only,
never returned.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import ARRAY, UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import POST_STATUSES, SUBURB_MAX
from .job_partner import offer_checks, one_of


class HelpPost(BaseModel):
    __tablename__ = "help_posts"
    __table_args__ = (
        *offer_checks("help_posts"),
        one_of("status", POST_STATUSES, "ck_help_posts_status"),
        db.Index("ix_help_posts_open", "status", "trade", "expires_at"),
        {"schema": "trader"},
    )

    job_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trader.jobs.id", ondelete="CASCADE"), nullable=False)
    owner_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, index=True)
    trade = db.Column(db.String(20), nullable=False)
    stage_ids = db.Column(ARRAY(UUID(as_uuid=True)), nullable=False)
    what = db.Column(db.String(200), nullable=False)
    starts_on = db.Column(db.Date, nullable=False)
    suburb = db.Column(db.String(SUBURB_MAX), nullable=False)
    latitude = db.Column(db.Numeric(5, 2), nullable=True)
    longitude = db.Column(db.Numeric(5, 2), nullable=True)
    pay_kind = db.Column(db.String(10), nullable=False)
    pay_cents = db.Column(db.BigInteger, nullable=False)
    days = db.Column(db.Integer, nullable=False)
    paid_when = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(10), nullable=False, default="open")
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    picked_builder_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="SET NULL"), nullable=True)


class HelpResponse(BaseModel):
    __tablename__ = "help_responses"
    __table_args__ = (db.UniqueConstraint("post_id", "builder_id", name="uq_help_responses"), {"schema": "trader"})

    post_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trader.help_posts.id", ondelete="CASCADE"), nullable=False)
    builder_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, index=True)
