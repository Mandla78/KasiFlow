"""
JobStage -- one paid step of a job (Deposit, Walls, Roof...).

The photo is the builder's camera photo of the finished stage, kept in the
job's Cloudinary folder. photo_taken_at is the SERVER's time on upload and
photo_sha256 the hash of the stored file: neither comes from the phone, so
a swapped or back-dated photo is detectable.

builder_amount_cents / client_amount_cents are the CURRENT sign-off's two
amounts (every attempt is kept in job_sign_offs).
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import STAGE_STATUSES

_statuses = ", ".join(f"'{s}'" for s in STAGE_STATUSES)


class JobStage(BaseModel):
    __tablename__ = "job_stages"
    __table_args__ = (
        db.CheckConstraint("amount_cents > 0", name="ck_job_stages_amount"),
        db.CheckConstraint(f"status IN ({_statuses})", name="ck_job_stages_status"),
        db.UniqueConstraint("job_id", "position", name="uq_job_stages_position"),
        {"schema": "trader"},
    )

    job_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trader.jobs.id", ondelete="CASCADE"), nullable=False)
    position = db.Column(db.Integer, nullable=False)
    name = db.Column(db.String(40), nullable=False)
    amount_cents = db.Column(db.BigInteger, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="not_started")

    photo_public_id = db.Column(db.String(500), nullable=True)
    photo_url = db.Column(db.String(1000), nullable=True)
    photo_sha256 = db.Column(db.String(64), nullable=True)
    photo_taken_at = db.Column(db.DateTime(timezone=True), nullable=True)

    builder_amount_cents = db.Column(db.BigInteger, nullable=True)
    client_amount_cents = db.Column(db.BigInteger, nullable=True)
    client_note = db.Column(db.String(200), nullable=True)
    sign_off_sent_at = db.Column(db.DateTime(timezone=True), nullable=True)
    confirmed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    job = db.relationship("Job", back_populates="stages")
