"""
Record seals (proof/integrity): a signed snapshot of the fingerprints of
every record a business keeps in its tools. The OWNER keeps the seal.

  seal(user)          fingerprint every record, sign the Merkle root twice
                      (Ed25519 + ML-DSA-65) and hand the seal to the owner
  check(user, seal)   is the seal ours and whole? Then: has any sealed
                      record changed or gone since? (New records are fine.)

Why the owner holds it: we keep no copy. If a sealed record changes later
-- even straight in our own database -- the owner's seal shows it, and we
can't quietly re-sign the old seal, because the owner already has it.

What a seal is NOT: proof that a record is true. It shows the records
haven't changed since they were sealed. Only a payment the payment
provider verified is proof of payment (CLAUDE.md, honest proof).

Records come from each tool's SERVICE (credit book, jobs, order book),
never their repositories. A seal carries only kinds, ids and fingerprints:
no names, amounts or text.
"""
from __future__ import annotations

from typing import Optional

from src.core.base_model import utcnow
from src.core.exceptions import ConflictError, ValidationError
from src.domains.informal_trader.credit_book.services import credit_book_service
from src.domains.informal_trader.jobs.services import jobs_service
from src.domains.informal_trader.order_book.services import order_book_service
from src.shared.audit.event_types.business import BusinessAuditEvent as E

from . import fingerprints as fp
from . import seal_audit, seal_keys

VERSION = 1
#: Signed with the seal header, so a signature can't be reused for anything else.
DOMAIN = b"akayza-record-seal-v1\n"
MAX_RECORDS = 20_000

#: What each kind of record is called on screen, and the day it happened.
KINDS = {
    "credit_given": ("Credit given", "given_on"),
    "credit_repayment": ("Repayment", "paid_on"),
    "credit_correction": ("Correction", "recorded_at"),
    "stage_confirmed": ("Stage confirmed", "confirmed_at"),
    "sign_off_answer": ("Client's sign-off", "answered_at"),
    "counter_order": ("Counter order", "day"),
    "menu_price": ("Menu price", "valid_from"),
}
SOURCES = (credit_book_service, jobs_service, order_book_service)


def _records(user) -> dict[tuple[str, str], tuple[bytes, dict]]:
    out: dict = {}
    for source in SOURCES:
        for kind, rid, fields in source.seal_records(user):
            out[(kind, rid)] = (fp.leaf(kind, rid, fields), fields)
    return out


def _message(header: dict) -> bytes:
    return DOMAIN + fp.canonical(header)


def _invalid(message: str) -> ValidationError:
    return ValidationError(message, errors=[{"seal": [message]}])


def seal(user) -> dict:
    records = _records(user)
    if len(records) > MAX_RECORDS:
        raise ConflictError("There are too many records to seal at once.", code="TOO_MANY_RECORDS")
    keys = sorted(records)
    leaves = [records[k][0] for k in keys]
    header = {
        "v": VERSION,
        "alg": seal_keys.algorithms(),
        "business": str(user.id),
        "sealed_at": utcnow().replace(microsecond=0).isoformat(),
        "count": len(keys),
        "root": fp.root(leaves).hex(),
    }
    signed = seal_keys.sign(_message(header))
    seal_audit.record(E.RECORD_SEALED, user_id=user.id, records=len(keys), algorithms=len(header["alg"]))
    return {**header, "leaves": [[k, i, leaf.hex()] for (k, i), leaf in zip(keys, leaves)], **signed}


def _item(kind: str, rid: str, fields: Optional[dict]) -> dict:
    label, day_field = KINDS[kind]
    day = fields.get(day_field) if fields else None
    return {"kind": label, "id": rid, "on": day.isoformat()[:10] if day else None}


def check(user, seal: dict) -> dict:
    if seal["business"] != str(user.id):
        raise _invalid("This seal is for another account.")
    header = {k: seal[k] for k in ("v", "alg", "business", "sealed_at", "count", "root")}
    signatures = seal_keys.verify(_message(header), seal["sig"], seal["key_ids"], list(header["alg"]))
    if "old_key" in signatures.values():
        raise ConflictError("This seal was made with a key we no longer use, so it can't be checked here.", code="SEAL_OLD_KEY")

    leaves = [tuple(x) for x in seal["leaves"]]
    ids = [(k, i) for k, i, _ in leaves]
    whole = (
        len(leaves) == header["count"]
        and ids == sorted(ids)
        and len(set(ids)) == len(ids)
        and fp.root([bytes.fromhex(h) for _, _, h in leaves]).hex() == header["root"]
    )
    if signatures["ed25519"] != "valid" or signatures["ml_dsa_65"] == "invalid" or not whole:
        seal_audit.record(E.RECORD_CHECKED, user_id=user.id, outcome="seal_invalid")
        raise _invalid("This seal has been altered, or it wasn't made by us.")

    now = _records(user)
    changed, missing = [], []
    for kind, rid, h in leaves:
        current = now.get((kind, rid))
        if current is None:
            missing.append(_item(kind, rid, None))
        elif current[0].hex() != h:
            changed.append(_item(kind, rid, current[1]))
    intact = not changed and not missing
    seal_audit.record(E.RECORD_CHECKED, user_id=user.id, outcome="intact" if intact else "changed", changed=len(changed), missing=len(missing))
    return {
        "intact": intact,
        "signatures": signatures,
        "sealed_at": header["sealed_at"],
        "sealed": len(leaves),
        "unchanged": len(leaves) - len(changed) - len(missing),
        "changed": changed,
        "missing": missing,
        "added_since": len(set(now) - set(ids)),
    }
