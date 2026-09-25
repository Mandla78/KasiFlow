"""Allowed values for a supplier profile."""
from __future__ import annotations

#: active: traders can see and order. paused: hidden, no new orders.
STATUSES = ("active", "paused")

#: Opening-hours day groups, as a supplier's system sends them.
DAY_GROUPS = ("mon-fri", "mon-sat", "mon-sun", "sat", "sun", "sat-sun", "public-holidays")
