"""
Security alerts to the account's owner (CONTRACT_notifications.txt section
3): a new phone, a changed password, other phones signed out, a locked
account. Always on (no switch). Called AFTER db.session.commit(); publish
never raises, so sign-in can't fail because of an alert.

Never an IP, a place, an email address or a device name in them, and the
locked alert never says why (Mandla, Q6).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from src.shared.notifications.notification_types import NotificationEvent
from src.shared.notifications.notifications import publish_notification, safely


def _publish(user_id, template: str, dedupe_key: str, *, link: bool = True, **params) -> None:
    publish_notification(
        NotificationEvent(
            recipient_user_id=user_id,
            template=template,
            dedupe_key=dedupe_key,
            params=params,
            link_type="security" if link else None,
        )
    )


@safely
def new_phone(user_id, trusted_phone_id) -> None:
    _publish(user_id, "account.new_phone", f"account:{user_id}:phone:{trusted_phone_id}")


@safely
def password_changed(user_id, changed_at: datetime) -> None:
    _publish(user_id, "account.password_changed", f"account:{user_id}:password:{changed_at.isoformat()}")


@safely
def phones_signed_out(user_id, at: datetime) -> None:
    _publish(user_id, "account.phones_signed_out", f"account:{user_id}:signout:{at.isoformat()}", link=False)


@safely
def locked(user_id, locked_until: Optional[datetime], minutes: int) -> None:
    if locked_until is None:
        return
    _publish(user_id, "account.locked", f"account:{user_id}:locked:{locked_until.isoformat()}", minutes=minutes)
