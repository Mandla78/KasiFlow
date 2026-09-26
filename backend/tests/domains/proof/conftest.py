"""
The seal tests reuse the order book's test helpers
(tests/domains/informal_trader/order_book_helpers.py): make them importable
however the tests are run, alone or with the rest.
"""
import sys
from pathlib import Path

HELPERS = str(Path(__file__).resolve().parents[1] / "informal_trader")
if HELPERS not in sys.path:
    sys.path.insert(0, HELPERS)
