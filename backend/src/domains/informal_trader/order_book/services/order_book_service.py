"""
What the rest of the app may ask the order book (call this, never its
repositories).

  demand_signals(user)   what the counter sells, for the supplier engine
"""
from __future__ import annotations

from .order_book_signals import demand_signals  # noqa: F401 -- the supplier engine reads it here
