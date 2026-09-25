"""
The one way supplier data gets in: a supplier's feed, from their own
system (ERP / POS, later over the integration API) or from our seed
files. Both are the same two files (docs/supplier/03):

    supplier.json    the profile        -> integration/schemas SupplierFeedSchema
    products.csv     the catalogue      -> parse_product_row, row by row

REFUSED, nothing changed: a file too big, not UTF-8, missing columns,
more rows than allowed, or a supplier.json that fails its checks.
FINISHED: every good row applied, every bad row listed on the import job
with its row number and reason (never silently dropped). A product code sent twice
keeps the first row and reports the second.

The whole run is one transaction: the supplier, its products and the
import job are saved together, or not at all.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from marshmallow import ValidationError

from src.extensions import db
from src.shared.audit.event_types.catalogue import CatalogueAuditEvent as E

from ...catalogue.services import catalogue_service
from ...supplier_profile.services import supplier_service
from ..models import ImportJob
from ..repositories import import_job_repository as repo
from ..schemas.feed_schemas import PRODUCT_COLUMNS, REQUIRED_COLUMNS, RowError, load_supplier_feed, parse_product_row
from . import integration_audit

MAX_PROFILE_BYTES = 64 * 1024
MAX_CSV_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5000
MAX_LISTED_ERRORS = 200


class FeedRefused(Exception):
    """The feed as a whole can't be used; nothing was changed."""


@dataclass
class LoadReport:
    supplier: str
    created_supplier: bool
    rows: int = 0
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    deactivated: int = 0
    failed: int = 0
    errors: list[dict] = field(default_factory=list)


def load_directory(folder: Path, *, source: str = "seed", verified: bool = False, full: bool = True) -> LoadReport:
    """Loads <folder>/supplier.json and <folder>/products.csv."""
    return load_files(
        _read(folder / "supplier.json", MAX_PROFILE_BYTES),
        _read(folder / "products.csv", MAX_CSV_BYTES),
        source=source,
        verified=verified,
        full=full,
    )


def load_files(profile_bytes: bytes, csv_bytes: bytes, *, source: str, verified: bool = False, full: bool = True) -> LoadReport:
    sha = hashlib.sha256(profile_bytes + b"\0" + csv_bytes).hexdigest()
    try:
        fields = _profile(profile_bytes)
        raw_rows = _csv_rows(csv_bytes)
    except FeedRefused as refused:
        _refuse(sha, source, str(refused))
        raise

    supplier, created_supplier = supplier_service.upsert_from_feed(fields, verified=verified, actor=source)
    db.session.flush()  # the supplier's id, for its products and the job

    good: list[dict] = []
    errors: list[dict] = []
    seen: set[str] = set()
    for number, row in raw_rows:
        if row is None:
            errors.append({"row": number, "field": "_row", "reason": "More cells than there are columns."})
            continue
        try:
            parsed = parse_product_row(row, supplier.categories)
        except RowError as e:
            errors.append({"row": number, "field": e.field, "reason": e.reason})
            continue
        if parsed["product_code"] in seen:
            errors.append({"row": number, "field": "product_code", "reason": "This product code is already on an earlier row."})
            continue
        seen.add(parsed["product_code"])
        good.append(parsed)

    # A full catalogue with nothing usable would switch every product off: refuse instead.
    if full and raw_rows and not good:
        db.session.rollback()
        _refuse(sha, source, "No row could be used; nothing was changed.", errors=errors)
        raise FeedRefused("No row could be used; nothing was changed.")

    applied = catalogue_service.apply_feed(supplier.id, good, full=full)
    report = LoadReport(
        supplier=supplier.trading_name,
        created_supplier=created_supplier,
        rows=len(raw_rows),
        created=applied.created,
        updated=applied.updated,
        unchanged=applied.unchanged,
        deactivated=applied.deactivated,
        failed=len(errors),
        errors=errors,
    )
    repo.add(
        ImportJob(
            supplier_id=supplier.id,
            source=source,
            file_sha256=sha,
            status="finished",
            rows=report.rows,
            created=report.created,
            updated=report.updated,
            unchanged=report.unchanged,
            deactivated=report.deactivated,
            failed=report.failed,
            errors=errors[:MAX_LISTED_ERRORS],
        )
    )
    db.session.commit()
    integration_audit.record(
        E.IMPORT_FINISHED,
        actor=source,
        external_id=supplier.external_id,
        rows=report.rows,
        created=report.created,
        updated=report.updated,
        deactivated=report.deactivated,
        failed=report.failed,
    )
    return report


def _read(path: Path, limit: int) -> bytes:
    if not path.is_file():
        raise FeedRefused(f"{path.name} is missing.")
    if path.stat().st_size > limit:
        raise FeedRefused(f"{path.name} is bigger than {limit // 1024} KB.")
    return path.read_bytes()


def _profile(data: bytes) -> dict:
    if len(data) > MAX_PROFILE_BYTES:
        raise FeedRefused("supplier.json is too big.")
    try:
        raw = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise FeedRefused("supplier.json isn't valid UTF-8 JSON.") from None
    try:
        return load_supplier_feed(raw)
    except ValidationError as e:
        # Field names only in the message; the values could be anything.
        raise FeedRefused(f"supplier.json has problems in: {', '.join(sorted(_paths(e.messages)))}.") from None


def _paths(messages, prefix: str = "") -> list[str]:
    if isinstance(messages, dict):
        out: list[str] = []
        for key, value in messages.items():
            out += _paths(value, f"{prefix}.{key}" if prefix else str(key))
        return out
    return [prefix or "_schema"]


def _csv_rows(data: bytes) -> list[tuple[int, Optional[dict]]]:
    """(row number, cells) per row; cells=None when the row has extra cells."""
    if len(data) > MAX_CSV_BYTES:
        raise FeedRefused("products.csv is too big.")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise FeedRefused("products.csv isn't UTF-8.") from None
    if "\x00" in text:
        raise FeedRefused("products.csv contains NUL characters.")
    reader = csv.DictReader(io.StringIO(text, newline=""))
    header = [h.strip() for h in (reader.fieldnames or [])]
    missing = [c for c in REQUIRED_COLUMNS if c not in header]
    unknown = [c for c in header if c not in PRODUCT_COLUMNS]
    if missing:
        raise FeedRefused(f"products.csv is missing columns: {', '.join(missing)}.")
    if unknown:
        raise FeedRefused(f"products.csv has unknown columns: {', '.join(unknown[:5])}.")
    reader.fieldnames = header
    rows: list[tuple[int, Optional[dict]]] = []
    for number, row in enumerate(reader, start=2):  # row 1 is the header
        rows.append((number, None if None in row else row))  # csv puts extra cells under the key None
        if len(rows) > MAX_ROWS:
            raise FeedRefused(f"products.csv has more than {MAX_ROWS} rows; send it in parts.")
    return rows


def _refuse(sha: str, source: str, reason: str, *, errors: Optional[list[dict]] = None) -> None:
    repo.add(
        ImportJob(
            supplier_id=None,
            source=source,
            file_sha256=sha,
            status="refused",
            failed=len(errors or []),
            errors=(errors or [])[:MAX_LISTED_ERRORS],
            refused_reason=reason[:300],
        )
    )
    db.session.commit()
    integration_audit.record(E.IMPORT_REFUSED, ok=False, actor=source, reason=reason)
