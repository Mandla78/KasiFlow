"""
OrderBookItem -- one thing on a trader's counter menu ("Russian kota").
OrderBookItemPrice -- what it cost from when: an order taken offline before
a price change is priced as it was when it was taken (the server prices
every line, never the phone).

An item taken off the menu is hidden (active false, hidden_at), never
deleted: past orders keep their own copy of its name and price anyway.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import ARRAY, UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import INGREDIENTS, ITEM_NAME_MAX, MAX_PRICE_CENTS

_ingredients = ", ".join(f"'{i}'" for i in INGREDIENTS)


class OrderBookItem(BaseModel):
    __tablename__ = "order_book_items"
    __table_args__ = (
        db.CheckConstraint(f"ingredients <@ ARRAY[{_ingredients}]::varchar[]", name="ck_order_book_items_ingredients"),
        db.CheckConstraint("position >= 0", name="ck_order_book_items_position"),
        db.Index("ix_order_book_items_user_active", "user_id", "active"),
        {"schema": "trader"},
    )

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.String(ITEM_NAME_MAX), nullable=False)
    ingredients = db.Column(ARRAY(db.String(20)), nullable=False, default=list)
    position = db.Column(db.Integer, nullable=False, default=0)
    active = db.Column(db.Boolean, nullable=False, default=True)
    hidden_at = db.Column(db.DateTime(timezone=True), nullable=True)

    prices = db.relationship("OrderBookItemPrice", order_by="OrderBookItemPrice.valid_from", lazy="selectin", back_populates="item")


class OrderBookItemPrice(BaseModel):
    __tablename__ = "order_book_item_prices"
    __table_args__ = (
        db.CheckConstraint(f"price_cents > 0 AND price_cents <= {MAX_PRICE_CENTS}", name="ck_order_book_item_prices_price"),
        db.Index("ix_order_book_item_prices_item_from", "item_id", "valid_from"),
        {"schema": "trader"},
    )

    item_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trader.order_book_items.id", ondelete="CASCADE"), nullable=False)
    price_cents = db.Column(db.Integer, nullable=False)
    valid_from = db.Column(db.DateTime(timezone=True), nullable=False)

    item = db.relationship("OrderBookItem", back_populates="prices")
