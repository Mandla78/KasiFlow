"""
What the app may send when placing an order. Products and quantities ONLY:
every price, fee and total is worked out on the server from the catalogue.
"""
from __future__ import annotations

from marshmallow import RAISE, Schema, ValidationError, fields, validate, validates_schema
from marshmallow.exceptions import MarshmallowError

from src.core.exceptions import ValidationError as AppValidationError
from src.shared.validation.text import CleanText

from ..constants import FULFILMENTS, MAX_LINES, PAYMENT_METHODS


class _Strict(Schema):
    class Meta:
        unknown = RAISE


class LineSchema(_Strict):
    product_id = fields.UUID(required=True)
    qty = fields.Integer(required=True, validate=validate.Range(1, 1000))


class PointSchema(_Strict):
    # South Africa's bounding box.
    latitude = fields.Float(required=True, validate=validate.Range(-35.0, -22.0))
    longitude = fields.Float(required=True, validate=validate.Range(16.0, 33.0))


class PlaceOrderSchema(_Strict):
    supplier_id = fields.UUID(required=True)
    lines = fields.List(fields.Nested(LineSchema), required=True, validate=validate.Length(min=1, max=MAX_LINES))
    fulfilment = fields.String(required=True, validate=validate.OneOf(FULFILMENTS))
    payment = fields.String(required=True, validate=validate.OneOf(PAYMENT_METHODS))
    #: Delivery only. Leave both out to deliver to the trader's own business address.
    delivery_address = CleanText(min_len=5, max_len=300, load_default=None, allow_none=True)
    delivery_point = fields.Nested(PointSchema, load_default=None, allow_none=True)
    #: Or one of the trader's saved delivery places (More -> Delivery addresses).
    delivery_address_id = fields.UUID(load_default=None, allow_none=True)

    @validates_schema
    def _consistent(self, data, **kwargs):
        ids = [str(l["product_id"]) for l in data.get("lines", [])]
        if len(set(ids)) != len(ids):
            raise ValidationError("A product is listed twice; send one line per product.", "lines")
        if data.get("fulfilment") == "collect" and (data.get("delivery_address") or data.get("delivery_point") or data.get("delivery_address_id")):
            raise ValidationError("A collection has no delivery address.", "delivery_address")
        if bool(data.get("delivery_address")) != bool(data.get("delivery_point")):
            raise ValidationError("Send the delivery address and its map pin together.", "delivery_point")
        if data.get("delivery_address_id") and data.get("delivery_address"):
            raise ValidationError("Choose a saved address or type one, not both.", "delivery_address_id")


def load_place(data) -> dict:
    try:
        return PlaceOrderSchema().load(data if isinstance(data, dict) else {})
    except MarshmallowError as e:
        raise AppValidationError("Please check the highlighted fields.", errors=[e.messages]) from None
