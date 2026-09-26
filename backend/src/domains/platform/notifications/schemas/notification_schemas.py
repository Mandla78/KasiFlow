"""
What the notification routes accept. Unknown fields are rejected (so
"security": false is a 422: security alerts can't be switched off), the
tab is one of two words, a page is 1..50, and switches are true or false
only.
"""
from __future__ import annotations

from marshmallow import RAISE, Schema, ValidationError as MarshmallowError, fields, validate

from src.core.exceptions import ValidationError

from ..constants import PAGE_DEFAULT, PAGE_MAX
from ..templates import TABS


class Flag(fields.Boolean):
    """true or false only: not "yes", not 1 (1 == True in Python)."""

    def _deserialize(self, value, attr, data, **kwargs):
        if not isinstance(value, bool):
            raise MarshmallowError("Send true or false.")
        return value


def _tab(**kwargs):
    return fields.String(validate=validate.OneOf(TABS, error="Pick orders or inbox."), **kwargs)


class _Strict(Schema):
    class Meta:
        unknown = RAISE


class ListQuerySchema(_Strict):
    tab = _tab(required=True)
    #: The last alert of the previous page.
    before = fields.UUID(load_default=None)
    limit = fields.Integer(load_default=PAGE_DEFAULT, validate=validate.Range(min=1, max=PAGE_MAX, error=f"1 to {PAGE_MAX} at a time."))


class ReadAllSchema(_Strict):
    tab = _tab(required=True)


class SettingsSchema(_Strict):
    orders = Flag(required=True)
    jobs = Flag(required=True)
    credit = Flag(required=True)


def load(schema: Schema, data) -> dict:
    """Validate a JSON body or query string; one 422 with every field's message."""
    try:
        return schema.load(data if isinstance(data, dict) else {})
    except MarshmallowError as e:
        raise ValidationError("Please check the highlighted fields.", errors=[e.messages]) from None
