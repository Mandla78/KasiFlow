"""
credit_book -- the rules of the trader's book of customers who owe them.

  list_entries(user, status)          open + paid (or one of them)
  get_entry(user, id)                 one entry with its history
  add_sale(user, data)                a credit sale (new or existing customer)
  record_payment(user, id, data)      money paid back
  correct(user, id, data)             new amount / due date / description
  cancel(user, id, reason)            an entry made by mistake
  search_customers(user, q)
  set_customer_phone(user, id, phone)
  delete_customer(user, id)           anonymise; the amounts stay
  summary(user)                       totals for Home and the Account tile

Every call acts on the signed-in user only: the user comes from the token,
never the request, and "not yours" is the same 404 as "doesn't exist".
Nothing in the book is edited in place or deleted: corrections keep the
old values, payments are never changed.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from src.core.exceptions import ConflictError, NotFoundError, ValidationError
from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E

from ..constants import DELETED_CUSTOMER_NAME, MAX_DAYS_AHEAD, MAX_DAYS_BACK, TIMEZONE
from ..models import CreditCorrection, CreditCustomer, CreditEntry, CreditPayment
from ..repositories import credit_book_repository as repo
from . import credit_audit


def today() -> date:
    """The trader's today (South Africa), not the server's or UTC's."""
    return datetime.now(ZoneInfo(TIMEZONE)).date()


def _invalid(field: str, message: str) -> ValidationError:
    # One field, one rule: the message itself is what the app shows.
    return ValidationError(message, errors=[{field: [message]}])


def _not_found() -> NotFoundError:
    return NotFoundError("We couldn't find that entry.")


def _closed(message: str) -> ConflictError:
    return ConflictError(message, code="ENTRY_CLOSED")


# -------------------------------------------------------------------- reads


def list_entries(user, status: Optional[str]) -> list[dict]:
    statuses = {"open": ("open",), "paid": ("paid",)}.get(status or "", ("open", "paid"))
    rows = repo.entries(user.id, statuses)
    paid = repo.paid_by_entry(user.id, [e.id for e in rows])
    views = [_view(e, paid.get(e.id, 0)) for e in rows]
    # Open first by due date (late ones first), then paid, newest first.
    open_ = [v for v in views if v["status"] == "open"]
    settled = sorted((v for v in views if v["status"] == "paid"), key=lambda v: v["created_at"], reverse=True)
    return open_ + settled


def get_entry(user, entry_id: uuid.UUID) -> dict:
    entry = _entry(user, entry_id)
    return _detail(user, entry)


def search_customers(user, q: str) -> list[dict]:
    return _customers_with_owed(user, repo.search_customers(user.id, q))


def summary(user) -> dict:
    t = today()
    rows = repo.entries(user.id, ("open", "paid"))
    paid = repo.paid_by_entry(user.id, [e.id for e in rows])
    open_ = [(e, max(e.amount_cents - paid.get(e.id, 0), 0)) for e in rows if e.status == "open"]
    due_today = [(e, left) for e, left in open_ if e.due_on == t]
    month_start = t.replace(day=1)
    return {
        "customers_owe_cents": sum(left for _, left in open_),
        "customers_owing": len({e.customer_id for e, _ in open_}),
        "due_today_count": len(due_today),
        "due_today_cents": sum(left for _, left in due_today),
        "overdue_count": sum(1 for e, _ in open_ if e.due_on < t),
        "given_this_month_cents": sum(e.amount_cents for e in rows if e.given_on >= month_start),
        "paid_back_this_month_cents": repo.payments_since(user.id, month_start),
    }


# ------------------------------------------------------------------- writes


def add_sale(user, data: dict) -> dict:
    t = today()
    given_on = data.get("given_on") or t
    if given_on > t:
        raise _invalid("given_on", "The day it was given can't be in the future.")
    if given_on < t - timedelta(days=MAX_DAYS_BACK):
        raise _invalid("given_on", "Only credit from the last year can be added.")
    _check_due(data["due_on"], given_on, t)

    if data.get("customer_id"):
        customer = repo.customer(user.id, data["customer_id"])
        if customer is None:
            raise NotFoundError("We couldn't find that customer.")
    else:
        customer = repo.add_customer(user.id, data["customer"]["name"], data["customer"].get("phone"))

    entry = repo.add_entry(
        CreditEntry(
            user_id=user.id,
            customer=customer,
            amount_cents=data["amount_cents"],
            description=data.get("description", ""),
            given_on=given_on,
            due_on=data["due_on"],
            status="open",
        )
    )
    db.session.commit()
    credit_audit.record(E.CREDIT_ENTRY_ADDED, user_id=user.id, entry_id=entry.id, amount_cents=entry.amount_cents, back_dated=given_on < t or None)
    return _detail(user, entry)


