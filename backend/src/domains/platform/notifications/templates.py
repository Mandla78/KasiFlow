"""
Every alert the app can show, in one place (CONTRACT_notifications.txt
section 4). Each template fixes its tab (orders | inbox), its topic (the
trader's switch: orders, jobs, credit; security is always on), its icon,
a FIXED title and the body's wording. Only the body takes params, and
only ones the server filled: names and numbers it already has. Never a
client's name or phone, an IP, a place, an email, a device name, or
anything typed into a free-text note; a partner alert never shows the
client's price. Only order.paid says "paid", and only after the
provider-verified path.

Money: a param ending in _cents is shown as rand under the name without
the suffix ({total} from total_cents), so publishers send numbers, not
text.
"""
from __future__ import annotations

import string
from typing import Any, NamedTuple

TABS = ("orders", "inbox")
TOPICS = ("orders", "jobs", "credit", "security")
#: What tapping an alert opens (the app maps each to a screen).
LINK_TYPES = ("order", "job", "invite", "help_post", "credit", "security")


class Template(NamedTuple):
    tab: str
    topic: str
    icon: str
    title: str
    body: str


def _orders(icon: str, title: str, body: str) -> Template:
    return Template("orders", "orders", icon, title, body)


def _inbox(topic: str, icon: str, title: str, body: str) -> Template:
    return Template("inbox", topic, icon, title, body)


TEMPLATES: dict[str, Template] = {
    # Supplier orders (Orders tab)
    "order.sent": _orders("send", "Order sent", "{ref} · {total} to {supplier}. Waiting for them to accept."),
    "order.awaiting_payment": _orders("credit-card", "Pay to send it", "{ref} · {total}. Pay in the app to send it to {supplier}."),
    "order.accepted": _orders("check-circle", "Order accepted", "{supplier} accepted {ref}."),
    "order.rejected": _orders("x-circle", "Order not accepted", "{supplier} can't take {ref}."),
    "order.on_its_way": _orders("truck", "On its way", "{supplier} is delivering {ref}."),
    "order.on_its_way_cash": _orders("truck", "On its way", "{supplier} is delivering {ref}. Have {total} cash ready."),
    "order.ready": _orders("package", "Ready to collect", "{ref} is ready at {supplier}."),
    "order.delivered": _orders("home", "Delivered", "{ref} was delivered."),
    "order.collected": _orders("check", "Collected", "You collected {ref}."),
    "order.paid": _orders("shield", "Paid in the app", "{total} for {ref}, confirmed by the payment provider."),
    "order.expired": _orders("clock", "Order lapsed", "{ref} wasn't paid within 24 hours, so it was never sent."),
    # Your account (Inbox, always on)
    "account.new_phone": _inbox("security", "smartphone", "New phone signed in", "Your account was opened on a new phone. Not you? Change your password."),
    "account.password_changed": _inbox("security", "lock", "Password changed", "Your password was changed. Not you? Reset it now."),
    "account.phones_signed_out": _inbox("security", "log-out", "Other phones signed out", "Every other phone was signed out of your account."),
    # Never says why (Mandla, Q6): only that sign-in is paused, and what to do.
    "account.locked": _inbox("security", "alert-triangle", "Account locked", "Sign-in is paused for {minutes} minutes to keep your account safe. If that wasn't you, change your password."),
    # Jobs: what the client did (Inbox)
    "job.stage_confirmed": _inbox("jobs", "check-circle", "Stage confirmed", "The client confirmed {stage} of {job}: {amount}."),
    "job.amounts_dont_match": _inbox("jobs", "alert-circle", "Amounts don't match", "The amounts for {stage} of {job} differ. Both are kept."),
    "job.not_yet": _inbox("jobs", "clock", "Not signed off yet", "{stage} of {job} isn't signed off yet. See the note."),
    "job.done": _inbox("jobs", "award", "Job done", "{job}: every stage confirmed by the client."),
    # The builder network: what another builder did (Inbox)
    "partner.invited": _inbox("jobs", "user-plus", "New job invite", "{owner} invites you: {trade}, {stages} · {pay} · starts {day}."),
    "partner.accepted": _inbox("jobs", "user-check", "Invite accepted", "{partner} is on {job}. You have each other's number now."),
    "partner.declined": _inbox("jobs", "user-x", "Invite declined", "{partner} can't do {job}."),
    "partner.payment_recorded": _inbox("jobs", "dollar-sign", "Confirm a payment", "{owner} says they paid you {amount}. Confirm what you got."),
    "partner.payment_confirmed": _inbox("jobs", "check", "Payment confirmed", "{partner} confirmed {amount}."),
    "partner.payment_mismatch": _inbox("jobs", "alert-circle", "Amounts don't match", "{partner} says they got a different amount. Both are kept."),
    "help.interested": _inbox("jobs", "thumbs-up", "Someone is interested", "{builder} can do your {trade} post."),
    "help.picked": _inbox("jobs", "briefcase", "You're on a job", "{owner} picked you: {trade}, {stages} in {suburb} · {pay}."),
    # Credit book (Inbox)
    "credit.due_today": _inbox("credit", "book", "Pay-backs due today", "{customers} pay you back today: {amount}."),
}


def rand(cents: int) -> str:
    """R4,500 or R12.50."""
    whole, part = divmod(int(cents), 100)
    text = f"R{whole:,}"
    return f"{text}.{part:02d}" if part else text


def placeholders(template: Template) -> set[str]:
    return {name for _, name, _, _ in string.Formatter().parse(template.body) if name}


def display_params(params: dict[str, Any]) -> dict[str, Any]:
    """Params as the body shows them: *_cents as rand without the suffix."""
    shown: dict[str, Any] = {}
    for key, value in (params or {}).items():
        if key.endswith("_cents") and isinstance(value, int) and not isinstance(value, bool):
            shown[key[: -len("_cents")]] = rand(value)
        else:
            shown[key] = value
    return shown


def missing(kind: str, params: dict[str, Any]) -> set[str]:
    """Placeholders the params don't fill (a publisher's bug)."""
    return placeholders(TEMPLATES[kind]) - set(display_params(params))


class _Blank(dict):
    def __missing__(self, key: str) -> str:
        return ""


def render(kind: str, params: dict[str, Any]) -> tuple[str, str]:
    """(title, body). Never raises: a param that went missing renders empty."""
    t = TEMPLATES[kind]
    return t.title, t.body.format_map(_Blank(display_params(params)))
