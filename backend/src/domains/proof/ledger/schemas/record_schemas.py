"""
What My record's route accepts: one query field, month, strictly YYYY-MM
with a real month (2026-9, 2026-13, ../ and lists are refused). Whether
the month may be shown (not in the future, not before the account) is the
service's job. Unknown fields are refused.
"""
from __future__ import annotations

from marshmallow import RAISE, Schema, ValidationError as MarshmallowError, fields, validate

from src.core.exceptions import ValidationError


class RecordQuerySchema(Schema):
    class Meta:
        unknown = RAISE

    month = fields.String(
        load_default=None,
        validate=validate.Regexp(r"^[0-9]{4}-(0[1-9]|1[0-2])$", error="Pick a month like 2026-09."),
    )


def load(schema: Schema, data) -> dict:
    """Validate a query string; one 422 with the field's message on top."""
    try:
        return schema.load(data if isinstance(data, dict) else {})
    except MarshmallowError as e:
        first = next(iter(e.messages.get("month", [])), None) if isinstance(e.messages, dict) else None
        raise ValidationError(first or "Please check the highlighted fields.", errors=[e.messages]) from None
