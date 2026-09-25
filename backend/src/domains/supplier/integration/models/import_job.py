"""
ImportJob -- one run of a supplier's catalogue feed: who sent it, what
file (by hash), and what happened to every row.

Bad rows are never silently dropped: each one is listed here with its
row number and the reason, so the supplier (or we) can fix the file.
refused: the file itself was rejected (too big, wrong columns, nothing
valid...) and nothing was changed.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import JSONB, UUID

from src.core.base_model import BaseModel
from src.extensions import db

SOURCES = ("seed", "integration_api")
STATUSES = ("finished", "refused")


def _in(column: str, values: tuple) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class ImportJob(BaseModel):
    __tablename__ = "import_jobs"
    __table_args__ = (
        db.CheckConstraint(_in("source", SOURCES), name="ck_import_jobs_source"),
        db.CheckConstraint(_in("status", STATUSES), name="ck_import_jobs_status"),
        db.Index("ix_import_jobs_supplier_created", "supplier_id", "created_at"),
        {"schema": "supplier"},
    )

    supplier_id = db.Column(UUID(as_uuid=True), db.ForeignKey("supplier.suppliers.id", ondelete="CASCADE"), nullable=True)
    source = db.Column(db.String(20), nullable=False)
    #: sha256 of the file, so the same file sent twice is recognisable.
    file_sha256 = db.Column(db.String(64), nullable=False)
    status = db.Column(db.String(10), nullable=False)
    rows = db.Column(db.Integer, nullable=False, default=0)
    created = db.Column(db.Integer, nullable=False, default=0)
    updated = db.Column(db.Integer, nullable=False, default=0)
    unchanged = db.Column(db.Integer, nullable=False, default=0)
    deactivated = db.Column(db.Integer, nullable=False, default=0)
    failed = db.Column(db.Integer, nullable=False, default=0)
    #: [{"row": 12, "field": "price_rands", "reason": "..."}] (first 200)
    errors = db.Column(JSONB, nullable=False, default=list)
    refused_reason = db.Column(db.String(300), nullable=True)
