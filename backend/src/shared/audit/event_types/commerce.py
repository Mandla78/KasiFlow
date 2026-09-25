"""
Commerce audit events: an order's life, from placement to delivery.

Money moves on these, and disputes are settled from them: who placed,
accepted, cancelled or rejected which order, when, and for how much. Never
names, phone numbers or addresses in the metadata -- the order's id and
reference say where to look.
"""
from __future__ import annotations

import enum


class CommerceAuditEvent(str, enum.Enum):
    ORDER_PLACED = "commerce.order_placed"
    ORDER_REFUSED = "commerce.order_refused"
    ORDER_CANCELLED = "commerce.order_cancelled"
    ORDER_STATUS_CHANGED = "commerce.order_status_changed"
    ORDER_EXPIRED = "commerce.order_expired"
