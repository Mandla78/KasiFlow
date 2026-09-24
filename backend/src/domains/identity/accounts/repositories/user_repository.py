"""All database access for users and consents. Only accounts' services call this."""
from __future__ import annotations

import uuid
from typing import Optional

from src.extensions import db

from ..models import Consent, User


def get_by_id(user_id: uuid.UUID) -> Optional[User]:
    user = db.session.get(User, user_id)
    return user if user and not user.is_deleted else None


def get_by_email(normalized_email: str) -> Optional[User]:
    return User.query.filter_by(email=normalized_email, is_deleted=False).first()


def add(user: User) -> User:
    db.session.add(user)
    db.session.flush()  # assigns the id without committing
    return user


def add_consent(consent: Consent) -> None:
    db.session.add(consent)


def consents_for(user_id: uuid.UUID) -> list[Consent]:
    return Consent.query.filter_by(user_id=user_id).order_by(Consent.accepted_at.desc()).all()
