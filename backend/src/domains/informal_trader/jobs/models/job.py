"""
Job -- a builder's piece of work for a client, paid in stages.

The client's name and cellphone are the builder's own data: the phone is
where the sign-off link goes (from the builder's own WhatsApp). Never in
logs, the audit trail, the public sign-off page or a shared record.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db

from ..constants import JOB_STATUSES, MAX_JOB_CENTS

_statuses = ", ".join(f"'{s}'" for s in JOB_STATUSES)


class Job(BaseModel):
    __tablename__ = "jobs"
    __table_args__ = (
        db.CheckConstraint(f"total_cents > 0 AND total_cents <= {MAX_JOB_CENTS}", name="ck_jobs_total"),
        db.CheckConstraint(f"status IN ({_statuses})", name="ck_jobs_status"),
        db.CheckConstraint("client_phone ~ '^0[6-8][0-9]{8}$'", name="ck_jobs_client_phone"),
        db.Index("ix_jobs_user_status", "user_id", "status"),
        {"schema": "trader"},
    )

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
    title = db.Column(db.String(60), nullable=False)
    client_name = db.Column(db.String(60), nullable=False)
    client_phone = db.Column(db.String(10), nullable=False)
    place = db.Column(db.String(120), nullable=False, default="")
    total_cents = db.Column(db.BigInteger, nullable=False)
    status = db.Column(db.String(10), nullable=False, default="active")

    stages = db.relationship("JobStage", order_by="JobStage.position", lazy="selectin", back_populates="job")
