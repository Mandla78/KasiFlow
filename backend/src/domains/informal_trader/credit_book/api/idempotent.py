"""
"A retried request lands exactly once" for the credit book's writes.
The implementation moved to src/shared/idempotency/http.py (orders use it
too); this name stays so the credit book's routes don't change.
"""
from src.shared.idempotency.http import HEADER, run_once  # noqa: F401
