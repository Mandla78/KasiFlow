"""
The allowed values for a business profile. They MUST match the app's
frontend/mobile/src/constants (businessTypes.ts, categories.ts) and the
option lists on the onboarding screens: the server rejects anything else.
"""
from __future__ import annotations

BUSINESS_TYPES = ("builder", "spaza", "other")
TRADES = ("general_builder", "plumber", "electrician", "carpenter", "painter_tiler", "other_trade")
YEARS_TRADING = ("under_1", "1_3", "3_plus")

CATEGORIES = (
    "food_grocery", "beverages", "snacks_confectionery", "bakery", "dairy_chilled", "fresh_produce",
    "meat_frozen", "household_cleaning", "personal_care", "baby_family", "packaging_disposable",
    "airtime_electricity", "stationery_school", "clothing_apparel", "fragrances_beauty", "phone_accessories",
    "building_materials", "plumbing", "electrical", "tools_hardware", "paint_finishes", "other",
)

RESTOCK = ("daily", "weekly", "fortnightly", "monthly")
SPEND = ("under_1k", "1k_5k", "5k_20k", "over_20k")
PAYMENT = ("payfast", "cash", "both")
FULFILMENT = ("delivery", "collect", "either")

TOOLS = ("creditBook", "orderStock", "myRecord", "jobs")
#: "My record" is the proof everything else writes to: it can't be switched off.
ALWAYS_ON_TOOLS = ("myRecord",)

CIPC_STATUSES = ("pending", "verified", "owner_unconfirmed", "deregistered", "not_found", "unavailable")
CIPC_NUMBER_PATTERN = r"^\d{4}/\d{6}/\d{2}$"
