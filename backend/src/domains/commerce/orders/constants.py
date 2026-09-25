"""Allowed values for orders."""
from __future__ import annotations

#: awaiting_payment -> placed -> accepted -> out_for_delivery | ready_for_collection
#: -> delivered | collected; or rejected / cancelled / expired along the way.
STATUSES = (
    "awaiting_payment", "placed", "accepted", "out_for_delivery", "ready_for_collection",
    "delivered", "collected", "rejected", "cancelled", "expired",
)
#: Still in progress (counts towards "cash orders waiting").
OPEN = ("awaiting_payment", "placed", "accepted", "out_for_delivery", "ready_for_collection")
#: Over; the stock they held has been given back (except delivered/collected).
CLOSED_WITHOUT_SALE = ("rejected", "cancelled", "expired")

PAYMENT_METHODS = ("in_app", "cash")
PAYMENT_STATUSES = ("unpaid", "paid", "cash_due", "confirmed_by_both", "refunded")
FULFILMENTS = ("delivery", "collect")
ACTORS = ("trader", "supplier", "system")

#: What the supplier's side may move an order to, from where.
SUPPLIER_MOVES = {
    "accepted": ("placed",),
    "rejected": ("placed",),
    "out_for_delivery": ("accepted",),
    "ready_for_collection": ("accepted",),
    "delivered": ("out_for_delivery",),
    "collected": ("ready_for_collection",),
}

#: An unpaid digital order lapses after this long (docs/supplier/12, section 3).
UNPAID_HOURS = 24
#: Lines per order.
MAX_LINES = 50
