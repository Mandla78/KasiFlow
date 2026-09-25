"""
What a supplier's feed may contain, checked strictly. The same shapes come
from a supplier's own system (ERP / POS) and from our seed files
(docs/supplier/03), so both go through exactly these checks.

supplier.json -> SupplierFeedSchema (marshmallow; unknown keys refused).
    The feed can NOT mark a supplier verified: that's our decision, made
    when the business is checked (feed_loader's `verified` argument).

products.csv -> parse_product_row(), one row at a time, so every bad row
    gets its own row number and reason instead of the whole file failing.
    Text cells that start with = + - @ are refused: opened in a
    spreadsheet later, they would run as formulas (CSV injection).
"""
from __future__ import annotations

import re
from decimal import Decimal
from typing import Any, Optional

from marshmallow import RAISE, Schema, ValidationError, fields, validate, validates_schema

from src.shared.constants.categories import CATEGORIES
from src.shared.validation.identifiers import normalize_email, normalize_phone
from src.shared.validation.text import BusinessName, CleanText, clean_text
from src.shared.validation.validators import is_plausible_email

from ...catalogue.constants import MAX_QTY_LIMIT, UNITS, VAT_RATES
from ...supplier_profile.constants import DAY_GROUPS

PROVINCES = (
    "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
    "Mpumalanga", "Northern Cape", "North West", "Western Cape",
)
_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
MAX_MONEY_CENTS = 100_000_000  # R1,000,000: far above any real order line or fee


class _Strict(Schema):
    class Meta:
        unknown = RAISE


class AddressSchema(_Strict):
    street = CleanText(min_len=3, max_len=160, required=True)
    suburb = CleanText(max_len=120, load_default=None, allow_none=True)
    city = CleanText(min_len=2, max_len=120, required=True)
    province = fields.String(required=True, validate=validate.OneOf(PROVINCES))
    postal_code = fields.String(load_default=None, allow_none=True, validate=validate.Regexp(r"^\d{4}$"))
    # South Africa's bounding box: a pin outside it is a typo, not a supplier.
    latitude = fields.Float(required=True, validate=validate.Range(-35.0, -22.0))
    longitude = fields.Float(required=True, validate=validate.Range(16.0, 33.0))


class HoursSchema(_Strict):
    days = fields.String(required=True, validate=validate.OneOf(DAY_GROUPS))
    open = fields.String(required=True, validate=validate.Regexp(_TIME))
    close = fields.String(required=True, validate=validate.Regexp(_TIME))

    @validates_schema
    def _open_before_close(self, data, **kwargs):
        if data["open"] >= data["close"]:
            raise ValidationError("Opening time must be before closing time.", "close")


class DeliverySchema(_Strict):
    offers = fields.Boolean(required=True)
    radius_km = fields.Integer(load_default=0, validate=validate.Range(0, 200))
    fee_cents = fields.Integer(load_default=0, validate=validate.Range(0, MAX_MONEY_CENTS))
    free_over_cents = fields.Integer(load_default=None, allow_none=True, validate=validate.Range(1, MAX_MONEY_CENTS))


class PaymentsSchema(_Strict):
    in_app = fields.Boolean(required=True)
    cash = fields.Boolean(required=True)
    cash_limit_cents = fields.Integer(load_default=None, allow_none=True, validate=validate.Range(1, MAX_MONEY_CENTS))


class PayoutSchema(_Strict):
    merchant_id = fields.String(load_default=None, allow_none=True, validate=validate.Regexp(r"^\d{5,20}$"))


