"""
Supplier audit events: a supplier's profile being created or changed.

The profile holds what traders rely on when they order: minimum order,
delivery fee, whether cash is taken and up to how much, the payout
account. Who changed those, and when, must be answerable.
"""
from __future__ import annotations

import enum


class SupplierAuditEvent(str, enum.Enum):
    PROFILE_CREATED = "supplier.profile_created"
    PROFILE_UPDATED = "supplier.profile_updated"
    #: A trader connected to / disconnected from a supplier (only connected
    #: traders can order). Who, which supplier, when; nothing else.
    TRADER_CONNECTED = "supplier.trader_connected"
    TRADER_DISCONNECTED = "supplier.trader_disconnected"
