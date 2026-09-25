"""
The credit book's allowed values and limits. The app has the same numbers
(frontend/mobile/.../credit-book/lib/amounts.ts); the server decides.
"""
from __future__ import annotations

STATUSES = ("open", "paid", "cancelled")
CORRECTION_KINDS = ("correction", "cancellation")

#: R100,000: far above any spaza tab, low enough to catch a slipped finger.
MAX_AMOUNT_CENTS = 10_000_000

NAME_MAX = 60
DESCRIPTION_MAX = 120
REASON_MAX = 120

#: A pay-back date can be up to a year ahead.
MAX_DAYS_AHEAD = 366
#: Copying the paper book: credit given up to a year ago.
MAX_DAYS_BACK = 366

#: South African cellphone, stored as 10 digits: 06x, 07x, 08x.
PHONE_PATTERN = r"^0[6-8]\d{8}$"

#: "Today" is the trader's day, and every trader is in South Africa.
TIMEZONE = "Africa/Johannesburg"

#: Far more than a spaza book holds; paging if that ever changes.
LIST_LIMIT = 500
SEARCH_LIMIT = 50

#: What a deleted customer becomes: their amounts stay, the person doesn't.
DELETED_CUSTOMER_NAME = "Deleted customer"
