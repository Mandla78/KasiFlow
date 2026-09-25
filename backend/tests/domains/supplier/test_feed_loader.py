"""
The supplier feed (supplier.json + products.csv): the one way supplier data
gets in, from a supplier's own system or our seed files.
"""
from __future__ import annotations

import copy
import csv
import io
import json
from pathlib import Path

import pytest

from src.domains.supplier.catalogue.models import Product
from src.domains.supplier.integration.models import ImportJob
from src.domains.supplier.integration.schemas.feed_schemas import PRODUCT_COLUMNS, gtin_is_valid
from src.domains.supplier.integration.services.feed_loader import FeedRefused, load_directory, load_files
from src.domains.supplier.supplier_profile.models import Supplier
from src.extensions import db

SEED = Path(__file__).resolve().parents[3] / "seed" / "suppliers"
MAHLANGU = SEED / "mahlangu-wholesale"


def profile(**changes) -> dict:
    data = json.loads((MAHLANGU / "supplier.json").read_text(encoding="utf-8"))
    for key, value in changes.items():
        data[key] = value
    return data


GOOD = {
    "product_code": "MW-1", "name": "Super maize meal", "brand": "Kasi Gold", "category": "food_grocery",
    "unit": "bag", "pack_size": "10 kg", "units_per_pack": "1", "price_rands": "89.99", "compare_at_rands": "",
    "vat_rate": "zero", "vat_included": "true", "stock": "120", "min_qty": "1", "max_qty": "50",
    "unit_barcode": "2010000000007", "case_barcode": "", "weight_kg": "10", "description": "Fine white maize meal.",
    "active": "true",
}


def row(**changes) -> dict:
    r = dict(GOOD)
    r.update(changes)
    return r


def to_csv(rows: list[dict], columns=PRODUCT_COLUMNS) -> bytes:
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=list(columns), extrasaction="ignore")
    w.writeheader()
    w.writerows(rows)
    return out.getvalue().encode("utf-8")


def load(rows, prof=None, **kw):
    return load_files(json.dumps(prof or profile()).encode(), to_csv(rows), source="seed", **kw)


def test_every_seed_supplier_loads_cleanly(app):
    with app.app_context():
        for folder in sorted(p for p in SEED.iterdir() if p.is_dir()):
            with (folder / "products.csv").open(encoding="utf-8") as f:
                expected = sum(1 for _ in csv.DictReader(f))
            r = load_directory(folder, source="seed", verified=True)
            assert r.failed == 0, (folder.name, r.errors[:3])
            assert r.created == expected
        assert Supplier.query.count() == 7
        assert Product.query.count() > 800
        assert all(s.verified_at is not None for s in Supplier.query.all())


def test_loading_the_same_feed_twice_changes_nothing(app):
    with app.app_context():
        first = load_directory(MAHLANGU, source="seed")
        again = load_directory(MAHLANGU, source="seed")
        assert again.created_supplier is False
        assert (again.created, again.updated, again.unchanged) == (0, 0, first.created)
        assert ImportJob.query.count() == 2


def test_a_changed_price_is_an_update(app):
    with app.app_context():
        load([row()])
        r = load([row(price_rands="84.99")])
        assert (r.created, r.updated) == (0, 1)
        assert Product.query.one().price_cents == 8499


def test_bad_rows_are_listed_with_their_row_number_and_good_rows_still_load(app):
    rows = [
        row(),                                                         # row 2: fine
        row(product_code="MW-2", price_rands="89.999"),                # 3: three decimals
        row(product_code="MW-3", unit_barcode="2010000000008"),        # 4: wrong check digit
        row(product_code="MW-4", category="plumbing"),                 # 5: not this supplier's
        row(product_code="MW-5", name="=HYPERLINK(\"http://x\")"),     # 6: spreadsheet formula
        row(product_code="MW-1"),                                      # 7: code already used
        row(product_code="MW-6", vat_rate="half"),                     # 8: not a VAT rate
        row(product_code="MW-7", compare_at_rands="80.00"),            # 9: "was" price lower
        row(product_code="MW-8", case_barcode="2010000000007"),        # 10: 13 digits, not a case GTIN-14
        row(product_code="MW-9", unit="crate-ish"),                    # 11: unknown unit
        row(product_code="MW-10", stock="-4"),                         # 12: negative stock
    ]
    with app.app_context():
        r = load(rows)
        assert r.created == 1
        assert r.failed == 10
        got = {e["row"]: e["field"] for e in r.errors}
        assert got == {
            3: "price_rands", 4: "unit_barcode", 5: "category", 6: "name", 7: "product_code",
            8: "vat_rate", 9: "compare_at_rands", 10: "case_barcode", 11: "unit", 12: "stock",
        }
        job = ImportJob.query.one()
        assert job.status == "finished" and job.failed == 10 and len(job.errors) == 10


