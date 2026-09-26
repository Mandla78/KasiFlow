"""
The credit book's one alert (CONTRACT_notifications.txt, NEW): "3
customers due to pay you back today: R140". A daily check registered with
shared.notifications, so it runs on the trader's first unread check of
the day -- no scheduler. The same day again is ignored (dedupe_key).
Counts and money only: never a customer's name or phone.
"""
from __future__ import annotations

from src.shared.notifications.notification_types import NotificationEvent
from src.shared.notifications.notifications import publish_notification, safely

from . import credit_book_service


@safely
def due_today(user) -> None:
    summary = credit_book_service.summary(user)
    n = summary["due_today_count"]
    if not n:
        return
    publish_notification(
        NotificationEvent(
            recipient_user_id=user.id,
            template="credit.due_today",
            dedupe_key=f"credit:{user.id}:due:{credit_book_service.today().isoformat()}",
            params={"customers": "1 customer" if n == 1 else f"{n} customers", "amount_cents": summary["due_today_cents"]},
            link_type="credit",
        )
    )
