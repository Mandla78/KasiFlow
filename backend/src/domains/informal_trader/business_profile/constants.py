"""
The allowed values for a business profile. They MUST match the app's
frontend/mobile/src/constants (businessTypes.ts, categories.ts) and the
option lists on the onboarding screens: the server rejects anything else.
"""
from __future__ import annotations

BUSINESS_TYPES = ("builder", "spaza", "food", "other")
#: The 11 trades (QUESTION_trades.txt, approved). painter_tiler became painter
#: and tiler in migration 0022_trades.
TRADES = (
    "general_builder", "bricklayer", "plumber", "electrician", "carpenter", "roofer",
    "tiler", "painter", "welder", "glazier", "other_trade",
)  # fmt: skip
YEARS_TRADING = ("under_1", "1_3", "3_plus")

#: One list for the whole backend (the supplier side sells from the same codes).
from src.shared.constants.categories import CATEGORIES  # noqa: E402,F401

RESTOCK = ("daily", "weekly", "fortnightly", "monthly")
SPEND = ("under_1k", "1k_5k", "5k_20k", "over_20k")
PAYMENT = ("payfast", "cash", "both")
FULFILMENT = ("delivery", "collect", "either")

TOOLS = ("creditBook", "orderStock", "myRecord", "jobs", "orderBook")
#: "My record" is the proof everything else writes to: it can't be switched off.
ALWAYS_ON_TOOLS = ("myRecord",)

CIPC_STATUSES = ("pending", "verified", "owner_unconfirmed", "deregistered", "not_found", "unavailable")
CIPC_NUMBER_PATTERN = r"^\d{4}/\d{6}/\d{2}$"
