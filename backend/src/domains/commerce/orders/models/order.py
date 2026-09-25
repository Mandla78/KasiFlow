"""
Orders from a trader to a supplier (docs/supplier/04).

Order        who, which supplier, how it's fulfilled and paid, the money
             (all computed by the server at placement), and where it is now
OrderLine    a SNAPSHOT of each product at order time (name, pack, price,
             VAT rate): a later price change never changes a placed order
OrderEvent   append-only history of every status change and who made it

reference is what people read and say ("AKZ-2026-000123"): unique across
Akayza, from a database sequence. Money is integer cents.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import ACTORS, FULFILMENTS, PAYMENT_METHODS, PAYMENT_STATUSES, STATUSES


def _in(column: str, values: tuple) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class Order(BaseModel):
    __tablename__ = "orders"
    __table_args__ = (
        db.CheckConstraint(_in("status", STATUSES), name="ck_orders_status"),
        db.CheckConstraint(_in("payment_method", PAYMENT_METHODS), name="ck_orders_payment_method"),
        db.CheckConstraint(_in("payment_status", PAYMENT_STATUSES), name="ck_orders_payment_status"),
        db.CheckConstraint(_in("fulfilment", FULFILMENTS), name="ck_orders_fulfilment"),
        db.CheckConstraint("subtotal_cents > 0 AND delivery_fee_cents >= 0 AND total_cents = subtotal_cents + delivery_fee_cents", name="ck_orders_money"),
        db.Index("ix_orders_user_placed", "user_id", "placed_at"),
        db.Index("ix_orders_supplier_status", "supplier_id", "status"),
        {"schema": "commerce"},
    )

    reference = db.Column(db.String(20), nullable=False, unique=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="RESTRICT"), nullable=False)
    supplier_id = db.Column(UUID(as_uuid=True), db.ForeignKey("supplier.suppliers.id", ondelete="RESTRICT"), nullable=False)
    #: The supplier's name when ordered (the order reads the same if they rename).
    supplier_name = db.Column(db.String(120), nullable=False)

    status = db.Column(db.String(24), nullable=False)
    payment_method = db.Column(db.String(10), nullable=False)
    payment_status = db.Column(db.String(20), nullable=False)
    fulfilment = db.Column(db.String(10), nullable=False)
    #: Where it goes (delivery) or where to fetch it (collection), as text.
    address = db.Column(db.String(300), nullable=False)
    latitude = db.Column(db.Numeric(9, 6), nullable=True)
    longitude = db.Column(db.Numeric(9, 6), nullable=True)

    subtotal_cents = db.Column(db.BigInteger, nullable=False)
    delivery_fee_cents = db.Column(db.BigInteger, nullable=False, default=0)
    total_cents = db.Column(db.BigInteger, nullable=False)

    placed_at = db.Column(db.DateTime(timezone=True), nullable=False)
    #: An unpaid digital order lapses at this time.
    pay_by = db.Column(db.DateTime(timezone=True), nullable=True)

    lines = db.relationship("OrderLine", backref="order", order_by="OrderLine.position", lazy="selectin", cascade="all, delete-orphan")
    events = db.relationship("OrderEvent", backref="order", order_by="OrderEvent.at", lazy="selectin", cascade="all, delete-orphan")


class OrderLine(BaseModel):
    __tablename__ = "order_lines"
    __table_args__ = (
        db.CheckConstraint("qty > 0 AND unit_price_cents > 0 AND line_total_cents = qty * unit_price_cents", name="ck_order_lines_money"),
        {"schema": "commerce"},
    )

    order_id = db.Column(UUID(as_uuid=True), db.ForeignKey("commerce.orders.id", ondelete="CASCADE"), nullable=False, index=True)
    position = db.Column(db.Integer, nullable=False)
    product_id = db.Column(UUID(as_uuid=True), db.ForeignKey("supplier.products.id", ondelete="RESTRICT"), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    pack_size = db.Column(db.String(60), nullable=False)
    unit = db.Column(db.String(10), nullable=False)
    vat_rate = db.Column(db.String(10), nullable=False)
    unit_price_cents = db.Column(db.BigInteger, nullable=False)
    qty = db.Column(db.Integer, nullable=False)
    line_total_cents = db.Column(db.BigInteger, nullable=False)


class OrderEvent(BaseModel):
    """Append-only: rows are added, never changed or deleted."""

    __tablename__ = "order_events"
    __table_args__ = (
        db.CheckConstraint(_in("status", STATUSES), name="ck_order_events_status"),
        db.CheckConstraint(_in("actor", ACTORS), name="ck_order_events_actor"),
        {"schema": "commerce"},
    )

    order_id = db.Column(UUID(as_uuid=True), db.ForeignKey("commerce.orders.id", ondelete="CASCADE"), nullable=False, index=True)
    status = db.Column(db.String(24), nullable=False)
    actor = db.Column(db.String(10), nullable=False)
    at = db.Column(db.DateTime(timezone=True), nullable=False)
    note = db.Column(db.String(200), nullable=True)
