"""
Demo data for the order book (`flask tools seed --me EMAIL`, development
only): a kota counter's week, so Today and This week show real numbers.

  the menu     the kota starter, saved through menu_service
  today        8 orders through orders_service.create and step, like the
               phone sends them: 5 collected, 1 ready, 1 preparing, 1 new
  the 6 days   14-20 orders a day, a lunchtime rush, 1 cancelled a day.
               Written straight to this feature's tables: the service
               refuses orders taken more than 2 days ago (offline limit),
               which is right for phones and wrong for a week of history.
               Same prices (price_at), same day numbers (next_number).

Deterministic (seeded), and run twice nothing changes (the menu's there).
"""
from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta

from src.core.base_model import utcnow
from src.extensions import db

from .models import OrderBookLine, OrderBookOrder
from .repositories import order_book_repository as repo
from .services import menu_service, orders_service
from .services.orders_service import SA

MENU = [
    {"name": "Kota: chips, polony, cheese", "price_cents": 3500, "ingredients": ["quarter_loaf", "chips", "polony", "cheese", "atchar"]},
    {"name": "Russian kota", "price_cents": 4500, "ingredients": ["quarter_loaf", "chips", "russian", "polony", "cheese", "atchar"]},
    {"name": "Full house kota", "price_cents": 6000, "ingredients": ["quarter_loaf", "chips", "russian", "vienna", "polony", "cheese", "egg", "atchar"]},
    {"name": "Chips small", "price_cents": 1500, "ingredients": ["chips"]},
    {"name": "Chips large", "price_cents": 2500, "ingredients": ["chips"]},
    {"name": "Cold drink", "price_cents": 1200, "ingredients": ["cold_drink"]},
]
NAMES = [None, None, None, "Thabo", "Lindiwe", "Sipho", "Mama Joy", None, "Kagiso", None]
#: Hours an order comes in: quieter mornings, a rush at lunch, after work.
HOURS = [10, 11, 11, 12, 12, 12, 12, 13, 13, 13, 14, 15, 16, 17, 17, 18]
#: The queue's steps to reach each status, one at a time.
STEPS_TO = {"new": (), "preparing": ("preparing",), "ready": ("preparing", "ready"), "collected": ("preparing", "ready", "collected")}


def _pick(rng: random.Random, items: list) -> list[tuple]:
    """One to three things, the way a queue orders."""
    return [(item, rng.choice((1, 1, 1, 2))) for item in rng.sample(items, rng.choice((1, 1, 2, 2, 3)))]


def _payment(rng: random.Random) -> str:
    return rng.choices(("cash", "digital", "later"), weights=(70, 22, 8))[0]


def seed(user) -> str:
    if menu_service.menu(user):
        return "order book: already there"
    menu_service.save_menu(user, [{"id": None, **m} for m in MENU])
    items = [i for i in repo.items(user.id) if i.active]
    rng = random.Random(2026)
    today = orders_service.today()

    past = 0
    for back in range(6, 0, -1):
        day = today - timedelta(days=back)
        for n in range(rng.randint(14, 20)):
            taken = datetime(day.year, day.month, day.day, rng.choice(HOURS), rng.randint(0, 59), tzinfo=SA)
            lines = [OrderBookLine(item_id=it.id, position=p, name=it.name, price_cents=menu_service.price_at(it, taken), qty=q) for p, (it, q) in enumerate(_pick(rng, items))]
            repo.add(
                OrderBookOrder(
                    user_id=user.id, client_key=uuid.uuid4(), day=day, number=repo.next_number(user.id, day),
                    temp_number=f"A{n + 1}", payment=_payment(rng), customer_name=rng.choice(NAMES),
                    status="cancelled" if n == 3 else "collected", taken_at=taken, status_at=taken + timedelta(minutes=rng.randint(6, 18)),
                    total_cents=sum(line.price_cents * line.qty for line in lines), lines=lines,
                )
            )  # fmt: skip
            past += 1
    db.session.commit()

    # Today, the way the phone sends it: over the last hours (never before midnight).
    now = utcnow()
    start_of_day = datetime(today.year, today.month, today.day, 0, 5, tzinfo=SA)
    plan = ["collected"] * 5 + ["ready", "preparing", "new"]
    for i, status in enumerate(plan):
        taken = max(start_of_day, now - timedelta(minutes=(len(plan) - i) * 17))
        body = {
            "id": uuid.uuid4(), "day": today, "temp_number": f"A{i + 1}",
            "lines": [{"item_id": it.id, "qty": q} for it, q in _pick(rng, items)],
            "payment": _payment(rng), "customer_name": rng.choice(NAMES), "created_at": taken,
        }  # fmt: skip
        order, _ = orders_service.create(user, body)
        key = uuid.UUID(order["id"])
        for step_no, s in enumerate(STEPS_TO[status]):
            orders_service.step(user, key, s, min(now, taken + timedelta(minutes=4 * (step_no + 1))))
    return f"order book: the kota menu, {past} orders over 6 days, 8 today (5 collected, 1 ready, 1 preparing, 1 new)"
