"""
What PATCH /me/business-profile accepts. Each section is optional; a
section that is sent replaces that section whole (so the app sends one
screen's answers at a time). Unknown fields are rejected, every choice is
checked against constants.py, and the CIPC STATUS is never accepted: only
the number. The server decides the rest.
"""
from __future__ import annotations

from marshmallow import RAISE, Schema, ValidationError as MarshmallowError, fields, pre_load, validate, validates_schema

from src.core.exceptions import ValidationError

from ..constants import (
    BUSINESS_TYPES,
    CATEGORIES,
    CIPC_NUMBER_PATTERN,
    FULFILMENT,
    PAYMENT,
    RESTOCK,
    SPEND,
    TOOLS,
    TRADES,
    YEARS_TRADING,
)


def _choice(values, required=False):
    return fields.String(required=required, load_default=None, allow_none=not required, validate=validate.OneOf(values))


def _text(max_len, required=False):
    return fields.String(required=required, load_default="", validate=validate.Length(max=max_len))


class _Strict(Schema):
    class Meta:
        unknown = RAISE


class BusinessSection(_Strict):
    business_type = _choice(BUSINESS_TYPES)
    trade = _choice(TRADES)
    owner_name = fields.String(load_default=None, allow_none=True, validate=validate.Length(min=2, max=80))
    years_trading = _choice(YEARS_TRADING)
    #: South African cellphone, 10 digits starting with 0. Optional.
    cellphone = fields.String(load_default=None, allow_none=True, validate=validate.Regexp(r"^0\d{9}$", error="A 10-digit number, like 0821234567."))

    @pre_load
    def _digits_only(self, data, **_kwargs):
        if isinstance(data, dict) and isinstance(data.get("cellphone"), str):
            digits = "".join(ch for ch in data["cellphone"] if ch.isdigit())
            data = {**data, "cellphone": digits or None}
        return data

    @validates_schema
    def _trade_only_for_builders(self, data, **_kwargs):
        if data.get("trade") and data.get("business_type") != "builder":
            raise MarshmallowError("Only builders choose a trade.", field_name="trade")


class RegistrationSection(_Strict):
    sole_trader = fields.Boolean(required=True)
    cipc_number = fields.String(load_default=None, allow_none=True, validate=validate.Regexp(CIPC_NUMBER_PATTERN, error="Use the format 2020/123456/07."))

    @validates_schema
    def _one_setup(self, data, **_kwargs):
        if data.get("sole_trader") and data.get("cipc_number"):
            raise MarshmallowError("A sole trader has no CIPC number.", field_name="cipc_number")


class LocationSection(_Strict):
    building = _text(120)
    street = _text(160)
    suburb = _text(120)
    city = _text(120)
    province = _text(60)
    postal_code = fields.String(load_default="", validate=validate.Regexp(r"^(\d{4})?$", error="A 4-digit postal code."))
    # Roughly South Africa (with a margin): a pin in the sea or abroad is a mistake.
    latitude = fields.Float(required=True, validate=validate.Range(min=-35.5, max=-21.5))
    longitude = fields.Float(required=True, validate=validate.Range(min=16.0, max=33.5))


class BuyingSection(_Strict):
    categories = fields.List(fields.String(validate=validate.OneOf(CATEGORIES)), required=True, validate=validate.Length(max=len(CATEGORIES)))
    restock = _choice(RESTOCK)
    spend = _choice(SPEND)
    payment = _choice(PAYMENT)
    fulfilment = _choice(FULFILMENT)


class ProfilePatchSchema(_Strict):
    business = fields.Nested(BusinessSection, load_default=None)
    registration = fields.Nested(RegistrationSection, load_default=None)
    #: null clears the location.
    location = fields.Nested(LocationSection, load_default=None, allow_none=True)
    buying = fields.Nested(BuyingSection, load_default=None)
    tools = fields.Dict(keys=fields.String(validate=validate.OneOf(TOOLS)), values=fields.Boolean(), load_default=None)


def load_patch(data) -> dict:
    """Validate the body; return only the sections that were actually sent."""
    body = data if isinstance(data, dict) else {}
    try:
        loaded = ProfilePatchSchema().load(body)
    except MarshmallowError as e:
        raise ValidationError("Please check the highlighted fields.", errors=[e.messages]) from None
    return {k: v for k, v in loaded.items() if k in body}
