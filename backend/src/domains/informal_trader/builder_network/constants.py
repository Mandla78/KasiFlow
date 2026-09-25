"""
The builder network's allowed values and limits. The app has the same
numbers (frontend/mobile/.../jobs/network/lib/limits.ts, pay.ts,
trades.ts); the server decides.
"""
from __future__ import annotations

#: The network's own trades list (feedback/QUESTION_trades.txt). The
#: sign-up list stays as it is until that question is answered.
TRADES = (
    "general_builder",
    "bricklayer",
    "plumber",
    "electrician",
    "carpenter",
    "roofer",
    "tiler",
    "painter",
    "welder",
    "glazier",
    "other_trade",
)
TRADE_LABELS = {
    "general_builder": "General builder",
    "bricklayer": "Bricklayer",
    "plumber": "Plumber",
    "electrician": "Electrician",
    "carpenter": "Carpenter",
    "roofer": "Roofer",
    "tiler": "Tiler",
    "painter": "Painter",
    "welder": "Welder",
    "glazier": "Glazier",
    "other_trade": "Other trade",
}
#: Trades that finish each other's work on one house (symmetric).
WORKS_WITH = {
    "general_builder": ("bricklayer", "plumber", "electrician", "carpenter", "roofer", "tiler", "painter", "welder", "glazier"),
    "bricklayer": ("general_builder", "plumber", "electrician", "carpenter", "roofer"),
    "plumber": ("general_builder", "bricklayer", "electrician", "tiler"),
    "electrician": ("general_builder", "bricklayer", "plumber", "carpenter"),
    "carpenter": ("general_builder", "bricklayer", "electrician", "roofer", "painter", "glazier"),
    "roofer": ("general_builder", "bricklayer", "carpenter", "welder"),
    "tiler": ("general_builder", "plumber", "painter"),
    "painter": ("general_builder", "carpenter", "tiler", "glazier"),
    "welder": ("general_builder", "roofer", "glazier"),
    "glazier": ("general_builder", "carpenter", "painter", "welder"),
    "other_trade": (),
}
#: The sign-up trade (business profile) as network trades.
FROM_SIGN_UP = {"painter_tiler": ("painter", "tiler")}

MAX_TRADES = 3
TRAVEL_CHOICES = (5, 10, 20, 40)
DEFAULT_TRAVEL_KM = 20
ABOUT_MAX = 80
SUBURB_MAX = 40
NOTE_MAX = 200
REPORT_REASONS = ("fake", "not_their_work", "scam", "rude", "other")

PAY_KINDS = ("fixed", "per_day")
PAID_WHEN = ("stage_confirmed", "daily", "end")
#: R200,000 for one partner's work, R10,000 a day.
MAX_OFFER_CENTS = 20_000_000
MAX_DAY_RATE_CENTS = 1_000_000
MAX_DAYS = 60
START_WITHIN_DAYS = 60
MAX_STAGES = 12

PARTNER_STATUSES = ("invited", "accepted", "declined")
PAYMENT_STATUSES = ("waiting", "confirmed", "amounts_dont_match")
POST_STATUSES = ("open", "filled", "closed")

POST_DAYS = 7
MAX_PARTNERS_PER_JOB = 5
MAX_OPEN_POSTS = 5
INVITES_PER_DAY = 30
INTERESTED_PER_DAY = 20
NEARBY_LIMIT = 20
NEW_BUILDER_DAYS = 30
ACTIVE_DAYS = 30

#: Initials circles, picked by the builder's id (same colour every time).
COLORS = ("#0E7490", "#7C3AED", "#B45309", "#047857", "#1D4ED8", "#334155", "#BE185D", "#9333EA", "#0F766E", "#A16207", "#C2410C")
