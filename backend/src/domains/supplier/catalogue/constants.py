"""Allowed values for products."""
from __future__ import annotations

#: How a product is sold. A supplier's feed must use one of these.
UNITS = (
    "each", "pack", "case", "bag", "box", "bottle", "tin", "tray", "crate", "bundle",
    "roll", "sheet", "length", "cube", "pallet", "kg", "litre", "metre",
)

#: At or below this many left, traders see "Only a few left" (never the number).
LOW_STOCK_AT = 10

#: The most of one product in one order line.
MAX_QTY_LIMIT = 1000

#: South African VAT on goods: standard-rated (15%) or zero-rated (basic
#: foods listed in the VAT Act, Schedule 2 Part B). The percentage lives
#: in one place so a rate change is one line.
VAT_RATES = ("standard", "zero")
VAT_PERCENT = {"standard": 15, "zero": 0}
