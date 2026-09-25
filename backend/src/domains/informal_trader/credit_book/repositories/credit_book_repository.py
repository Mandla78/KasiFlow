"""
All database access for the credit book. Only this feature's services call
this, and EVERY query takes the trader's user_id: a row that isn't theirs
is simply not found (IDOR rule).
"""
from __future__ import annotations

import uuid
from typing import Iterable, Optional

from sqlalchemy import func

from src.extensions import db

from ..constants import LIST_LIMIT, SEARCH_LIMIT
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
        CreditEntry.query.filter(CreditEntry.user_id == user_id, CreditEntry.status.in_(list(statuses)))
        .order_by(CreditEntry.due_on, CreditEntry.created_at)
        .limit(LIST_LIMIT)
        .all()
    )


def entry(user_id: uuid.UUID, entry_id: uuid.UUID, *, lock: bool = False) -> Optional[CreditEntry]:
    """lock=True holds the row (SELECT ... FOR UPDATE) until commit, so two
    payments at the same moment are counted one after the other."""
    query = CreditEntry.query.filter_by(id=entry_id, user_id=user_id)
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
        CreditEntry.user_id == user_id, CreditEntry.status == "open", CreditEntry.customer_id.in_(customer_ids)
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


def payments_since(user_id: uuid.UUID, since) -> int:
    """Money paid back from `since` (a date) on, across the whole book."""
    total = (
        db.session.query(func.coalesce(func.sum(CreditPayment.amount_cents), 0))
        .filter(CreditPayment.user_id == user_id, CreditPayment.paid_on >= since)
        .scalar()
    )
    return int(total)


def add(row) -> None:
    db.session.add(row)
