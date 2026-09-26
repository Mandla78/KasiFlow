"""
What a food seller's counter says they'll need to restock, for the
supplier engine (CONTRACT_order_book.txt section 8).

  demand_signals(user) ->
    {"categories": {"meat_frozen": 0.41, "bakery": 0.23, ...},
     "weekly_units": {"chips": 212, "quarter_loaf": 96, ...},
     "since": "2026-09-19"}

  categories    shares (2 decimals, biggest first) of what was sold in the
                last 7 days: each item's ingredients times the units sold
                (an ingredient in two categories splits its units), plus
                packaging for every order.
  weekly_units  ingredient -> units sold in the last 7 days, most first.
  since         the first day counted.

Aggregates of the trader's own counter, for the trader's own
suggestions: no customer names, no orders, no amounts. Cancelled orders
don't count.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import timedelta

from src.core.base_model import utcnow

from ..constants import INGREDIENT_CATEGORIES, PACKAGING, SIGNAL_DAYS
from ..repositories import order_book_repository as repo


def demand_signals(user) -> dict:
    since = utcnow() - timedelta(days=SIGNAL_DAYS)
    pairs = repo.lines_since(user.id, since)
    items = repo.items_by_id(user.id, {line.item_id for line, _ in pairs})

    units: Counter[str] = Counter()
    weights: dict[str, float] = defaultdict(float)
    orders = set()
    for line, order in pairs:
        orders.add(order.id)
        item = items.get(line.item_id)
        for ingredient in item.ingredients if item else ():
            units[ingredient] += line.qty
            cats = INGREDIENT_CATEGORIES.get(ingredient, ())
            for c in cats:
                weights[c] += line.qty / len(cats)
    if orders:
        weights[PACKAGING] += len(orders)

    total = sum(weights.values())
    shares = {c: round(w / total, 2) for c, w in sorted(weights.items(), key=lambda kv: (-kv[1], kv[0]))} if total else {}
    return {
        "categories": shares,
        "weekly_units": dict(sorted(units.items(), key=lambda kv: (-kv[1], kv[0]))),
        "since": since.date().isoformat(),
    }
