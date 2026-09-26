"""
OrderBookOrder -- one customer order at the counter, and its lines.
OrderBookDay -- one counter per trader per day, for the day's numbers.

The SERVER makes the row's id. The phone makes client_key (a UUID) when
the order is taken, offline or not, and sends it on every retry: unique
per trader, so a retry lands once and keeps its number, and the order's
address in the API is that key, always looked up with the trader's
user_id (one trader's key can never find another's order).

The day's number (#1, #2...) comes from order_book_days in one atomic
statement, so two phones in one shop never get the same number. Lines
keep the name and price AS SOLD: a menu change never changes an order.

taken_at is when the phone says the order was taken (checked, not
trusted); created_at is when the server got it.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import CUSTOMER_NAME_MAX, ITEM_NAME_MAX, MAX_PRICE_CENTS, MAX_QTY, PAYMENTS, STATUSES

_statuses = ", ".join(f"'{s}'" for s in STATUSES)
_payments = ", ".join(f"'{p}'" for p in PAYMENTS)


class OrderBookDay(BaseModel):
    __tablename__ = "order_book_days"
    __table_args__ = (
        db.UniqueConstraint("user_id", "day", name="uq_order_book_days_user_day"),
        db.CheckConstraint("last_number >= 0", name="ck_order_book_days_last_number"),
        {"schema": "trader"},
    )

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
    day = db.Column(db.Date, nullable=False)
    last_number = db.Column(db.Integer, nullable=False, default=0)


class OrderBookOrder(BaseModel):
    __tablename__ = "order_book_orders"
    __table_args__ = (
        db.UniqueConstraint("user_id", "client_key", name="uq_order_book_orders_user_key"),
        db.UniqueConstraint("user_id", "day", "number", name="uq_order_book_orders_user_day_number"),
        db.CheckConstraint(f"status IN ({_statuses})", name="ck_order_book_orders_status"),
        db.CheckConstraint(f"payment IN ({_payments})", name="ck_order_book_orders_payment"),
        db.CheckConstraint("number > 0", name="ck_order_book_orders_number"),
        db.CheckConstraint("total_cents >= 0", name="ck_order_book_orders_total"),
        db.Index("ix_order_book_orders_user_day", "user_id", "day"),
        {"schema": "trader"},
    )

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
    client_key = db.Column(UUID(as_uuid=True), nullable=False)
    day = db.Column(db.Date, nullable=False)
    number = db.Column(db.Integer, nullable=False)
    temp_number = db.Column(db.String(5), nullable=False)
    payment = db.Column(db.String(10), nullable=False)
    customer_name = db.Column(db.String(CUSTOMER_NAME_MAX), nullable=True)
    status = db.Column(db.String(10), nullable=False, default="new")
    taken_at = db.Column(db.DateTime(timezone=True), nullable=False)
    status_at = db.Column(db.DateTime(timezone=True), nullable=False)
    total_cents = db.Column(db.BigInteger, nullable=False)

    lines = db.relationship("OrderBookLine", order_by="OrderBookLine.position", lazy="selectin", back_populates="order")


class OrderBookLine(BaseModel):
    __tablename__ = "order_book_lines"
    __table_args__ = (
        db.CheckConstraint(f"qty > 0 AND qty <= {MAX_QTY}", name="ck_order_book_lines_qty"),
        db.CheckConstraint(f"price_cents > 0 AND price_cents <= {MAX_PRICE_CENTS}", name="ck_order_book_lines_price"),
        db.Index("ix_order_book_lines_order_id", "order_id"),
        db.Index("ix_order_book_lines_item_id", "item_id"),
        {"schema": "trader"},
    )

    order_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trader.order_book_orders.id", ondelete="CASCADE"), nullable=False)
    item_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trader.order_book_items.id", ondelete="RESTRICT"), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)
    name = db.Column(db.String(ITEM_NAME_MAX), nullable=False)
    price_cents = db.Column(db.Integer, nullable=False)
    qty = db.Column(db.Integer, nullable=False)

    order = db.relationship("OrderBookOrder", back_populates="lines")
