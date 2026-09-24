"""
Consent -- a record that a user accepted a specific version of a legal
document (POPIA: we must be able to show WHAT was agreed and WHEN).

Append-only: accepting a new version adds a row; old rows are never
changed, so the history of what each user agreed to stays intact.
"""
from __future__ import annotations

import enum
import uuid

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import utcnow
from src.extensions import db


class LegalDocument(str, enum.Enum):
    PRIVACY_POLICY = "privacy_policy"
    TERMS_OF_USE = "terms_of_use"


class Consent(db.Model):
    __tablename__ = "consents"
    __table_args__ = (
        db.CheckConstraint("document IN ('privacy_policy', 'terms_of_use')", name="ck_consents_document"),
        {"schema": "identity"},
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, index=True)
    document = db.Column(db.String(30), nullable=False)
    version = db.Column(db.String(30), nullable=False)
    accepted_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(300), nullable=True)