def record_payment(user, entry_id: uuid.UUID, data: dict) -> dict:
    t = today()
    entry = _entry(user, entry_id, lock=True)
    if entry.status != "open":
        db.session.rollback()
        raise _closed("This entry is already settled.")
    paid_on = data.get("paid_on") or t
    if paid_on > t or paid_on < entry.given_on:
        db.session.rollback()
        raise _invalid("paid_on", "Choose a day between when it was given and today.")
    left = entry.amount_cents - repo.paid_by_entry(user.id, [entry.id]).get(entry.id, 0)
    if data["amount_cents"] > left:
        db.session.rollback()
        raise _invalid("amount_cents", "That's more than what's left to pay.")

    payment = CreditPayment(entry_id=entry.id, user_id=user.id, amount_cents=data["amount_cents"], paid_on=paid_on)
    repo.add(payment)
    if data["amount_cents"] == left:
        entry.status = "paid"
    db.session.commit()
    credit_audit.record(E.CREDIT_PAYMENT_RECORDED, user_id=user.id, entry_id=entry.id, payment_id=payment.id, amount_cents=payment.amount_cents)
    return _detail(user, entry)


def correct(user, entry_id: uuid.UUID, data: dict) -> dict:
    t = today()
    entry = _entry(user, entry_id, lock=True)
    if entry.status == "cancelled":
        db.session.rollback()
        raise _closed("This entry was cancelled.")
    paid = repo.paid_by_entry(user.id, [entry.id]).get(entry.id, 0)
    if data["amount_cents"] < paid:
        db.session.rollback()
        raise _invalid("amount_cents", "The amount can't be less than what's already been paid back.")
    try:
        _check_due(data["due_on"], entry.given_on, t)
    except ValidationError:
        db.session.rollback()
        raise
    after = (data["amount_cents"], data["due_on"], data.get("description", ""))
    before = (entry.amount_cents, entry.due_on, entry.description)
    if after == before:
        db.session.rollback()
        raise _invalid("amount_cents", "Nothing was changed.")

    repo.add(
        CreditCorrection(
            entry_id=entry.id,
            user_id=user.id,
            kind="correction",
            before_amount_cents=before[0],
            after_amount_cents=after[0],
            before_due_on=before[1],
            after_due_on=after[1],
            before_description=before[2],
            after_description=after[2],
            reason=data.get("reason", ""),
        )
    )
    entry.amount_cents, entry.due_on, entry.description = after
    # A correction can settle an entry, or re-open a paid one; the history says why.
    entry.status = "paid" if paid >= entry.amount_cents else "open"
    db.session.commit()
    credit_audit.record(
        E.CREDIT_ENTRY_CORRECTED,
        user_id=user.id,
        entry_id=entry.id,
        before_amount_cents=before[0],
        after_amount_cents=after[0],
        due_on_changed=before[1] != after[1],
    )
    return _detail(user, entry)


def cancel(user, entry_id: uuid.UUID, reason: str) -> dict:
    entry = _entry(user, entry_id, lock=True)
    if entry.status == "cancelled":
        db.session.rollback()
        raise _closed("This entry was already cancelled.")
    if repo.paid_by_entry(user.id, [entry.id]).get(entry.id, 0) > 0:
        db.session.rollback()
        raise ConflictError("Money was already paid back on this entry. Correct the amount instead.", code="HAS_REPAYMENTS")
    repo.add(
        CreditCorrection(
            entry_id=entry.id,
            user_id=user.id,
            kind="cancellation",
            before_amount_cents=entry.amount_cents,
            after_amount_cents=entry.amount_cents,
            before_due_on=entry.due_on,
            after_due_on=entry.due_on,
            before_description=entry.description,
            after_description=entry.description,
            reason=reason,
        )
    )
    entry.status = "cancelled"
    db.session.commit()
    credit_audit.record(E.CREDIT_ENTRY_CANCELLED, user_id=user.id, entry_id=entry.id, amount_cents=entry.amount_cents)
    return _detail(user, entry)


