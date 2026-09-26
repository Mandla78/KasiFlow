"""
My record (docs/plan_v2_integrations/03_ACCOUNT_AND_MY_RECORD.txt, DECISION:
in proof/ledger, stock bought by order date). One month of the trader's
money, in three blocks that are NEVER added together:

  orders        by what backs the payment: provider-verified (paid in the
                app), cash confirmed by both, cash not confirmed
  credit_book   credit given, paid back           (their own record)
  jobs          stages confirmed, amounts that don't match (their own record)

Read-only. Every number comes from the owning tool's SERVICE (never its
repositories), for the signed-in trader only. A tool the trader switched
off answers null. There is no grand total field anywhere, on purpose:
only a payment the provider verified is proof; the rest is the trader's
own record (CLAUDE.md, "honest proof").

  summary(user, month)   month "YYYY-MM" or None (this month, SAST)
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from src.core.exceptions import ValidationError
from src.domains.commerce.orders.services import order_service
from src.domains.informal_trader.business_profile.services import business_profile_service
from src.domains.informal_trader.credit_book.services import credit_book_service
from src.domains.informal_trader.jobs.services import jobs_service

SA = ZoneInfo("Africa/Johannesburg")


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _next(first: date) -> date:
    return date(first.year + (first.month == 12), first.month % 12 + 1, 1)


def _label(first: date) -> str:
    return f"{first.year:04d}-{first.month:02d}"


def _invalid(message: str) -> ValidationError:
    return ValidationError(message, errors=[{"month": [message]}])


def months_open(user) -> tuple[date, date]:
    """(first, last): the month the account was made, and this month (SAST)."""
    this = _month_start(datetime.now(SA).date())
    created = user.created_at.astimezone(SA).date() if user.created_at else this
    return min(_month_start(created), this), this


def summary(user, month: Optional[str]) -> dict:
    first_open, last_open = months_open(user)
    # Compared as numbers first: "0000-01" is a well-formed month no date can hold.
    asked = (last_open.year, last_open.month) if month is None else (int(month[:4]), int(month[5:7]))
    if asked > (last_open.year, last_open.month):
        raise _invalid("That month hasn't happened yet.")
    if asked < (first_open.year, first_open.month):
        raise _invalid("That's before you joined.")
    first = date(*asked, 1)
    end = _next(first)
    start_at = datetime(first.year, first.month, 1, tzinfo=SA)
    end_at = datetime(end.year, end.month, 1, tzinfo=SA)

    profile = business_profile_service.get(user)
    tools = (profile.tools or {}) if profile else {}
    return {
        "month": _label(first),
        "first_month": _label(first_open),
        "orders": order_service.money_summary_for(user, start_at, end_at),
        "credit_book": credit_book_service.money_for_month(user, first, end) if tools.get("creditBook") else None,
        "jobs": jobs_service.money_for_month(user, start_at, end_at) if tools.get("jobs") else None,
    }