class SupplierFeedSchema(_Strict):
    external_id = fields.String(required=True, validate=validate.Regexp(r"^[A-Z0-9][A-Z0-9-]{2,63}$"))
    trading_name = BusinessName(required=True)
    legal_name = CleanText(max_len=160, load_default=None, allow_none=True)
    about = CleanText(max_len=500, load_default=None, allow_none=True)
    vat_number = fields.String(load_default=None, allow_none=True, validate=validate.Regexp(r"^4\d{9}$"))
    orders_email = fields.String(required=True, validate=validate.Length(max=254))
    phone = fields.String(load_default=None, allow_none=True)
    brand_color = fields.String(load_default="#1F2A44", validate=validate.Regexp(r"^#[0-9A-Fa-f]{6}$"))
    collection_address = fields.Nested(AddressSchema, required=True)
    hours = fields.List(fields.Nested(HoursSchema), required=True, validate=validate.Length(min=1, max=7))
    delivery = fields.Nested(DeliverySchema, required=True)
    collect = fields.Boolean(required=True)
    payments = fields.Nested(PaymentsSchema, required=True)
    minimum_order_cents = fields.Integer(load_default=0, validate=validate.Range(0, MAX_MONEY_CENTS))
    categories = fields.List(
        fields.String(validate=validate.OneOf(CATEGORIES)), required=True, validate=validate.Length(min=1, max=len(CATEGORIES))
    )
    payout = fields.Nested(PayoutSchema, load_default=None, allow_none=True)

    @validates_schema
    def _consistent(self, data, **kwargs):
        errors: dict[str, list[str]] = {}
        email = normalize_email(data.get("orders_email", ""))
        if not is_plausible_email(email):
            errors["orders_email"] = ["Enter a valid email address."]
        if data.get("phone") and not normalize_phone(data["phone"]):
            errors["phone"] = ["Enter a valid South African phone number."]
        cats = data.get("categories") or []
        if len(set(cats)) != len(cats):
            errors["categories"] = ["A category is listed twice."]
        delivery, payments = data.get("delivery") or {}, data.get("payments") or {}
        if delivery.get("offers") and not delivery.get("radius_km"):
            errors["delivery"] = ["A supplier that delivers needs a delivery radius."]
        if not delivery.get("offers") and not data.get("collect"):
            errors["collect"] = ["Offer delivery, collection, or both."]
        if not payments.get("in_app") and not payments.get("cash"):
            errors["payments"] = ["Accept at least one way to pay."]
        if payments.get("cash_limit_cents") and not payments.get("cash"):
            errors["payments"] = ["A cash limit needs cash to be accepted."]
        if errors:
            raise ValidationError(errors)


def load_supplier_feed(raw: Any) -> dict:
    """The validated supplier.json, in the Supplier model's own column names."""
    d = SupplierFeedSchema().load(raw)
    a, dl, p = d["collection_address"], d["delivery"], d["payments"]
    return {
        "external_id": d["external_id"],
        "trading_name": d["trading_name"],
        "legal_name": d["legal_name"],
        "about": d["about"],
        "vat_number": d["vat_number"],
        "orders_email": normalize_email(d["orders_email"]),
        "phone": normalize_phone(d["phone"]) if d["phone"] else None,
        "brand_color": d["brand_color"].upper(),
        "street": a["street"],
        "suburb": a["suburb"],
        "city": a["city"],
        "province": a["province"],
        "postal_code": a["postal_code"],
        # Decimal, like the Numeric(9, 6) columns, so an unchanged pin compares equal.
        "latitude": Decimal(f"{a['latitude']:.6f}"),
        "longitude": Decimal(f"{a['longitude']:.6f}"),
        "hours": d["hours"],
        "delivers": dl["offers"],
        "delivery_radius_km": dl["radius_km"] if dl["offers"] else 0,
        "delivery_fee_cents": dl["fee_cents"] if dl["offers"] else 0,
        "free_delivery_over_cents": dl["free_over_cents"] if dl["offers"] else None,
        "collect": d["collect"],
        "accepts_in_app": p["in_app"],
        "accepts_cash": p["cash"],
        "cash_limit_cents": p["cash_limit_cents"] if p["cash"] else None,
        "minimum_order_cents": d["minimum_order_cents"],
        "categories": d["categories"],
        "payout_merchant_id": (d["payout"] or {}).get("merchant_id"),
    }


# ---------------------------------------------------------------------------
# products.csv
# ---------------------------------------------------------------------------

PRODUCT_COLUMNS = (
    "product_code", "name", "brand", "category", "unit", "pack_size", "units_per_pack",
    "price_rands", "compare_at_rands", "vat_rate", "vat_included", "stock", "min_qty", "max_qty",
    "unit_barcode", "case_barcode", "weight_kg", "description", "active",
)
REQUIRED_COLUMNS = ("product_code", "name", "category", "unit", "pack_size", "price_rands", "vat_rate", "stock")

_CODE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
_RANDS = re.compile(r"^\d{1,7}(\.\d{1,2})?$")
_INT = re.compile(r"^\d{1,7}$")
_KG = re.compile(r"^\d{1,5}(\.\d{1,3})?$")
_FORMULA_START = ("=", "+", "-", "@")
_TRUE, _FALSE = ("true", "yes", "1"), ("false", "no", "0")


class RowError(Exception):
    def __init__(self, field: str, reason: str):
        super().__init__(reason)
        self.field, self.reason = field, reason


def gtin_is_valid(code: str, lengths: tuple[int, ...] = (8, 13)) -> bool:
    """GS1 check digit, the same for GTIN-8, -12, -13 and -14."""
    if not code.isdigit() or len(code) not in lengths:
        return False
    digits = [int(c) for c in code]
    body, check = digits[:-1], digits[-1]
    # Weights 3,1,3,1... from the digit next to the check digit.
    total = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(body)))
    return (10 - total % 10) % 10 == check


