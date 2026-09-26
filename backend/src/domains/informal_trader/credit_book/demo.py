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


def tamper(user) -> str:
    """DEVELOPMENT ONLY: change one number straight in the database, the way
    an intruder (or a careless edit) would -- no history line, no audit --
    so "Check my record" can be shown catching it. Adds R10 to the latest
    repayment, or to the latest credit if there are no repayments."""
    from src.extensions import db

    from .models import CreditEntry, CreditPayment

    payment = CreditPayment.query.filter_by(user_id=user.id).order_by(CreditPayment.created_at.desc()).first()
    if payment is not None:
        payment.amount_cents += 1_000
        db.session.commit()
        return f"repayment on {payment.paid_on.isoformat()} now R{payment.amount_cents / 100:,.2f}"
    entry = CreditEntry.query.filter_by(user_id=user.id).order_by(CreditEntry.created_at.desc()).first()
    if entry is None:
        return "nothing to change: the credit book is empty"
    entry.amount_cents += 1_000
    db.session.commit()
    return f"credit given on {entry.given_on.isoformat()} now R{entry.amount_cents / 100:,.2f}"
