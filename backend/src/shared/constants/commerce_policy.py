"""
Our own ordering rules, the same for every trader and supplier
(docs/supplier/12_POLICIES.txt). They must match the app's
features/dashboard/informal-business/orders/lib/cashPolicy.ts.

Cash: a cash order costs the trader nothing up front, so a fake or
abandoned one costs the supplier a wasted trip. R1,000 per order and two
waiting at a time keep that risk small; bigger orders are paid digitally.
"""
from __future__ import annotations

from typing import Optional

#: The most cash one order can be paid with, whatever the supplier allows.
CASH_LIMIT_CENTS = 100_000

#: Cash orders a trader may have waiting (placed, not yet delivered or collected).
MAX_OPEN_CASH_ORDERS = 2


def cash_limit_for(accepts_cash: bool, supplier_limit_cents: Optional[int]) -> Optional[int]:
    """The cash limit a trader actually gets with this supplier (None = no cash)."""
    if not accepts_cash:
        return None
    return min(supplier_limit_cents or CASH_LIMIT_CENTS, CASH_LIMIT_CENTS)
