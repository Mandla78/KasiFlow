"""
The order book's part of a record seal (proof/integrity): every counter
order as it was taken (its lines at the price of the time) and the menu's
price history, as (kind, id, fields). An order's step (new, ready,
collected, cancelled) and how it was paid are left out: they move during
the day.
"""
from __future__ import annotations

from collections import defaultdict

from ..repositories import order_book_repository as repo


def seal_records(user) -> list[tuple[str, str, dict]]:
    orders, lines, prices = repo.all_for_seal(user.id)
    by_order: dict = defaultdict(list)
    for line in sorted(lines, key=lambda x: x.position):
        by_order[line.order_id].append([str(line.item_id), line.name, line.price_cents, line.qty])
    out: list[tuple[str, str, dict]] = []
    for o in orders:
        out.append(("counter_order", str(o.id), {"day": o.day, "number": o.number, "taken_at": o.taken_at, "total_cents": o.total_cents, "lines": by_order.get(o.id, [])}))
    for p in prices:
        out.append(("menu_price", str(p.id), {"item": str(p.item_id), "price_cents": p.price_cents, "valid_from": p.valid_from}))
    return out