def _text(row: dict, field: str, *, required: bool, max_len: int) -> Optional[str]:
    raw = (row.get(field) or "").strip()
    if not raw:
        if required:
            raise RowError(field, "Required.")
        return None
    if raw.startswith(_FORMULA_START):
        raise RowError(field, "Can't start with = + - or @.")
    try:
        return clean_text(raw, min_len=1, max_len=max_len)
    except ValueError as e:
        raise RowError(field, str(e)) from None


def _cents(row: dict, field: str, *, required: bool) -> Optional[int]:
    raw = (row.get(field) or "").strip()
    if not raw:
        if required:
            raise RowError(field, "Required.")
        return None
    if not _RANDS.match(raw):
        raise RowError(field, "Use rands with up to 2 decimals, e.g. 189.99.")
    rands, _, cents = raw.partition(".")
    value = int(rands) * 100 + int((cents + "00")[:2])
    if not 0 < value <= MAX_MONEY_CENTS:
        raise RowError(field, "Must be more than R0 and at most R1,000,000.")
    return value


def _int(row: dict, field: str, default: Optional[int], lo: int, hi: int) -> int:
    raw = (row.get(field) or "").strip()
    if not raw:
        if default is None:
            raise RowError(field, "Required.")
        return default
    if not _INT.match(raw) or not lo <= int(raw) <= hi:
        raise RowError(field, f"Use a whole number from {lo} to {hi}.")
    return int(raw)


def _bool(row: dict, field: str, default: bool) -> bool:
    raw = (row.get(field) or "").strip().lower()
    if not raw:
        return default
    if raw in _TRUE:
        return True
    if raw in _FALSE:
        return False
    raise RowError(field, "Use true or false.")


def _barcode(row: dict, field: str, lengths: tuple[int, ...], what: str) -> Optional[str]:
    raw = (row.get(field) or "").strip()
    if not raw:
        return None
    if not gtin_is_valid(raw, lengths):
        raise RowError(field, f"Not a valid {what} (wrong length or check digit).")
    return raw


def parse_product_row(row: dict, supplier_categories: list[str]) -> dict:
    """One CSV row -> the Product model's columns, or RowError(field, reason)."""
    code = (row.get("product_code") or "").strip()
    if not _CODE.match(code):
        raise RowError("product_code", "Use 1-64 letters, numbers, dots, dashes or underscores.")
    category = (row.get("category") or "").strip()
    if category not in CATEGORIES:
        raise RowError("category", "Not one of our category codes.")
    if category not in supplier_categories:
        raise RowError("category", "Not one of this supplier's categories.")
    unit = (row.get("unit") or "").strip().lower()
    if unit not in UNITS:
        raise RowError("unit", f"Use one of: {', '.join(UNITS)}.")

    vat_rate = (row.get("vat_rate") or "").strip().lower()
    if vat_rate not in VAT_RATES:
        raise RowError("vat_rate", "Use standard (15%) or zero (zero-rated basic food).")

    weight_raw = (row.get("weight_kg") or "").strip()
    if weight_raw and (not _KG.match(weight_raw) or float(weight_raw) <= 0):
        raise RowError("weight_kg", "Use kilograms with up to 3 decimals, e.g. 50 or 0.75.")

    price = _cents(row, "price_rands", required=True)
    compare_at = _cents(row, "compare_at_rands", required=False)
    if compare_at is not None and compare_at <= price:
        raise RowError("compare_at_rands", "The usual price must be higher than the sale price.")

    min_qty = _int(row, "min_qty", 1, 1, MAX_QTY_LIMIT)
    max_qty = _int(row, "max_qty", 100, 1, MAX_QTY_LIMIT)
    if max_qty < min_qty:
        raise RowError("max_qty", "Must be at least min_qty.")

    return {
        "product_code": code,
        "name": _text(row, "name", required=True, max_len=120),
        "brand": _text(row, "brand", required=False, max_len=80),
        "category": category,
        "unit": unit,
        "pack_size": _text(row, "pack_size", required=True, max_len=60),
        "units_per_pack": _int(row, "units_per_pack", 1, 1, 10_000),
        "weight_kg": Decimal(weight_raw) if weight_raw else None,
        "description": _text(row, "description", required=False, max_len=1000),
        "price_cents": price,
        "compare_at_price_cents": compare_at,
        "vat_rate": vat_rate,
        "vat_included": _bool(row, "vat_included", True),
        "stock_qty": _int(row, "stock", None, 0, 1_000_000),
        "min_qty": min_qty,
        "max_qty": max_qty,
        "unit_barcode": _barcode(row, "unit_barcode", (8, 13), "EAN-8 or EAN-13 item barcode"),
        "case_barcode": _barcode(row, "case_barcode", (14,), "GTIN-14 case barcode"),
        "active": _bool(row, "active", True),
    }


__all__ = [
    "PRODUCT_COLUMNS", "REQUIRED_COLUMNS", "RowError", "gtin_is_valid", "load_supplier_feed", "parse_product_row",
]
