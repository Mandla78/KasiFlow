"""
media_uploads -- one row per upload, from the moment we sign it to the
moment the feature keeps it (or the sweep throws it away).

    started   -> signed and handed to the phone; nothing kept yet
    finished  -> the feature checked and kept it (bytes = real size)
    abandoned -> never finished in time: the file was deleted by the sweep
    cancelled -> refused on finish (too big, over the daily limit): deleted

WHY ONE TABLE DOES THREE JOBS
  * ownership: finish() only accepts a public_id that THIS user started,
    for THIS purpose, and hasn't finished yet (not just a folder prefix)
  * clean-up: a started row past expires_at is an abandoned upload whose
    file may be sitting on Cloudinary; the sweep deletes exactly those
    (never a blind scan of the storage account)
  * limits: the daily byte limit is the sum of this user's finished rows

MediaFileColumns: the columns a feature's own image table mixes in (next
to its own foreign key), e.g. trader.business_profile_images.
"""
from __future__ import annotations

import enum

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db


class UploadState(str, enum.Enum):
    STARTED = "started"
    FINISHED = "finished"
    ABANDONED = "abandoned"
    CANCELLED = "cancelled"


class MediaUpload(BaseModel):
    __tablename__ = "media_uploads"
    __table_args__ = (
        db.CheckConstraint("state IN ('started', 'finished', 'abandoned', 'cancelled')", name="ck_media_uploads_state"),
        db.Index("ix_media_uploads_state_expires_at", "state", "expires_at"),
        db.Index("ix_media_uploads_user_id_finished_at", "user_id", "finished_at"),
        {"schema": "platform"},
    )

    user_id = db.Column(UUID(as_uuid=True), nullable=False)
    #: Which feature and what for, e.g. "trader_profile_photo", "job_photo".
    purpose = db.Column(db.String(40), nullable=False)
    public_id = db.Column(db.String(300), nullable=False, unique=True)
    state = db.Column(db.String(12), nullable=False, default=UploadState.STARTED.value)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    finished_at = db.Column(db.DateTime(timezone=True), nullable=True)
    bytes = db.Column(db.Integer, nullable=True)


class ScanStatus(str, enum.Enum):
    PENDING = "pending"  # waiting for the malware scan
    APPROVED = "approved"
    REJECTED = "rejected"


class MediaFileColumns:
    """Mix into a feature's image table, next to BaseModel and its own FK."""

    public_id = db.Column(db.String(300), nullable=False, unique=True)
    url = db.Column(db.String(1000), nullable=False)
    format = db.Column(db.String(10), nullable=True)
    width = db.Column(db.Integer, nullable=True)
    height = db.Column(db.Integer, nullable=True)
    bytes = db.Column(db.Integer, nullable=False)
    scan_status = db.Column(db.String(10), nullable=False, default=ScanStatus.PENDING.value)
