"""
What the builder network routes accept. Unknown fields are rejected, text
goes through the shared cleaner, money is whole cents, booleans are real
booleans (never "yes" or 1).
"""
from __future__ import annotations

from marshmallow import RAISE, Schema, ValidationError as MarshmallowError, fields, validate, validates_schema

from src.core.exceptions import ValidationError
from src.shared.validation.text import CleanText, clean_text

from ..constants import (
    ABOUT_MAX,
    MAX_DAYS,
    MAX_OFFER_CENTS,
    MAX_STAGES,
    MAX_TRADES,
    NOTE_MAX,
    PAID_WHEN,
    PAY_KINDS,
    REPORT_REASONS,
    SUBURB_MAX,
    TRADES,
    TRAVEL_CHOICES,
)


class WholeNumber(fields.Integer):
    """A whole number in range; refuses strings, fractions and booleans (True is an int in Python)."""

    def __init__(self, low: int, high: int, message: str, **kwargs):
        super().__init__(strict=True, validate=validate.Range(min=low, max=high, error=message), **kwargs)

    def _deserialize(self, value, attr, data, **kwargs):
        if isinstance(value, bool):
            raise MarshmallowError("Send a whole number.")
        return super()._deserialize(value, attr, data, **kwargs)


class Flag(fields.Boolean):
    """true or false only: not "yes", not 1 (1 == True in Python, so a set check isn't enough)."""

    def _deserialize(self, value, attr, data, **kwargs):
        if not isinstance(value, bool):
            raise MarshmallowError("Send true or false.")
        return value


class Suburb(fields.String):
    """A suburb: cleaned text with letters (never a street number on its own)."""

    def _deserialize(self, value, attr, data, **kwargs):
        text = super()._deserialize(value, attr, data, **kwargs)
        try:
            text = clean_text(text, min_len=2, max_len=SUBURB_MAX)
        except ValueError as e:
            raise MarshmallowError(str(e)) from None
        if not any(ch.isalpha() for ch in text):
            raise MarshmallowError("Use the suburb's name.")
        return text


class _Strict(Schema):
    class Meta:
        unknown = RAISE


def _trade(**kw):
    return fields.String(validate=validate.OneOf(TRADES, error="Pick a trade from the list."), **kw)


class ProfileSchema(_Strict):
    trades = fields.List(_trade(), required=True, validate=validate.Length(min=1, max=MAX_TRADES, error=f"Pick 1 to {MAX_TRADES} trades."))
    about = CleanText(load_default="", max_len=ABOUT_MAX)
    travel_km = fields.Integer(strict=True, required=True, validate=validate.OneOf(TRAVEL_CHOICES, error="Pick how far you travel."))
    visible = Flag(required=True)
    shown_job_ids = fields.List(fields.UUID(), load_default=list, validate=validate.Length(max=500))


class OfferSchema(_Strict):
    kind = fields.String(required=True, validate=validate.OneOf(PAY_KINDS, error="Pick one amount or per day."))
    amount_cents = WholeNumber(1, MAX_OFFER_CENTS, "Type the pay.", required=True)
    days = WholeNumber(1, MAX_DAYS, f"1 to {MAX_DAYS} days.", required=True)
    paid_when = fields.String(required=True, validate=validate.OneOf(PAID_WHEN, error="Pick when it's paid."))


class _Deal(_Strict):
    stage_ids = fields.List(fields.UUID(), required=True, validate=validate.Length(min=1, max=MAX_STAGES, error="Pick at least one stage."))
    trade = _trade(required=True)
    starts_on = fields.Date(required=True)
    offer = fields.Nested(OfferSchema, required=True)


class InviteSchema(_Deal):
    builder_id = fields.UUID(required=True)


class HelpPostSchema(_Deal):
    suburb = Suburb(required=True)


class PaidSchema(_Strict):
    amount_cents = WholeNumber(1, MAX_OFFER_CENTS, "Type the cash you paid.", required=True)


class GotSchema(_Strict):
    amount_cents = WholeNumber(0, MAX_OFFER_CENTS, "Type the cash you got.", required=True)


class AnswerSchema(_Strict):
    accept = Flag(required=True)


class ReportSchema(_Strict):
    reason = fields.String(required=True, validate=validate.OneOf(REPORT_REASONS, error="Pick a reason."))
    note = CleanText(load_default="", max_len=NOTE_MAX)

    @validates_schema
    def _other_needs_a_note(self, data, **_kwargs):
        if data.get("reason") == "other" and not data.get("note", "").strip():
            raise MarshmallowError("Say what happened.", field_name="note")


class PickSchema(_Strict):
    builder_id = fields.UUID(required=True)


def load(schema: Schema, data) -> dict:
    """Validate a JSON body; one 422, with the first specific message on top (the app shows it)."""
    try:
        return schema.load(data if isinstance(data, dict) else {})
    except MarshmallowError as e:
        raise ValidationError(_first_message(e.messages), errors=[e.messages]) from None


def _first_message(messages) -> str:
    while isinstance(messages, dict) and messages:
        messages = next(iter(messages.values()))
    while isinstance(messages, list) and messages:
        messages = messages[0]
        if isinstance(messages, dict):
            return _first_message(messages)
    return messages if isinstance(messages, str) else "Please check the highlighted fields."
