"""
What the credit book routes accept. Unknown fields are rejected, text goes
through the shared cleaner (CleanText), money is whole cents, dates are ISO
days. Rules that need "today" or the entry itself (date ranges, not paying
more than is owed) are the service's job.
"""
from __future__ import annotations

from marshmallow import RAISE, Schema, ValidationError as MarshmallowError, fields, validate, validates_schema

from src.core.exceptions import ValidationError
from src.shared.validation.text import CleanText, clean_text

from ..constants import DESCRIPTION_MAX, MAX_AMOUNT_CENTS, NAME_MAX, PHONE_PATTERN, REASON_MAX


class Cents(fields.Integer):
    """Whole cents, 1..R100,000. Refuses strings, fractions and booleans
    (in Python, True is an int)."""

    def __init__(self, **kwargs):
        super().__init__(strict=True, validate=validate.Range(min=1, max=MAX_AMOUNT_CENTS, error="Enter an amount from R0.01 to R100,000."), **kwargs)

    def _deserialize(self, value, attr, data, **kwargs):
        if isinstance(value, bool):
            raise MarshmallowError("Enter the amount in cents, as a whole number.")
        return super()._deserialize(value, attr, data, **kwargs)


class CustomerName(fields.String):
    """Cleaned (no hidden or control characters), 1..60, with at least one
    letter. Nicknames are fine."""

    def _deserialize(self, value, attr, data, **kwargs):
        text = super()._deserialize(value, attr, data, **kwargs)
        try:
            text = clean_text(text, min_len=1, max_len=NAME_MAX)
        except ValueError as e:
            raise MarshmallowError(str(e)) from None
        if not any(ch.isalpha() for ch in text):
            raise MarshmallowError("Use at least one letter in the name.")
        return text


class Phone(fields.String):
    """A South African cellphone as people type it (082 123 4567,
    +27 82 123 4567) -> 0821234567. null = no phone."""

    def __init__(self, **kwargs):
        super().__init__(allow_none=True, validate=validate.Regexp(PHONE_PATTERN, error="A cellphone number, like 082 123 4567."), **kwargs)

    def _deserialize(self, value, attr, data, **kwargs):
        text = super()._deserialize(value, attr, data, **kwargs)
        digits = "".join(ch for ch in text if ch.isdigit())
        if len(digits) == 11 and digits.startswith("27"):
            digits = "0" + digits[2:]
        return digits


def _text(max_len: int):
    return CleanText(load_default="", max_len=max_len)


class _Strict(Schema):
    class Meta:
        unknown = RAISE


class NewCustomerSchema(_Strict):
    name = CustomerName(required=True)
    phone = Phone(load_default=None)


class NewEntrySchema(_Strict):
    #: An existing customer, or a new one (exactly one of the two).
    customer_id = fields.UUID(load_default=None)
    customer = fields.Nested(NewCustomerSchema, load_default=None)
    amount_cents = Cents(required=True)
    description = _text(DESCRIPTION_MAX)
    #: Copying the paper book: when the credit was given. Default today.
    given_on = fields.Date(load_default=None)
    due_on = fields.Date(required=True)

    @validates_schema
    def _one_customer(self, data, **_kwargs):
        if (data.get("customer_id") is None) == (data.get("customer") is None):
            raise MarshmallowError("Choose a customer or add a new one.", field_name="customer")


class PaymentSchema(_Strict):
    amount_cents = Cents(required=True)
    #: Default today.
    paid_on = fields.Date(load_default=None)


class CorrectionSchema(_Strict):
    amount_cents = Cents(required=True)
    due_on = fields.Date(required=True)
    description = _text(DESCRIPTION_MAX)
    reason = _text(REASON_MAX)


class CancelSchema(_Strict):
    reason = _text(REASON_MAX)


class CustomerPhoneSchema(_Strict):
    phone = Phone(required=True)


class ListQuerySchema(_Strict):
    status = fields.String(load_default=None, validate=validate.OneOf(("open", "paid", "all")))


class SearchQuerySchema(_Strict):
    q = CleanText(load_default="", max_len=NAME_MAX)


def load(schema: Schema, data) -> dict:
    """Validate a JSON body or query string; one 422 with every field's message."""
    try:
        return schema.load(data if isinstance(data, dict) else {})
    except MarshmallowError as e:
        raise ValidationError("Please check the highlighted fields.", errors=[e.messages]) from None
