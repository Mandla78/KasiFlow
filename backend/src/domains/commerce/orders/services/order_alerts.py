"""
The trader's alerts about their supplier orders (CONTRACT_notifications.txt
section 3). Called AFTER db.session.commit(), never before: a rolled-back
order must never leave an alert behind. publish never raises, so an order
can't fail because of an alert.

  alert(order, status)   status is the order's new status, or "paid"

Only "paid" (the provider-verified path, mark_paid) says the money is in.
An order the trader cancelled themselves gets no alert: they did it.
"""
from __future__ import annotations

from src.shared.notifications.notification_types import NotificationEvent
from src.shared.notifications.notifications import publish_notification, safely

_TEMPLATE = {
    "placed": "order.sent",
    "awaiting_payment": "order.awaiting_payment",
    "accepted": "order.accepted",
    "rejected": "order.rejected",
    "out_for_delivery": "order.on_its_way",
    "ready_for_collection": "order.ready",
    "delivered": "order.delivered",
    "collected": "order.collected",
    "paid": "order.paid",
    "expired": "order.expired",
}


@safely
def alert(order, status: str) -> None:
    template = _TEMPLATE.get(status)
    if template is None:
        return
    if template == "order.on_its_way" and order.payment_method == "cash":
        template = "order.on_its_way_cash"
    publish_notification(
        NotificationEvent(
            recipient_user_id=order.user_id,
            template=template,
            dedupe_key=f"order:{order.id}:{status}",
            params={"ref": order.reference, "supplier": order.supplier_name, "total_cents": order.total_cents},
            link_type="order",
            link_id=str(order.id),
        )
    )
