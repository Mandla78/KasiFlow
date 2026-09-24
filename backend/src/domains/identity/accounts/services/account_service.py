"""
accounts -- the user record. The ONLY writer of identity.users and
identity.consents; auth/ and devices/ call these functions.
"""
from __future__ import annotations

import uuid
from typing import Optional

from flask import current_app

from src.core.base_model import utcnow
from src.core.exceptions import ValidationError
from src.shared.validation.identifiers import normalize_email

from ..models import AccountStatus, Consent, LegalDocument, SignUpMethod, User
from ..repositories import user_repository


def normalized(email: str) -> str:
    return normalize_email(email or "")


def get(user_id: uuid.UUID | str) -> Optional[User]:
    try:
        return user_repository.get_by_id(uuid.UUID(str(user_id)))
    except ValueError:
        return None


def find_by_email(email: str) -> Optional[User]:
    return user_repository.get_by_email(normalized(email))


def create_unverified(email: str, business_name: str, method: SignUpMethod = SignUpMethod.EMAIL) -> User:
    return user_repository.add(
        User(
            email=normalized(email),
            business_name=business_name.strip(),
            status=AccountStatus.UNVERIFIED.value,
            signed_up_with=method.value,
        )
    )


def restart_unverified(user: User, business_name: str) -> User:
    """Someone signs up again with an email that was never verified. The
    earlier attempt proved nothing about who owns the address, so its
    details are replaced rather than kept."""
    user.business_name = business_name.strip()
    return user


def mark_verified(user: User) -> None:
    if user.status == AccountStatus.UNVERIFIED.value:
        user.status = AccountStatus.ACTIVE.value
    user.email_verified_at = user.email_verified_at or utcnow()


def record_login(user: User) -> None:
    user.last_login_at = utcnow()


def check_consent_versions(privacy_version: str, terms_version: str) -> None:
    """The app must send the versions the user actually saw. An old app
    showing an older document must not record consent to the new one."""
    cfg = current_app.config
    if privacy_version != cfg["PRIVACY_POLICY_VERSION"] or terms_version != cfg["TERMS_VERSION"]:
        raise ValidationError(
            "Please update the app and accept the latest Privacy Policy and Terms of Use.",
            code="CONSENT_OUTDATED",
        )


def record_consents(user: User, privacy_version: str, terms_version: str, ip: Optional[str], user_agent: Optional[str]) -> None:
    now = utcnow()
    for document, version in ((LegalDocument.PRIVACY_POLICY, privacy_version), (LegalDocument.TERMS_OF_USE, terms_version)):
        user_repository.add_consent(
            Consent(
                user_id=user.id,
                document=document.value,
                version=version,
                accepted_at=now,
                ip_address=ip,
                user_agent=(user_agent or "")[:300] or None,
            )
        )


def public_view(user: User) -> dict:
    """What the app may see about the signed-in user. Never secrets."""
    return {
        "id": str(user.id),
        "email": user.email,
        "business_name": user.business_name,
        "status": user.status,
        "dashboard": user.dashboard,
        "signed_up_with": user.signed_up_with,
        "email_verified": user.email_verified_at is not None,
    }
