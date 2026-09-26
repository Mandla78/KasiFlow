"""
The order book's allowed values and limits. The app has the same numbers
(frontend/mobile/.../order-book/lib/menus.ts and lib/orders.ts); the
server decides.
"""
from __future__ import annotations

#: What an item can be made of: the supplier engine reads these (what the
#: shop will need to restock), so they're options, never free text.
INGREDIENTS = (
    "quarter_loaf", "bun", "chips", "polony", "russian", "vienna", "cheese", "egg", "atchar", "lettuce",
    "beef_patty", "chicken", "wors", "pap", "stew", "chakalaka", "vetkoek", "mince", "cold_drink",
)  # fmt: skip

#: new -> preparing -> ready -> collected, one step at a time; cancelled
#: from anywhere before collected. Collected and cancelled are final.
STATUSES = ("new", "preparing", "ready", "collected", "cancelled")
NEXT_STATUS = {"new": "preparing", "preparing": "ready", "ready": "collected"}

#: The trader's own record of how they were paid: cash, their own card
#: machine or EFT, or later (the credit book). Never proof of payment.
PAYMENTS = ("cash", "digital", "later")

MAX_ITEMS = 40
ITEM_NAME_MAX = 40
#: R2,000 for one item: a family platter, with room; a slipped finger is caught.
MAX_PRICE_CENTS = 200_000

MAX_LINES = 20
MAX_QTY = 50
#: "Thabo's order": for the queue only. Never a phone number.
CUSTOMER_NAME_MAX = 30
#: "A3": this phone's letter and its own count for the day.
TEMP_NUMBER_PATTERN = r"^[A-D][1-9][0-9]{0,3}$"

#: When the phone says the order was taken: a phone clock may run a little
#: fast, and a phone may be offline for a while (a weekend without data).
FUTURE_MINUTES = 5
BACK_DAYS = 2
#: An item taken off the menu is still accepted this long, for orders
#: taken offline before the change.
HIDDEN_ITEM_DAYS = 2

#: "Today" is the trader's day, and every trader is in South Africa.
TIMEZONE = "Africa/Johannesburg"

#: Per trader (a lunch rush from two phones), not per IP.
ORDER_LIMIT = "120 per minute"
STEP_LIMIT = "240 per minute"
MENU_LIMIT = "30 per minute"
READ_LIMIT = "120 per minute"

#: The engine's categories (shared/constants/categories.py) each ingredient
#: needs. Every order also uses packaging.
INGREDIENT_CATEGORIES = {
    "quarter_loaf": ("bakery",),
    "bun": ("bakery",),
    "vetkoek": ("bakery",),
    "polony": ("meat_frozen",),
    "russian": ("meat_frozen",),
    "vienna": ("meat_frozen",),
    "wors": ("meat_frozen",),
    "mince": ("meat_frozen",),
    "chicken": ("meat_frozen",),
    "beef_patty": ("meat_frozen",),
    "stew": ("meat_frozen",),
    "chips": ("meat_frozen", "fresh_produce"),
    "cheese": ("dairy_chilled",),
    "egg": ("dairy_chilled",),
    "atchar": ("food_grocery",),
    "chakalaka": ("food_grocery",),
    "pap": ("food_grocery",),
    "lettuce": ("fresh_produce",),
    "cold_drink": ("beverages",),
}
PACKAGING = "packaging_disposable"
SIGNAL_DAYS = 7
