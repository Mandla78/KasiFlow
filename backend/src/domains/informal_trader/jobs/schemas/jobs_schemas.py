"""
What the jobs routes and the sign-off page accept. Unknown fields are
rejected, text goes through the shared cleaner, money is whole cents.
The rule that a job's stages add up to its total is checked here too, so
a job can never be stored half-right.
"""
from __future__ import annotations

from marshmallow import RAISE, Schema, ValidationError as MarshmallowError, fields, validate, validates_schema

from src.core.exceptions import ValidationError
from src.domains.informal_trader.credit_book.schemas.credit_book_schemas import Phone
from src.shared.validation.text import CleanText, clean_text

from ..constants import CLIENT_NAME_MAX, MAX_JOB_CENTS, MAX_STAGES, NOTE_MAX, PLACE_MAX, STAGE_NAME_MAX, TITLE_MAX


class JobCents(fields.Integer):
    """Whole cents, min..R5,000,000. Refuses strings, fractions and
    booleans (in Python, True is an int)."""

    def __init__(self, min_cents: int = 1, **kwargs):
        super().__init__(strict=True, validate=validate.Range(min=min_cents, max=MAX_JOB_CENTS, error="Enter an amount up to R5,000,000."), **kwargs)

    def _deserialize(self, value, attr, data, **kwargs):
        if isinstance(value, bool):
            raise MarshmallowError("Enter the amount in cents, as a whole number.")
        return super()._deserialize(value, attr, data, **kwargs)


class Named(fields.String):
    """Cleaned text with at least one letter (a job, a client, a stage)."""

    def __init__(self, max_len: int, **kwargs):
        super().__init__(**kwargs)
        self._max_len = max_len

    def _deserialize(self, value, attr, data, **kwargs):
        text = super()._deserialize(value, attr, data, **kwargs)
        try:
            text = clean_text(text, min_len=1, max_len=self._max_len)
        except ValueError as e:
            raise MarshmallowError(str(e)) from None
        if not any(ch.isalpha() for ch in text):
            raise MarshmallowError("Use at least one letter.")
        return text


class _Strict(Schema):
    class Meta:
        unknown = RAISE


class NewStageSchema(_Strict):
    name = Named(STAGE_NAME_MAX, required=True)
    amount_cents = JobCents(required=True)


class NewJobSchema(_Strict):
    title = Named(TITLE_MAX, required=True)
    client_name = Named(CLIENT_NAME_MAX, required=True)
    client_phone = Phone(required=True)
    place = CleanText(load_default="", max_len=PLACE_MAX)
    total_cents = JobCents(required=True)
    stages = fields.List(fields.Nested(NewStageSchema), required=True, validate=validate.Length(min=1, max=MAX_STAGES, error=f"Add 1 to {MAX_STAGES} stages."))

    @validates_schema
    def _adds_up(self, data, **_kwargs):
        if data.get("client_phone") is None:
            raise MarshmallowError("A cellphone number, like 082 123 4567.", field_name="client_phone")
        if sum(s["amount_cents"] for s in data.get("stages", [])) != data.get("total_cents"):
            raise MarshmallowError("The stages must add up to the total.", field_name="stages")


class PhotoSchema(_Strict):
    public_id = fields.String(required=True, validate=validate.Length(min=10, max=500))


class SignOffSchema(_Strict):
    #: The cash the builder says they received for this stage (0 if none yet).
    builder_amount_cents = JobCents(min_cents=0, required=True)


class ClientAnswerSchema(_Strict):
    """The client's answer on the public page (a form post)."""

    ticket = fields.String(required=True, validate=validate.Length(min=20, max=100))
    answer = fields.String(required=True, validate=validate.OneOf(("done", "not_yet")))
    #: Rand as typed on the page ("12000", "12 000", "12000.50"); empty = R0.
    amount = fields.String(load_default="", validate=validate.Length(max=20))
    note = CleanText(load_default="", max_len=NOTE_MAX)


class HistoryQuerySchema(_Strict):
    #: A job's title or a client's name, or part of one.
    q = CleanText(load_default="", max_len=TITLE_MAX)


def load(schema: Schema, data) -> dict:
    """Validate a JSON body; one 422 with every field's message."""
    try:
        return schema.load(data if isinstance(data, dict) else {})
    except MarshmallowError as e:
        raise ValidationError("Please check the highlighted fields.", errors=[e.messages]) from None
