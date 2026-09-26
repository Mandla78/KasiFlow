"""
The builder network's alerts (CONTRACT_notifications.txt section 3, NEW):
what ANOTHER builder did -- an invite, an answer, "I paid", a confirmed
payment, interest in a help post, a pick. Each goes to the other person,
never to the one who acted. Called AFTER db.session.commit(); publish
never raises.

What they may show is the network's own minimum: first names, the trade,
the stages, the partner's own pay, the start day, the suburb, and the
owner's own job title in the owner's own alerts. Never the client's name,
phone or price (DECISION_jobs_partners.txt).
"""
from __future__ import annotations

from datetime import date

from src.shared.notifications.notification_types import NotificationEvent
from src.shared.notifications.notifications import publish_notification, safely

from ..constants import TRADE_LABELS
from . import people

_DAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def _rand(cents: int) -> str:
    whole, part = divmod(int(cents), 100)
    text = f"R{whole:,}"
    return f"{text}.{part:02d}" if part else text


def pay_text(kind: str, cents: int, days: int) -> str:
    """The partner's pay as the app says it: "R4,500" or "R600 a day × 5 days = R3,000"."""
    if kind == "fixed":
        return _rand(cents)
    n = "1 day" if days == 1 else f"{days} days"
    return f"{_rand(cents)} a day × {n} = {_rand(cents * days)}"


def day_text(d: date) -> str:
    """"Tue 29 Sep" -- the same in every server locale."""
    return f"{_DAYS[d.weekday()]} {d.day} {_MONTHS[d.month - 1]}"


def list_text(names: list[str]) -> str:
    """"Walls and Roof", "Foundation, Walls and Roof"."""
    if len(names) <= 1:
        return names[0] if names else ""
    return f"{', '.join(names[:-1])} and {names[-1]}"


def _trade(key: str) -> str:
    return TRADE_LABELS.get(key, key).lower()


def _first(user_id) -> str:
    return people.first_name(people.names_for([user_id]).get(user_id, "") or "A builder")


def _stage_names(job, stage_ids) -> str:
    wanted = set(stage_ids)
    return list_text([s.name for s in sorted(job.stages, key=lambda s: s.position) if s.id in wanted])


def _publish(to, template: str, dedupe_key: str, link: tuple, **params) -> None:
    publish_notification(
        NotificationEvent(recipient_user_id=to, template=template, dedupe_key=dedupe_key, params=params, link_type=link[0], link_id=str(link[1]))
    )


@safely
def invited(row, job) -> None:
    _publish(
        row.builder_id, "partner.invited", f"partner:{row.id}:invited", ("invite", row.id),
        owner=_first(row.owner_id), trade=_trade(row.trade), stages=_stage_names(job, row.stage_ids),
        pay=pay_text(row.pay_kind, row.pay_cents, row.days), day=day_text(row.starts_on),
    )  # fmt: skip


@safely
def answered(row, job) -> None:
    template = "partner.accepted" if row.status == "accepted" else "partner.declined"
    _publish(row.owner_id, template, f"partner:{row.id}:answered", ("job", job.id), partner=_first(row.builder_id), job=job.title)


@safely
def payment_recorded(row, payment) -> None:
    _publish(
        row.builder_id, "partner.payment_recorded", f"payment:{payment.id}:recorded", ("invite", row.id),
        owner=_first(row.owner_id), amount_cents=payment.owner_cents,
    )  # fmt: skip


@safely
def payment_answered(row, payment) -> None:
    if payment.status == "confirmed":
        _publish(
            row.owner_id, "partner.payment_confirmed", f"payment:{payment.id}:answered", ("job", row.job_id),
            partner=_first(row.builder_id), amount_cents=payment.partner_cents,
        )  # fmt: skip
    else:
        _publish(row.owner_id, "partner.payment_mismatch", f"payment:{payment.id}:answered", ("job", row.job_id), partner=_first(row.builder_id))


@safely
def help_interested(post, builder_id) -> None:
    _publish(
        post.owner_id, "help.interested", f"help:{post.id}:interested:{builder_id}", ("help_post", post.id),
        builder=_first(builder_id), trade=_trade(post.trade),
    )  # fmt: skip


@safely
def help_picked(post, row, job) -> None:
    _publish(
        row.builder_id, "help.picked", f"help:{post.id}:picked:{row.builder_id}", ("invite", row.id),
        owner=_first(post.owner_id), trade=_trade(post.trade), stages=_stage_names(job, post.stage_ids),
        suburb=post.suburb, pay=pay_text(post.pay_kind, post.pay_cents, post.days),
    )  # fmt: skip
