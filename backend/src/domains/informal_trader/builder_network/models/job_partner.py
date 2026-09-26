"""
JobPartner -- another builder brought onto one of the owner's jobs, for
some of its stages, on pay stated BEFORE they accept (fixed, or a day
rate times the days; and when it's paid). Accepted = partners: they see
each other's number. The partner never sees the client or the stages'
money.

PartnerPayment -- one cash payment to the partner, confirmed by both like
the client's sign-off: the same amount confirms it, different amounts are
both kept. Akayza never holds the money.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import ARRAY, UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import MAX_DAY_RATE_CENTS, MAX_DAYS, MAX_OFFER_CENTS, PAID_WHEN, PARTNER_STATUSES, PAY_KINDS, PAYMENT_STATUSES


def one_of(column: str, values: tuple, name: str):
    quoted = ", ".join(f"'{v}'" for v in values)
    return db.CheckConstraint(f"{column} IN ({quoted})", name=name)


def offer_checks(table: str) -> tuple:
    """The pay rules, in the database too: a row can never hold a silly offer."""
    return (
        one_of("pay_kind", PAY_KINDS, f"ck_{table}_pay_kind"),
        one_of("paid_when", PAID_WHEN, f"ck_{table}_paid_when"),
        db.CheckConstraint(f"days BETWEEN 1 AND {MAX_DAYS}", name=f"ck_{table}_days"),
        db.CheckConstraint(
            f"pay_cents > 0 AND ((pay_kind = 'fixed' AND pay_cents <= {MAX_OFFER_CENTS}) OR "
            f"(pay_kind = 'per_day' AND pay_cents <= {MAX_DAY_RATE_CENTS} AND pay_cents * days <= {MAX_OFFER_CENTS}))",
            name=f"ck_{table}_pay",
        ),
    )


class JobPartner(BaseModel):
    __tablename__ = "job_partners"
    __table_args__ = (
        *offer_checks("job_partners"),
        one_of("status", PARTNER_STATUSES, "ck_job_partners_status"),
        db.CheckConstraint("owner_id <> builder_id", name="ck_job_partners_not_self"),
        # One live row per builder per job; a declined invite can be sent again.
        db.Index("uq_job_partners_live", "job_id", "builder_id", unique=True, postgresql_where=db.text("status <> 'declined'")),
        db.Index("ix_job_partners_builder", "builder_id", "status"),
        {"schema": "trader"},
    )

    job_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trader.jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, index=True)
    builder_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
    stage_ids = db.Column(ARRAY(UUID(as_uuid=True)), nullable=False)
    trade = db.Column(db.String(20), nullable=False)
    starts_on = db.Column(db.Date, nullable=False)
    pay_kind = db.Column(db.String(10), nullable=False)
    pay_cents = db.Column(db.BigInteger, nullable=False)
    days = db.Column(db.Integer, nullable=False)
    paid_when = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(10), nullable=False, default="invited")
    answered_at = db.Column(db.DateTime(timezone=True), nullable=True)

    payments = db.relationship("PartnerPayment", order_by="PartnerPayment.created_at", lazy="selectin", back_populates="partner")


class PartnerPayment(BaseModel):
    __tablename__ = "partner_payments"
    __table_args__ = (
        one_of("status", PAYMENT_STATUSES, "ck_partner_payments_status"),
        db.CheckConstraint(f"owner_cents > 0 AND owner_cents <= {MAX_OFFER_CENTS}", name="ck_partner_payments_owner"),
        db.CheckConstraint(f"partner_cents IS NULL OR (partner_cents >= 0 AND partner_cents <= {MAX_OFFER_CENTS})", name="ck_partner_payments_partner"),
        {"schema": "trader"},
    )

    job_partner_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trader.job_partners.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_cents = db.Column(db.BigInteger, nullable=False)
    partner_cents = db.Column(db.BigInteger, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="waiting")
    answered_at = db.Column(db.DateTime(timezone=True), nullable=True)

    partner = db.relationship("JobPartner", back_populates="payments")
