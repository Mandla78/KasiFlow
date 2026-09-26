"""
All database access for the credit book. Only this feature's services call
this, and EVERY query takes the trader's user_id: a row that isn't theirs
is simply not found (IDOR rule). A binned entry (is_deleted) is not found
either, except by the history and bin queries at the end.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Iterable, Optional

from sqlalchemy import func, select

from src.extensions import db

from ..constants import HISTORY_LIMIT, LIST_LIMIT, SEARCH_LIMIT
from ..models import CreditCorrection, CreditCustomer, CreditEntry, CreditPayment


# ---------------------------------------------------------------- customers


def customer(user_id: uuid.UUID, customer_id: uuid.UUID) -> Optional[CreditCustomer]:
    return CreditCustomer.query.filter_by(id=customer_id, user_id=user_id, is_deleted=False).first()


def search_customers(user_id: uuid.UUID, q: str) -> list[CreditCustomer]:
    """Name starts with q first, then contains q; everyone when q is empty."""
    query = CreditCustomer.query.filter_by(user_id=user_id, is_deleted=False)
    if q:
        pattern = q.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        starts = func.lower(CreditCustomer.name).like(f"{pattern}%", escape="\\")
        query = query.filter(func.lower(CreditCustomer.name).like(f"%{pattern}%", escape="\\")).order_by(starts.desc())
    return query.order_by(func.lower(CreditCustomer.name)).limit(SEARCH_LIMIT).all()


def add_customer(user_id: uuid.UUID, name: str, phone: Optional[str]) -> CreditCustomer:
    row = CreditCustomer(user_id=user_id, name=name, phone=phone)
    db.session.add(row)
    return row


# ------------------------------------------------------------------ entries


def entries(user_id: uuid.UUID, statuses: Iterable[str]) -> list[CreditEntry]:
    return (
        CreditEntry.query.filter(CreditEntry.user_id == user_id, CreditEntry.is_deleted.is_(False), CreditEntry.status.in_(list(statuses)))
        .order_by(CreditEntry.due_on, CreditEntry.created_at)
        .limit(LIST_LIMIT)
        .all()
    )


def entry(user_id: uuid.UUID, entry_id: uuid.UUID, *, lock: bool = False) -> Optional[CreditEntry]:
    """lock=True holds the row (SELECT ... FOR UPDATE) until commit, so two
    payments at the same moment are counted one after the other."""
    query = CreditEntry.query.filter_by(id=entry_id, user_id=user_id, is_deleted=False)
    if lock:
        # Lock only the entry: the joined customer row is only read.
        query = query.with_for_update(of=CreditEntry)
    return query.first()


def add_entry(entry_row: CreditEntry) -> CreditEntry:
    db.session.add(entry_row)
    return entry_row


def open_entries_for_customers(user_id: uuid.UUID, customer_ids: list[uuid.UUID]) -> list[CreditEntry]:
    if not customer_ids:
        return []
    return CreditEntry.query.filter(
        CreditEntry.user_id == user_id, CreditEntry.is_deleted.is_(False), CreditEntry.status == "open", CreditEntry.customer_id.in_(customer_ids)
    ).all()


# ------------------------------------------------------ payments, corrections


def paid_by_entry(user_id: uuid.UUID, entry_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """Sum of payments per entry, in one query."""
    if not entry_ids:
        return {}
    rows = (
        db.session.query(CreditPayment.entry_id, func.coalesce(func.sum(CreditPayment.amount_cents), 0))
        .filter(CreditPayment.user_id == user_id, CreditPayment.entry_id.in_(entry_ids))
        .group_by(CreditPayment.entry_id)
        .all()
    )
    return {entry_id: int(total) for entry_id, total in rows}


def payments(user_id: uuid.UUID, entry_id: uuid.UUID) -> list[CreditPayment]:
    return CreditPayment.query.filter_by(user_id=user_id, entry_id=entry_id).order_by(CreditPayment.created_at).all()


def corrections(user_id: uuid.UUID, entry_id: uuid.UUID) -> list[CreditCorrection]:
    return CreditCorrection.query.filter_by(user_id=user_id, entry_id=entry_id).order_by(CreditCorrection.created_at).all()


def given_between(user_id: uuid.UUID, start, end) -> int:
    """Credit given (the entries' current amounts) with given_on in [start, end):
    open and paid entries, not cancelled, not binned."""
    total = (
        db.session.query(func.coalesce(func.sum(CreditEntry.amount_cents), 0))
        .filter(
            CreditEntry.user_id == user_id, CreditEntry.is_deleted.is_(False), CreditEntry.status.in_(("open", "paid")),
            CreditEntry.given_on >= start, CreditEntry.given_on < end,
        )
        .scalar()
    )  # fmt: skip
    return int(total)


def payments_between(user_id: uuid.UUID, start, end) -> int:
    """Money paid back with paid_on in [start, end) (binned entries left out)."""
    total = (
        db.session.query(func.coalesce(func.sum(CreditPayment.amount_cents), 0))
        .join(CreditEntry, CreditEntry.id == CreditPayment.entry_id)
        .filter(CreditPayment.user_id == user_id, CreditPayment.paid_on >= start, CreditPayment.paid_on < end, CreditEntry.is_deleted.is_(False))
        .scalar()
    )
    return int(total)


def payments_since(user_id: uuid.UUID, since) -> int:
    """Money paid back from `since` (a date) on, across the book (binned entries left out)."""
    total = (
        db.session.query(func.coalesce(func.sum(CreditPayment.amount_cents), 0))
        .join(CreditEntry, CreditEntry.id == CreditPayment.entry_id)
        .filter(CreditPayment.user_id == user_id, CreditPayment.paid_on >= since, CreditEntry.is_deleted.is_(False))
        .scalar()
    )
    return int(total)


def add(row) -> None:
    db.session.add(row)


# ----------------------------------------------------------- history and bin


def _contains(q: str) -> str:
    """q as a plain "contains" pattern: % and _ are letters, not wildcards."""
    return "%" + q.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def history(user_id: uuid.UUID, q: str) -> list[CreditEntry]:
    """Paid and cancelled entries, not binned, the latest activity (a
    payment, a correction, the entry itself) first. q: the customer's name."""
    last_payment = select(func.max(CreditPayment.created_at)).where(CreditPayment.entry_id == CreditEntry.id).scalar_subquery()
    last_correction = select(func.max(CreditCorrection.created_at)).where(CreditCorrection.entry_id == CreditEntry.id).scalar_subquery()
    query = CreditEntry.query.filter(
        CreditEntry.user_id == user_id, CreditEntry.is_deleted.is_(False), CreditEntry.status.in_(("paid", "cancelled"))
    )
    if q:
        query = query.join(CreditCustomer, CreditCustomer.id == CreditEntry.customer_id).filter(
            func.lower(CreditCustomer.name).like(_contains(q), escape="\\")
        )
    # GREATEST skips NULLs: an entry with no payments or corrections is its own date.
    activity = func.greatest(CreditEntry.created_at, last_payment, last_correction)
    return query.order_by(activity.desc(), CreditEntry.id).limit(HISTORY_LIMIT).all()


def binned(user_id: uuid.UUID, since: datetime) -> list[CreditEntry]:
    """In the bin: deleted at `since` or later, newest first."""
    return (
        CreditEntry.query.filter(CreditEntry.user_id == user_id, CreditEntry.is_deleted.is_(True), CreditEntry.deleted_at >= since)
        .order_by(CreditEntry.deleted_at.desc())
        .limit(HISTORY_LIMIT)
        .all()
    )


def binned_entry(user_id: uuid.UUID, entry_id: uuid.UUID, since: datetime) -> Optional[CreditEntry]:
    return (
        CreditEntry.query.filter_by(id=entry_id, user_id=user_id, is_deleted=True)
        .filter(CreditEntry.deleted_at >= since)
        .with_for_update(of=CreditEntry)
        .first()
    )


def all_for_seal(user_id: uuid.UUID) -> tuple[list[CreditEntry], list[CreditPayment], list[CreditCorrection]]:
    """Every entry, repayment and correction the business ever recorded,
    binned ones included (the bin hides, never erases): for a record seal."""
    return (
        CreditEntry.query.filter_by(user_id=user_id).all(),
        CreditPayment.query.filter_by(user_id=user_id).all(),
        CreditCorrection.query.filter_by(user_id=user_id).order_by(CreditCorrection.created_at).all(),
    )
