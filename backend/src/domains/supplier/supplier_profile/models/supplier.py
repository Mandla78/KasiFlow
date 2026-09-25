"""
Supplier -- a business traders order stock from.

Suppliers come in through their own system (ERP / POS) or, for the demo,
the seed files; either way through the same feed and the same checks
(integration/services/feed_loader.py). The app never writes here.

What traders rely on when they order lives on this row: where they are,
how far they deliver and for how much, the minimum order, and which
payments they take. Changes are audited (SupplierAuditEvent).
verified_at: set when the business was checked while connecting its
system; it's what the green seal means.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import ARRAY, JSONB

from src.core.base_model import BaseModel
from src.extensions import db
from src.shared.constants.categories import CATEGORIES

from ..constants import STATUSES


def _in(column: str, values: tuple) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class Supplier(BaseModel):
    __tablename__ = "suppliers"
    __table_args__ = (
        db.CheckConstraint(_in("status", STATUSES), name="ck_suppliers_status"),
        db.CheckConstraint(
            f"categories <@ ARRAY[{', '.join(repr(c) for c in CATEGORIES)}]::varchar[]", name="ck_suppliers_categories"
        ),
        db.CheckConstraint("delivery_radius_km >= 0 AND delivery_radius_km <= 200", name="ck_suppliers_delivery_radius"),
        db.CheckConstraint("delivery_fee_cents >= 0 AND minimum_order_cents >= 0", name="ck_suppliers_money"),
        db.CheckConstraint("free_delivery_over_cents IS NULL OR free_delivery_over_cents > 0", name="ck_suppliers_free_over"),
        db.CheckConstraint("accepts_cash OR cash_limit_cents IS NULL", name="ck_suppliers_cash_limit_needs_cash"),
        db.CheckConstraint("cash_limit_cents IS NULL OR cash_limit_cents > 0", name="ck_suppliers_cash_limit"),
        db.CheckConstraint("accepts_in_app OR accepts_cash", name="ck_suppliers_takes_some_payment"),
        db.CheckConstraint("delivers OR collect", name="ck_suppliers_delivers_or_collect"),
        {"schema": "supplier"},
    )

    #: The supplier's own id for itself in the feed, e.g. "MAHLANGU-001".
    external_id = db.Column(db.String(64), nullable=False, unique=True)
    trading_name = db.Column(db.String(120), nullable=False)
    legal_name = db.Column(db.String(160), nullable=True)
    about = db.Column(db.String(500), nullable=True)
    vat_number = db.Column(db.String(10), nullable=True)
    #: Where order emails go. Never shown to traders.
    orders_email = db.Column(db.String(254), nullable=False)
    phone = db.Column(db.String(15), nullable=True)
    #: The initials' circle colour until a logo is uploaded (#RRGGBB).
    brand_color = db.Column(db.String(7), nullable=False, default="#1F2A44")
    logo_url = db.Column(db.String(1000), nullable=True)

    # Where to collect, and the pin distances are measured from.
    street = db.Column(db.String(160), nullable=False)
    suburb = db.Column(db.String(120), nullable=True)
    city = db.Column(db.String(120), nullable=False)
    province = db.Column(db.String(60), nullable=False)
    postal_code = db.Column(db.String(10), nullable=True)
    latitude = db.Column(db.Numeric(9, 6), nullable=False)
    longitude = db.Column(db.Numeric(9, 6), nullable=False)
    #: [{"days": "mon-fri", "open": "07:00", "close": "17:00"}, ...]
    hours = db.Column(JSONB, nullable=False, default=list)

    delivers = db.Column(db.Boolean, nullable=False, default=False)
    delivery_radius_km = db.Column(db.Integer, nullable=False, default=0)
    delivery_fee_cents = db.Column(db.BigInteger, nullable=False, default=0)
    free_delivery_over_cents = db.Column(db.BigInteger, nullable=True)
    collect = db.Column(db.Boolean, nullable=False, default=True)

    accepts_in_app = db.Column(db.Boolean, nullable=False, default=True)
    accepts_cash = db.Column(db.Boolean, nullable=False, default=False)
    #: The supplier's own cash limit per order; ours (R1,000) applies on top.
    cash_limit_cents = db.Column(db.BigInteger, nullable=True)
    minimum_order_cents = db.Column(db.BigInteger, nullable=False, default=0)

    categories = db.Column(ARRAY(db.String(40)), nullable=False, default=list)
    #: The payment provider's merchant id the supplier's share is split to.
    payout_merchant_id = db.Column(db.String(40), nullable=True)

    status = db.Column(db.String(10), nullable=False, default="active")
    verified_at = db.Column(db.DateTime(timezone=True), nullable=True)
