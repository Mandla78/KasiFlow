"""
What the order book routes accept. Unknown fields are rejected, text goes
through the shared cleaner, money and quantities are whole numbers, times
must say their time zone. Rules that need the trader's menu or "now" (items
on the menu, how long ago an order was taken) are the services' job.
"""
from __future__ import annotations

import re

from marshmallow import RAISE, Schema, ValidationError as MarshmallowError, fields, validate, validates_schema

from src.core.exceptions import ValidationError
from src.shared.validation.text import clean_text

from ..constants import (
    CUSTOMER_NAME_MAX,
    INGREDIENTS,
    ITEM_NAME_MAX,
    MAX_ITEMS,
    MAX_LINES,
    MAX_PRICE_CENTS,
    MAX_QTY,
    PAYMENTS,
    TEMP_NUMBER_PATTERN,
)


class Whole(fields.Integer):
    """A whole number. Refuses strings, fractions and booleans (in Python,
    True is an int)."""

    def __init__(self, *, low: int, high: int, error: str, **kwargs):
        super().__init__(strict=True, validate=validate.Range(min=low, max=high, error=error), **kwargs)
        self._error = error

    def _deserialize(self, value, attr, data, **kwargs):
        if isinstance(value, bool):
            raise MarshmallowError(self._error)
        return super()._deserialize(value, attr, data, **kwargs)


class Named(fields.String):
    """Cleaned text, 1..max_len, with at least one letter."""

    def __init__(self, *, max_len: int, **kwargs):
        super().__init__(**kwargs)
        self._max_len = max_len

    def _deserialize(self, value, attr, data, **kwargs):
        text = super()._deserialize(value, attr, data, **kwargs)
        try:
            text = clean_text(text, min_len=1, max_len=self._max_len)
        except ValueError as e:
            raise MarshmallowError(str(e)) from None
        self._check(text)
        return text

    def _check(self, text: str) -> None:
        if not any(ch.isalpha() for ch in text):
            raise MarshmallowError("Use at least one letter.")


class CustomerName(Named):
    """A first name for the queue ("Thabo"). Never a phone number."""

    def _check(self, text: str) -> None:
        if sum(ch.isdigit() for ch in text) >= 5:
            raise MarshmallowError("Use a first name, not a number.")
        super()._check(text)


def _key(name: str) -> str:
    """The same name for "Cold drink", "cold  drink" and "COLD DRINK"."""
    return re.sub(r"\s+", " ", name).strip().casefold()


class _Strict(Schema):
    class Meta:
        unknown = RAISE


class MenuItemSchema(_Strict):
    #: An item already on the menu; none for a new one.
    id = fields.UUID(load_default=None)
    name = Named(required=True, max_len=ITEM_NAME_MAX)
    price_cents = Whole(required=True, low=1, high=MAX_PRICE_CENTS, error="Give it a price from R0.01 to R2,000.")
    ingredients = fields.List(
        fields.String(validate=validate.OneOf(INGREDIENTS, error="Pick from the list.")),
        load_default=list,
        validate=validate.Length(max=len(INGREDIENTS)),
    )


class MenuSchema(_Strict):
    items = fields.List(fields.Nested(MenuItemSchema), required=True, validate=validate.Length(max=MAX_ITEMS, error=f"Up to {MAX_ITEMS} items."))

    @validates_schema
    def _each_once(self, data, **_kwargs):
        names: set[str] = set()
        ids = set()
        for item in data.get("items", []):
            if _key(item["name"]) in names:
                raise MarshmallowError(f'"{item["name"]}" is on the menu twice.', field_name="items")
            names.add(_key(item["name"]))
            if item["id"] is not None:
                if item["id"] in ids:
                    raise MarshmallowError("An item is on the menu twice.", field_name="items")
                ids.add(item["id"])


class LineSchema(_Strict):
    item_id = fields.UUID(required=True)
    qty = Whole(required=True, low=1, high=MAX_QTY, error=f"1 to {MAX_QTY} of each item.")


class NewOrderSchema(_Strict):
    #: The phone's key for the order (a UUID): the same on every retry.
    id = fields.UUID(required=True)
    day = fields.Date(required=True)
    temp_number = fields.String(required=True, validate=validate.Regexp(TEMP_NUMBER_PATTERN, error="A phone letter and a number, like A3."))
    lines = fields.List(fields.Nested(LineSchema), required=True, validate=validate.Length(min=1, max=MAX_LINES, error=f"Add 1 to {MAX_LINES} things to the order."))
    payment = fields.String(required=True, validate=validate.OneOf(PAYMENTS, error="Pick how they paid."))
    customer_name = CustomerName(load_default=None, allow_none=True, max_len=CUSTOMER_NAME_MAX)
    #: When the phone took the order (with its time zone).
    created_at = fields.AwareDateTime(required=True)


class StepSchema(_Strict):
    status = fields.String(required=True, validate=validate.OneOf(("preparing", "ready", "collected", "cancelled"), error="Pick the next step."))
    #: When the phone made the step (with its time zone).
    at = fields.AwareDateTime(required=True)


class DayQuerySchema(_Strict):
    day = fields.Date(required=True)


class WeekQuerySchema(_Strict):
    end = fields.Date(required=True)


def _first(messages) -> str:
    """The first message in marshmallow's nested errors."""
    if isinstance(messages, str):
        return messages
    values = messages.values() if isinstance(messages, dict) else messages
    for m in values:
        found = _first(m)
        if found:
            return found
    return ""


def load(schema: Schema, data) -> dict:
    """Validate a JSON body or query string: one 422 with every field's
    message, and the first one on top (an order refused while the phone was
    offline is dropped with this reason on screen)."""
    try:
        return schema.load(data if isinstance(data, dict) else {})
    except MarshmallowError as e:
        raise ValidationError(_first(e.messages) or "Please check the highlighted fields.", errors=[e.messages]) from None