def test_a_row_with_more_cells_than_columns_is_reported(app):
    text = to_csv([row()]).decode() + "MW-2,Rice,,food_grocery,bag,10 kg,1,169.99,,zero,true,5,1,50,,,10,x,true,EXTRA\n"
    with app.app_context():
        r = load_files(json.dumps(profile()).encode(), text.encode(), source="seed")
        assert r.created == 1
        assert r.errors == [{"row": 3, "field": "_row", "reason": "More cells than there are columns."}]


@pytest.mark.parametrize(
    "columns, message",
    [
        ([c for c in PRODUCT_COLUMNS if c != "vat_rate"], "missing columns: vat_rate"),
        ([*PRODUCT_COLUMNS, "cost_price"], "unknown columns: cost_price"),
    ],
)
def test_wrong_columns_refuse_the_whole_file(app, columns, message):
    with app.app_context():
        with pytest.raises(FeedRefused, match=message):
            load_files(json.dumps(profile()).encode(), to_csv([row()], columns), source="seed")
        assert Supplier.query.count() == 0 and Product.query.count() == 0
        assert ImportJob.query.one().status == "refused"


@pytest.mark.parametrize(
    "changes, field",
    [
        ({"payments": {"in_app": True, "cash": False, "cash_limit_cents": 100000}}, "payments"),
        ({"collection_address": {**profile()["collection_address"], "latitude": 51.5}}, "collection_address.latitude"),
        ({"categories": ["food_grocery", "airtime_electricity"]}, "categories"),
        ({"trading_name": "12345"}, "trading_name"),
        ({"orders_email": "not-an-email"}, "orders_email"),
        ({"verified": True}, "verified"),  # the feed can't verify itself
    ],
)
def test_a_bad_supplier_profile_is_refused(app, changes, field):
    with app.app_context():
        with pytest.raises(FeedRefused, match=field.split(".")[0]):
            load([row()], prof=profile(**changes))
        assert Supplier.query.count() == 0


def test_only_we_decide_verified(app):
    with app.app_context():
        load([row()])
        assert Supplier.query.one().verified_at is None
        load([row()], verified=True)
        stamped = Supplier.query.one().verified_at
        load([row()], verified=False)  # a later feed can't take it away
        assert Supplier.query.one().verified_at == stamped


def test_a_full_catalogue_switches_off_what_is_missing_but_keeps_it(app):
    with app.app_context():
        load([row(), row(product_code="MW-2", name="Rice")])
        r = load([row()])
        assert r.deactivated == 1
        rice = Product.query.filter_by(product_code="MW-2").one()
        assert rice.active is False  # kept: old orders point at it


def test_a_full_catalogue_with_no_usable_row_changes_nothing(app):
    with app.app_context():
        load([row()])
        with pytest.raises(FeedRefused, match="No row could be used"):
            load([row(price_rands="free")])
        assert Product.query.one().active is True


def test_money_is_exact_cents(app):
    with app.app_context():
        load([row(price_rands="10.5", compare_at_rands="12")])
        p = Product.query.one()
        assert (p.price_cents, p.compare_at_price_cents) == (1050, 1200)


def test_gs1_check_digits():
    assert gtin_is_valid("4006381333931", (13,))          # the textbook EAN-13 example
    assert not gtin_is_valid("4006381333932", (13,))
    assert gtin_is_valid("12020000000003", (14,))         # our seed's case GTIN-14
    assert not gtin_is_valid("2020000000006", (14,))      # right digits, wrong length


def test_seed_is_deterministic():
    before = (MAHLANGU / "products.csv").read_bytes()
    import runpy

    runpy.run_path(str(SEED.parent / "generate_dataset.py"), run_name="__main__")
    assert (MAHLANGU / "products.csv").read_bytes() == before


def test_payout_ids_never_reach_the_audit_trail(app):
    published = []
    from src.shared.audit import audit

    listen = published.append
    audit.register_listener(listen)
    try:
        with app.app_context():
            prof = copy.deepcopy(profile())
            prof["payout"] = {"merchant_id": "10000100"}
            load([row()], prof=prof)
            load([row()], prof={**prof, "minimum_order_cents": 60000})
    finally:
        audit._listeners.remove(listen)  # only ours: the real audit writer stays
    dumped = json.dumps([e.metadata for e in published], default=str)
    assert "10000100" not in dumped  # payout id never logged
    assert "minimum_order_cents" in dumped  # only WHICH fields changed