def set_customer_phone(user, customer_id: uuid.UUID, phone: Optional[str]) -> dict:
    customer = repo.customer(user.id, customer_id)
    if customer is None:
        raise NotFoundError("We couldn't find that customer.")
    had_phone = customer.phone is not None
    customer.phone = phone
    db.session.commit()
    credit_audit.record(E.CREDIT_CUSTOMER_PHONE_CHANGED, user_id=user.id, customer_id=customer.id, had_phone=had_phone, has_phone=phone is not None)
    return _customers_with_owed(user, [customer])[0]


def delete_customer(user, customer_id: uuid.UUID) -> None:
    customer = repo.customer(user.id, customer_id)
    if customer is None:
        raise NotFoundError("We couldn't find that customer.")
    customer.name = DELETED_CUSTOMER_NAME
    customer.phone = None
    customer.soft_delete()
    db.session.commit()
    credit_audit.record(E.CREDIT_CUSTOMER_DELETED, user_id=user.id, customer_id=customer.id)


def _customers_with_owed(user, customers: list[CreditCustomer]) -> list[dict]:
    """Each customer with what they still owe across their open entries."""
    open_entries = repo.open_entries_for_customers(user.id, [c.id for c in customers])
    paid = repo.paid_by_entry(user.id, [e.id for e in open_entries])
    owed: dict[uuid.UUID, int] = {}
    for e in open_entries:
        owed[e.customer_id] = owed.get(e.customer_id, 0) + max(e.amount_cents - paid.get(e.id, 0), 0)
    return [_customer_view(c, owed.get(c.id, 0)) for c in customers]


# ------------------------------------------------------------------ helpers


def _entry(user, entry_id: uuid.UUID, *, lock: bool = False) -> CreditEntry:
    entry = repo.entry(user.id, entry_id, lock=lock)
    if entry is None:
        raise _not_found()
    return entry


def _check_due(due_on: date, given_on: date, t: date) -> None:
    if due_on < given_on:
        raise _invalid("due_on", "The pay-back date can't be before the day it was given.")
    if due_on > t + timedelta(days=MAX_DAYS_AHEAD):
        raise _invalid("due_on", "Choose a date within a year.")


def _customer_view(c: CreditCustomer, owes_cents: int) -> dict:
    return {"id": str(c.id), "name": c.name, "phone": c.phone, "owes_cents": owes_cents}


def _view(e: CreditEntry, paid_cents: int) -> dict:
    c = e.customer
    return {
        "id": str(e.id),
        "customer": {"id": str(c.id), "name": c.name, "phone": c.phone},
        "amount_cents": e.amount_cents,
        "paid_cents": paid_cents,
        "outstanding_cents": 0 if e.status == "cancelled" else max(e.amount_cents - paid_cents, 0),
        "description": e.description,
        "given_on": e.given_on.isoformat(),
        "due_on": e.due_on.isoformat(),
        "status": e.status,
        "created_at": e.created_at.isoformat(),
    }


def _detail(user, e: CreditEntry) -> dict:
    payments = repo.payments(user.id, e.id)
    corrections = repo.corrections(user.id, e.id)
    original = corrections[0].before_amount_cents if corrections else e.amount_cents
    history: list[tuple] = [
        (e.created_at, {"id": f"{e.id}-given", "type": "given", "on": e.given_on.isoformat(), "recorded_at": e.created_at.isoformat(), "amount_cents": original})
    ]
    for p in payments:
        history.append(
            (p.created_at, {"id": str(p.id), "type": "repayment", "on": p.paid_on.isoformat(), "recorded_at": p.created_at.isoformat(), "amount_cents": p.amount_cents})
        )
    for c in corrections:
        base = {"id": str(c.id), "on": c.created_at.astimezone(ZoneInfo(TIMEZONE)).date().isoformat(), "recorded_at": c.created_at.isoformat(), "reason": c.reason}
        if c.kind == "cancellation":
            history.append((c.created_at, {**base, "type": "cancelled"}))
        else:
            history.append(
                (
                    c.created_at,
                    {
                        **base,
                        "type": "correction",
                        "before": {"amount_cents": c.before_amount_cents, "due_on": c.before_due_on.isoformat(), "description": c.before_description},
                        "after": {"amount_cents": c.after_amount_cents, "due_on": c.after_due_on.isoformat(), "description": c.after_description},
                    },
                )
            )
    history.sort(key=lambda item: item[0])
    paid = sum(p.amount_cents for p in payments)
    return {**_view(e, paid), "history": [h for _, h in history]}
