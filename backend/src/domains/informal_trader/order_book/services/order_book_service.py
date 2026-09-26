"""
What the rest of the app may ask the order book (call this, never its
repositories).

  demand_signals(user)   what the counter sells, for the supplier engine
  seal_records(user)     orders as taken and the menu's price history, for a record seal
"""
from __future__ import annotations

from .order_book_seal import seal_records  # noqa: F401 -- proof/integrity reads it here
from .order_book_signals import demand_signals  # noqa: F401 -- the supplier engine reads it here
