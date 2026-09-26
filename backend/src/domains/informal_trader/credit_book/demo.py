"""
Demo data for the credit book (`flask tools seed --me EMAIL`, development
only): a spaza's book on an ordinary day, made through the real service so
every total, history line and audit row is what the app would make.

  Thandi   R48    due today
  Sipho    R92    overdue, R20 paid back
  Lerato   R150   due in 5 days
  Mpho     R60    paid back in full        (History)
  Zanele   R35    cancelled: a mistake     (History)
  Bongani  R25    in the bin               (Bin)

The customers and their numbers are made up. Run twice, nothing changes
(Thandi's already there).
"""
from __future__ import annotations

import uuid
from datetime import timedelta

from .services import credit_book_service as service

MARKER = "Thandi Mokoena"


def seed(user) -> str:
    if service.search_customers(user, MARKER):
        return "credit book: already there"
    t = service.today()

    def sale(name, phone, cents, what, given, due):
        body = {"customer": {"name": name, "phone": phone}, "amount_cents": cents, "description": what, "given_on": t - timedelta(days=given), "due_on": t + timedelta(days=due)}
        return uuid.UUID(service.add_sale(user, body)["id"])

    sale(MARKER, "0821234501", 4_800, "Bread, milk", 3, 0)
    sipho = sale("Sipho Dube", "0721234502", 9_200, "Airtime, bread, eggs", 10, -2)
    service.record_payment(user, sipho, {"amount_cents": 2_000, "paid_on": t - timedelta(days=4)})
    sale("Lerato Nkosi", None, 15_000, "Maize meal, oil, sugar", 1, 5)
    mpho = sale("Mpho Radebe", "0831234503", 6_000, "Paraffin, candles", 20, -10)
    service.record_payment(user, mpho, {"amount_cents": 6_000, "paid_on": t - timedelta(days=12)})
    zanele = sale("Zanele Khumalo", None, 3_500, "Cold drinks", 2, 7)
    service.cancel(user, zanele, "Written in the wrong book")
    bongani = sale("Bongani Mahlangu", None, 2_500, "Bread", 1, 6)
    service.move_to_bin(user, bongani)
    return "credit book: 6 customers (1 due today, 1 overdue, 1 paid back, 1 cancelled, 1 in the bin)"
