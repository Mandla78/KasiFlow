"""All database access for business profiles. Only this feature's services call this."""
from __future__ import annotations

import uuid
from typing import Optional

from src.extensions import db

from ..models import BusinessProfile


def for_user(user_id: uuid.UUID) -> Optional[BusinessProfile]:
    return BusinessProfile.query.filter_by(user_id=user_id, is_deleted=False).first()


def create(user_id: uuid.UUID) -> BusinessProfile:
    profile = BusinessProfile(user_id=user_id, categories=[], tools={})
    db.session.add(profile)
    return profile
