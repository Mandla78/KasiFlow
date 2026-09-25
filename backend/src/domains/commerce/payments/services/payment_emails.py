"""
The email a trader gets when their digital payment is confirmed: what was
paid, for which order, and where the invoice and receipt are. Sent once,
after the payment is saved; a failure to send never undoes the payment.
"""
from __future__ import annotations

from src.domains.identity.accounts.services import account_service
from src.domains.informal_trader.business_profile.services import business_profile_service
from src.shared.email.email import EmailService


def _r(cents: int) -> str:
    return f"R{cents / 100:,.2f}"


def payment_received(order, provider_reference: str | None) -> None:
    user = account_service.get(order.user_id)
    if user is None or not user.email:
        return
    profile = business_profile_service.get(user)
    EmailService.send_template(
        to=user.email,
        template_name="payment_received.html",
        subject=f"Payment received for order {order.reference}",
        context={
            "business": profile.business_name if profile else None,
            "supplier": order.supplier_name,
            "reference": order.reference,
            "total": _r(order.total_cents),
            "provider_reference": provider_reference,
            "fulfilment_label": "Deliver to" if order.fulfilment == "delivery" else "Collect at",
            "address": order.address,
            "lines": [{"qty": l.qty, "name": l.name, "pack": l.pack_size, "total": _r(l.line_total_cents)} for l in order.lines],
            "delivery": _r(order.delivery_fee_cents) if order.delivery_fee_cents else None,
        },
    )
