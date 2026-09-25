"""
BusinessProfileImage -- the trader's profile photo, as a Cloudinary upload.

The upload/scan bookkeeping behind business_profiles.profile_image_url
(the column every screen reads, holding only the CURRENT approved url).
A replaced photo's row is soft-deleted and its Cloudinary asset removed,
so nothing is left orphaned. Same split TruConnect uses for supplier
profile images (see REUSE.md).
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db
from src.shared.media.mixins import MediaAssetMixin


class BusinessProfileImage(BaseModel, MediaAssetMixin):
    __tablename__ = "business_profile_images"
    __table_args__ = (
        db.Index("ix_business_profile_images_user_id", "user_id"),
        {"schema": "trader"},
    )

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
