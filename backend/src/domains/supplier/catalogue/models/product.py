"""
Product -- one item on a supplier's catalogue.

product_code is the supplier's own item / stock code (Sage calls it
"Item Code"; unique per supplier). unit_barcode is the GTIN on one item
(EAN-13 / EAN-8); case_barcode the GTIN-14 on the outer case (ITF-14),
which is what warehouses scan. All three are for systems, never shown to
traders.

VAT: South Africa zero-rates basic foods (maize meal, brown bread, rice,
milk, maas, dried beans, vegetable oil, pilchards, eggs...); everything
else is standard-rated (15%). Tax invoices need the rate per line, so
every product states it (vat_rate); vat_included says whether price_cents
already includes it.

Money is in cents. compare_at_price_cents is the usual price while a
product is on special (shown crossed out); it must be higher than the
price. stock_qty is what the supplier's system says is left; traders
only ever see in stock / only a few left / out of stock.

active=false: the supplier stopped selling it (or it wasn't in their last
full catalogue). Kept, because old orders point at it.
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import ARRAY, UUID

from src.core.base_model import BaseModel
from src.extensions import db
from src.shared.constants.categories import CATEGORIES

from ..constants import MAX_QTY_LIMIT, UNITS, VAT_RATES


def _in(column: str, values: tuple) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class Product(BaseModel):
    __tablename__ = "products"
    __table_args__ = (
        db.UniqueConstraint("supplier_id", "product_code", name="uq_products_supplier_product_code"),
        db.Index("ix_products_supplier_category", "supplier_id", "category"),
        db.CheckConstraint(_in("category", CATEGORIES), name="ck_products_category"),
        db.CheckConstraint(_in("unit", UNITS), name="ck_products_unit"),
        db.CheckConstraint(_in("vat_rate", VAT_RATES), name="ck_products_vat_rate"),
        db.CheckConstraint("units_per_pack >= 1", name="ck_products_units_per_pack"),
        db.CheckConstraint("weight_kg IS NULL OR weight_kg > 0", name="ck_products_weight"),
        db.CheckConstraint("price_cents > 0", name="ck_products_price"),
        db.CheckConstraint("compare_at_price_cents IS NULL OR compare_at_price_cents > price_cents", name="ck_products_compare_at"),
        db.CheckConstraint("stock_qty >= 0", name="ck_products_stock"),
        db.CheckConstraint("cardinality(image_urls) <= 7", name="ck_products_images"),
        db.CheckConstraint(f"min_qty >= 1 AND max_qty >= min_qty AND max_qty <= {MAX_QTY_LIMIT}", name="ck_products_qty"),
        {"schema": "supplier"},
    )

    supplier_id = db.Column(UUID(as_uuid=True), db.ForeignKey("supplier.suppliers.id", ondelete="CASCADE"), nullable=False)
    product_code = db.Column(db.String(64), nullable=False)
    unit_barcode = db.Column(db.String(13), nullable=True)
    case_barcode = db.Column(db.String(14), nullable=True)

    name = db.Column(db.String(120), nullable=False)
    brand = db.Column(db.String(80), nullable=True)
    category = db.Column(db.String(40), nullable=False)
    unit = db.Column(db.String(10), nullable=False)
    #: e.g. "24 x 500 ml", "50 kg"
    pack_size = db.Column(db.String(60), nullable=False)
    #: How many sellable items are inside (24 for "24 x 330 ml"): lets a
    #: trader who resells singles see the price per item.
    units_per_pack = db.Column(db.Integer, nullable=False, default=1)
    #: For delivery planning (a pallet of bricks, 50 kg of cement).
    weight_kg = db.Column(db.Numeric(8, 3), nullable=True)
    description = db.Column(db.String(1000), nullable=True)
    #: 0-7 photo links, the first is the main one (our Cloudinary only:
    #: shared/media/public_urls.py).
    image_urls = db.Column(ARRAY(db.String(500)), nullable=False, default=list)

    price_cents = db.Column(db.BigInteger, nullable=False)
    compare_at_price_cents = db.Column(db.BigInteger, nullable=True)
    #: "standard" (15%) or "zero" (zero-rated basic food).
    vat_rate = db.Column(db.String(10), nullable=False)
    vat_included = db.Column(db.Boolean, nullable=False, default=True)

    stock_qty = db.Column(db.Integer, nullable=False, default=0)
    min_qty = db.Column(db.Integer, nullable=False, default=1)
    max_qty = db.Column(db.Integer, nullable=False, default=100)
    active = db.Column(db.Boolean, nullable=False, default=True)
