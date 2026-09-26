"""
The credit book's part of a record seal (proof/integrity): every fact
that never changes once recorded -- the credit as first given, each
repayment, each correction -- as (kind, id, fields).

Left out on purpose: the status (paying off is a normal change) and the
bin (binning hides, never erases, and can be undone). A correction adds
its own record and leaves the credit as first given untouched, so a
corrected entry is never mistaken for tampering.
"""
from __future__ import annotations

from ..repositories import credit_book_repository as repo


def seal_records(user) -> list[tuple[str, str, dict]]:
    entries, payments, corrections = repo.all_for_seal(user.id)
    first: dict = {}
    for c in corrections:  # oldest first: the first one holds the values as given
        first.setdefault(c.entry_id, c)
    out: list[tuple[str, str, dict]] = []
    for e in entries:
        c = first.get(e.id)
        out.append(("credit_given", str(e.id), {
            "customer": str(e.customer_id),
            "given_on": e.given_on,
            "amount_cents": c.before_amount_cents if c else e.amount_cents,
            "due_on": c.before_due_on if c else e.due_on,
            "description": c.before_description if c else e.description,
            "recorded_at": e.created_at,
        }))
    for p in payments:
        out.append(("credit_repayment", str(p.id), {"entry": str(p.entry_id), "amount_cents": p.amount_cents, "paid_on": p.paid_on, "recorded_at": p.created_at}))
    for c in corrections:
        out.append(("credit_correction", str(c.id), {
            "entry": str(c.entry_id),
            "kind": c.kind,
            "before": [c.before_amount_cents, c.before_due_on, c.before_description],
            "after": [c.after_amount_cents, c.after_due_on, c.after_description],
            "reason": c.reason,
            "recorded_at": c.created_at,
        }))
    return out
