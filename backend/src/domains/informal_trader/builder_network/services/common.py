"""
What every builder network service shares: the errors (one message the
app shows), South Africa's "today", the offer rules and the views of an
offer and a payment.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from src.core.exceptions import AppError, ConflictError, NotFoundError, ValidationError

from ..constants import MAX_DAY_RATE_CENTS, MAX_DAYS, MAX_OFFER_CENTS, MAX_STAGES, START_WITHIN_DAYS, TRADE_LABELS, TRADES

TIMEZONE = "Africa/Johannesburg"


def today() -> date:
    return datetime.now(ZoneInfo(TIMEZONE)).date()


def now() -> datetime:
    return datetime.now(timezone.utc)


def day_ago() -> datetime:
    return now() - timedelta(days=1)


def invalid(field: str, message: str) -> ValidationError:
    # One field, one rule: the message itself is what the app shows.
    return ValidationError(message, errors=[{field: [message]}])


def not_found(what: str = "builder") -> NotFoundError:
    return NotFoundError(f"We couldn't find that {what}.")


def conflict(code: str, message: str) -> ConflictError:
    return ConflictError(message, code=code)


def too_many(message: str) -> AppError:
    return AppError(message, status_code=429, code="RATE_LIMITED")


def hidden() -> ConflictError:
    return conflict("PROFILE_HIDDEN", 'Turn on "Show me to other builders" first, in your builder profile.')


def trade_label(trade: str) -> str:
    return TRADE_LABELS.get(trade, "Builder")


def offer_total(kind: str, cents: int, days: int) -> int:
    return cents if kind == "fixed" else cents * days


def check_deal(job, data: dict) -> list:
    """The offer's rules, checked here (and by the database): the job's own
    open stages, a start day in the next 60 days, and a sane pay. Returns
    the stages in the job's order."""
    if job.status != "active":
        raise conflict("JOB_DONE", "This job is finished.")
    ids = list(dict.fromkeys(data["stage_ids"]))
    if not 1 <= len(ids) <= MAX_STAGES:
        raise invalid("stage_ids", "Pick at least one stage.")
    by_id = {s.id: s for s in job.stages}
    if any(i not in by_id for i in ids):
        raise invalid("stage_ids", "Pick stages of this job.")
    stages = sorted((by_id[i] for i in ids), key=lambda s: s.position)
    if any(s.status == "confirmed" for s in stages):
        raise invalid("stage_ids", "That stage is already confirmed by the client.")
    if data["trade"] not in TRADES:
        raise invalid("trade", "Pick the trade you need.")
    ahead = (data["starts_on"] - today()).days
    if not 0 <= ahead <= START_WITHIN_DAYS:
        raise invalid("starts_on", f"Pick a start day in the next {START_WITHIN_DAYS} days.")
    offer = data["offer"]
    if not 1 <= offer["days"] <= MAX_DAYS:
        raise invalid("offer", f"1 to {MAX_DAYS} days.")
    if offer["kind"] == "per_day" and offer["amount_cents"] > MAX_DAY_RATE_CENTS:
        raise invalid("offer", "A day rate up to R10,000.")
    if offer_total(offer["kind"], offer["amount_cents"], offer["days"]) > MAX_OFFER_CENTS:
        raise invalid("offer", "Pay up to R200,000.")
    return stages


def offer_view(row) -> dict:
    return {"kind": row.pay_kind, "amount_cents": row.pay_cents, "days": row.days, "paid_when": row.paid_when}


def payment_view(p) -> dict:
    return {
        "id": str(p.id),
        "owner_amount_cents": p.owner_cents,
        "partner_amount_cents": p.partner_cents,
        "status": p.status,
        "paid_at": p.created_at.isoformat(),
    }


def still_owed(row) -> int:
    paid = sum(p.owner_cents for p in row.payments if p.status != "amounts_dont_match")
    return max(0, offer_total(row.pay_kind, row.pay_cents, row.days) - paid)
