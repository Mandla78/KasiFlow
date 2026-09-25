"""
BusinessProfileImage -- the trader's profile photo, stored on Cloudinary.

business_profiles.profile_image_url is what screens read (the CURRENT,
approved photo); this table is the bookkeeping behind it: which file,
its real size, and its malware-scan status. A replaced photo's row is
soft-deleted and its file removed, so nothing is left orphaned.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db
from src.shared.media.models import MediaFileColumns


class BusinessProfileImage(BaseModel, MediaFileColumns):
    __tablename__ = "business_profile_images"
    __table_args__ = (
        db.Index("ix_business_profile_images_user_id", "user_id"),
        {"schema": "trader"},
    )

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
