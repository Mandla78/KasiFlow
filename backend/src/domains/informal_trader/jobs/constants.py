"""
The jobs tool's allowed values and limits. The app has the same numbers
(frontend/mobile/.../jobs/lib/stages.ts); the server decides.
"""
from __future__ import annotations

#: One bin for the credit book and jobs: the same 30 days and the same list size.
from src.domains.informal_trader.credit_book.constants import BIN_DAYS, HISTORY_LIMIT  # noqa: F401

JOB_STATUSES = ("active", "done")
STAGE_STATUSES = ("not_started", "photo_taken", "waiting", "confirmed", "amounts_dont_match")
SIGN_OFF_OUTCOMES = ("confirmed", "amounts_dont_match", "not_yet")

#: R5,000,000: a whole house, with room; a slipped finger is caught.
MAX_JOB_CENTS = 500_000_000
MAX_STAGES = 12
TITLE_MAX = 60
CLIENT_NAME_MAX = 60
PLACE_MAX = 120
STAGE_NAME_MAX = 40
NOTE_MAX = 200

PHONE_PATTERN = r"^0[6-8]\d{8}$"

#: A sign-off link works once, for a week.
SIGN_OFF_DAYS = 7

#: Stage photos: what a phone may send, and what is stored.
PHOTO_PURPOSE = "job_photo"
PHOTO_MAX_BYTES = 8 * 1024 * 1024
PHOTO_STORED_MAX_PX = 1600
