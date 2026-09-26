"""
What the app may send for a delivery address. Unknown fields are refused;
the pin must be in South Africa; the label and address are cleaned text.
"""
from __future__ import annotations

from marshmallow import RAISE, Schema, fields, validate
from marshmallow.exceptions import ValidationError as MarshmallowError

from src.core.exceptions import ValidationError
from src.shared.validation.text import CleanText


class _Strict(Schema):
    class Meta:
        unknown = RAISE


class AddressSchema(_Strict):
    label = CleanText(required=True, min_len=1, max_len=30)
    address_text = CleanText(required=True, min_len=5, max_len=300)
    # Roughly South Africa (with a margin): a pin in the sea or abroad is a mistake.
    latitude = fields.Float(required=True, validate=validate.Range(min=-35.5, max=-21.5))
    longitude = fields.Float(required=True, validate=validate.Range(min=16.0, max=33.5))
    is_default = fields.Boolean(load_default=False)


class AddressPatchSchema(_Strict):
    label = CleanText(min_len=1, max_len=30)
    address_text = CleanText(min_len=5, max_len=300)
    latitude = fields.Float(validate=validate.Range(min=-35.5, max=-21.5))
    longitude = fields.Float(validate=validate.Range(min=16.0, max=33.5))


def _load(schema: Schema, data) -> dict:
    if not isinstance(data, dict):
        raise ValidationError("Send the address as a JSON object.")
    try:
        return schema.load(data)
    except MarshmallowError as e:
        raise ValidationError("Please check the highlighted fields.", errors=[e.messages]) from None


def load_new(data) -> dict:
    return _load(AddressSchema(), data)


def load_patch(data) -> dict:
    out = _load(AddressPatchSchema(), data)
    if not out:
        raise ValidationError("Nothing to change.")
    # A pin moves as a pair: half a pin would put the address somewhere else.
    if ("latitude" in out) != ("longitude" in out):
        raise ValidationError("Please check the highlighted fields.", errors=[{"latitude": ["Send the map pin's latitude and longitude together."]}])
    return out
