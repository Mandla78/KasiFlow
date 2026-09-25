"""
Builds the seed supplier feeds (docs/supplier/03): for each supplier a
folder with supplier.json and products.csv, exactly what a supplier's own
system would send. Load them with:  flask suppliers load

    python seed/generate_dataset.py          (from backend/)

FICTIONAL, ON PURPOSE. The companies, brands, emails (example.com) and
phone numbers are made up; no real business is imitated. Barcodes use
GS1's in-store prefix 2xx, which is never assigned to a real company, so
no barcode here can collide with a real product. Prices are realistic
South African wholesale prices (2026, VAT included).

DETERMINISTIC: the same code gives the same files for everyone (seeded
per supplier), so a teammate's data matches yours.
"""
from __future__ import annotations

import csv
import json
import random
import re
from pathlib import Path

OUT = Path(__file__).resolve().parent / "suppliers"

# Zero-rated for VAT (VAT Act Schedule 2 Part B: basic foodstuffs). Anything
# not here is standard-rated: white bread, cake flour, sugar, flavoured drinks...
ZERO_RATED = {
    "Super maize meal", "Long grain parboiled rice", "Sunflower cooking oil", "Pilchards in tomato sauce",
    "Samp", "Sugar beans", "Long-life full cream milk", "Maas (amasi)", "Fresh full cream milk",
    "Brown bread, sliced", "Whole-wheat bread",
}
TARGET_PER_SUPPLIER = 220

# (name, unit, [(pack size, rands), ...], description)
Item = tuple[str, str, list[tuple[str, float]], str]

CATALOGUE: dict[str, dict] = {
    "food_grocery": {
        "code": "FG",
        "brands": ["Kasi Gold", "Mill Street", "Harvest Tin"],
        "items": [
            ("Super maize meal", "bag", [("10 kg", 89.99), ("25 kg", 209.99)], "Fine white maize meal for pap."),
            ("Long grain parboiled rice", "bag", [("2 kg", 39.99), ("10 kg", 169.99)], "Non-sticky parboiled rice."),
            ("Cake flour", "bag", [("2.5 kg", 42.99), ("10 kg", 139.99)], "White cake flour for baking and vetkoek."),
            ("White sugar", "bag", [("2.5 kg", 59.99), ("10 kg", 219.99)], "Refined white sugar."),
            ("Brown sugar", "bag", [("2 kg", 44.99)], "Soft brown sugar."),
            ("Sunflower cooking oil", "bottle", [("2 litre", 69.99), ("5 litre", 149.99)], "Pure sunflower oil."),
            ("Baked beans in tomato sauce", "case", [("24 x 410 g", 299.99)], "A case of 24 tins."),
            ("Pilchards in tomato sauce", "case", [("24 x 400 g", 599.99)], "Canned pilchards, a case of 24."),
            ("Chicken instant noodles", "case", [("40 x 73 g", 199.99)], "Chicken-flavoured instant noodles."),
            ("Samp", "bag", [("5 kg", 74.99)], "Crushed dried maize kernels."),
            ("Sugar beans", "bag", [("2 kg", 64.99)], "Dried speckled sugar beans."),
            ("Black tea bags", "pack", [("100 bags", 54.99), ("200 bags", 99.99)], "Tagless black tea bags."),
            ("Instant coffee", "tin", [("250 g", 89.99)], "Granulated instant coffee."),
            ("Iodated table salt", "case", [("24 x 500 g", 119.99)], "Fine iodated salt."),
            ("Peanut butter, smooth", "case", [("12 x 400 g", 419.99)], "Smooth peanut butter."),
            ("Apricot jam", "case", [("12 x 450 g", 359.99)], "Smooth apricot jam."),
        ],
    },
    "beverages": {
        "code": "BV",
        "brands": ["Fizz Co", "Clear Spring", "Sunny Farm"],
        "items": [
            ("Cola soft drink", "case", [("24 x 330 ml cans", 189.99), ("12 x 2 litre", 259.99)], "Cold drink, a full case."),
            ("Orange soft drink", "case", [("24 x 330 ml cans", 179.99), ("12 x 2 litre", 239.99)], "Orange-flavoured cold drink."),
            ("Lemon-lime soft drink", "case", [("24 x 330 ml cans", 179.99)], "Lemon-lime cold drink."),
            ("Still water", "case", [("24 x 500 ml", 99.99), ("6 x 5 litre", 119.99)], "Still spring water."),
            ("Sparkling water", "case", [("24 x 500 ml", 119.99)], "Sparkling spring water."),
            ("Fruit juice blend", "case", [("6 x 1 litre", 129.99), ("24 x 200 ml", 159.99)], "100% fruit juice blend."),
            ("Dairy fruit mix drink", "case", [("12 x 500 ml", 169.99)], "Fruit and dairy blend."),
            ("Energy drink", "case", [("24 x 500 ml", 359.99)], "Energy drink cans."),
            ("Cordial, orange", "case", [("6 x 1 litre", 149.99)], "Dilute to taste."),
            ("Mageu, original", "case", [("6 x 1 litre", 109.99)], "Traditional fermented maize drink."),
            ("Iced tea, peach", "case", [("12 x 500 ml", 139.99)], "Peach iced tea."),
        ],
    },
    "snacks_confectionery": {
        "code": "SN",
        "brands": ["Crunch Kasi", "Candy Corner", "Cocoa Joy"],
        "items": [
            ("Potato chips, salt & vinegar", "case", [("48 x 36 g", 239.99), ("20 x 125 g", 299.99)], "Crisp potato chips."),
            ("Potato chips, cheese & onion", "case", [("48 x 36 g", 239.99)], "Crisp potato chips."),
            ("Maize snacks, cheese", "case", [("50 x 25 g", 129.99)], "Cheese-flavoured maize puffs."),
            ("Maize snacks, spicy", "case", [("50 x 25 g", 129.99)], "Spicy maize puffs."),
            ("Fruit lollipops", "pack", [("100 pieces", 59.99)], "Assorted fruit lollipops."),
            ("Milk chocolate bars", "case", [("24 x 40 g", 219.99)], "Milk chocolate bars."),
            ("Mint chewing gum", "pack", [("100 pieces", 49.99)], "Single mint gum pieces."),
            ("Toffees", "pack", [("100 pieces", 44.99)], "Individually wrapped toffees."),
            ("Marie biscuits", "case", [("12 x 200 g", 179.99)], "Plain tea biscuits."),
            ("Cream biscuits, vanilla", "case", [("12 x 200 g", 199.99)], "Vanilla cream biscuits."),
            ("Salted peanuts", "case", [("24 x 50 g", 149.99)], "Roasted salted peanuts."),
        ],
    },
    "dairy_chilled": {
        "code": "DC",
        "brands": ["Farm Fresh", "Dairy Best", "Golden Spread"],
        "items": [
            ("Long-life full cream milk", "case", [("6 x 1 litre", 109.99), ("12 x 1 litre", 209.99)], "UHT milk; no fridge needed until opened."),
            ("Maas (amasi)", "case", [("6 x 2 litre", 199.99)], "Thick fermented milk."),
            ("Fresh full cream milk", "crate", [("6 x 2 litre", 179.99)], "Keep chilled."),
            ("Margarine brick", "case", [("12 x 500 g", 299.99)], "Margarine bricks for bread."),
            ("Cheese slices", "pack", [("10 x 200 g", 399.99)], "Processed cheese slices."),
            ("Plain yoghurt", "case", [("6 x 1 kg", 219.99)], "Plain drinking yoghurt."),
            ("Fruit yoghurt cups", "case", [("24 x 100 g", 189.99)], "Assorted fruit yoghurt."),
            ("Polony", "case", [("10 x 1 kg", 459.99)], "Chilled polony rolls."),
        ],
    },
    "bakery": {
        "code": "BK",
        "brands": ["Kasi Bakers", "Morning Loaf", "Oven Gold"],
        "items": [
            ("White bread, sliced", "crate", [("10 x 700 g", 159.99)], "Baked fresh daily, sliced."),
            ("Brown bread, sliced", "crate", [("10 x 700 g", 149.99)], "Baked fresh daily, sliced."),
            ("Whole-wheat bread", "crate", [("10 x 700 g", 169.99)], "Baked fresh daily."),
            ("Hot dog rolls", "pack", [("6 x 6 rolls", 89.99)], "Soft rolls."),
            ("Burger buns", "pack", [("6 x 6 buns", 94.99)], "Soft sesame buns."),
            ("Vetkoek", "tray", [("24 pieces", 72.0)], "Made fresh every morning."),
            ("Scones", "tray", [("24 pieces", 96.0)], "Plain scones."),
            ("Muffins, assorted", "tray", [("12 pieces", 84.0)], "Chocolate and bran muffins."),
            ("Rusks, buttermilk", "case", [("6 x 500 g", 239.99)], "Buttermilk rusks."),
        ],
    },
    "household_cleaning": {
        "code": "HC",
        "brands": ["Sparkle", "Bright Wash", "Pure White"],
        "items": [
            ("Dishwashing liquid", "case", [("12 x 750 ml", 239.99), ("4 x 5 litre", 299.99)], "Lemon dishwashing liquid."),
            ("Hand washing powder", "bag", [("2 kg", 74.99), ("5 kg", 169.99)], "Washing powder for hand wash."),
            ("Thick bleach", "case", [("12 x 750 ml", 179.99)], "Thick household bleach."),
            ("Multi-purpose cleaner", "case", [("12 x 750 ml", 219.99)], "Cleans floors, tiles and counters."),
            ("Toilet paper, 1-ply", "pack", [("48 rolls", 189.99)], "Single-ply toilet rolls."),
            ("Toilet paper, 2-ply", "pack", [("24 rolls", 179.99)], "Two-ply toilet rolls."),
            ("Bath soap bars", "case", [("48 x 150 g", 329.99)], "Family soap bars."),
            ("Laundry bar soap", "case", [("24 x 500 g", 299.99)], "Blue laundry bars."),
            ("Floor polish", "case", [("12 x 400 ml", 359.99)], "Red floor polish."),
            ("Scouring pads", "pack", [("50 pads", 99.99)], "Green scouring pads."),
            ("Refuse bags, black", "bundle", [("200 bags", 179.99)], "Heavy-duty black bags."),
        ],
    },
    "personal_care": {
        "code": "PC",
        "brands": ["Skin Guard", "Bright Smile", "Fresh Day"],
        "items": [
            ("Petroleum jelly", "case", [("12 x 250 ml", 199.99)], "Pure petroleum jelly."),
            ("Aqueous body lotion", "case", [("6 x 400 ml", 219.99)], "Aqueous body lotion."),
            ("Fluoride toothpaste", "case", [("24 x 100 ml", 299.99)], "Fluoride toothpaste."),
            ("Toothbrushes, medium", "pack", [("24 brushes", 119.99)], "Medium toothbrushes."),
            ("Roll-on deodorant", "case", [("12 x 50 ml", 239.99)], "48-hour roll-on."),
            ("Hair food", "case", [("12 x 125 ml", 199.99)], "Moisturising hair food."),
            ("Sanitary pads", "case", [("24 x 10 pads", 479.99)], "Maxi thick pads."),
            ("Razors, twin blade", "pack", [("50 razors", 149.99)], "Disposable twin-blade razors."),
        ],
    },
    "baby_family": {
        "code": "BF",
        "brands": ["Little Steps", "Soft Cloud", "Tiny Care"],
        "items": [
            ("Disposable nappies, size 3", "pack", [("4 x 44", 599.99)], "Size 3 nappies."),
            ("Disposable nappies, size 4", "pack", [("4 x 40", 619.99)], "Size 4 nappies."),
            ("Baby wipes", "case", [("12 x 80", 299.99)], "Alcohol-free wipes."),
            ("Baby aqueous cream", "case", [("12 x 500 ml", 359.99)], "Gentle aqueous cream."),
            ("Baby cereal", "case", [("12 x 500 g", 499.99)], "Fortified infant cereal."),
        ],
    },
    "packaging_disposable": {
        "code": "PD",
        "brands": ["Pack It", "Wrap Right", "Carry All"],
        "items": [
            ("Plastic carry bags, size 24", "bundle", [("1000 bags", 189.99)], "Size 24 carry bags."),
            ("Bread bags", "bundle", [("1000 bags", 99.99)], "Clear bread bags."),
            ("Takeaway containers", "case", [("500 containers", 399.99)], "Hinged foam containers."),
            ("Paper serviettes", "case", [("20 x 100", 219.99)], "White 2-ply serviettes."),
            ("Polystyrene cups", "case", [("1000 cups", 289.99)], "250 ml cups."),
        ],
    },
    "building_materials": {
        "code": "BM",
        "brands": ["Rock Build", "Clay Works", "Steel Line"],
        "items": [
            ("Cement, 42.5N", "bag", [("50 kg", 109.99)], "General-purpose cement."),
            ("Cement, 32.5R", "bag", [("50 kg", 99.99)], "Plaster and brickwork cement."),
            ("Building sand", "cube", [("1 m³", 649.99)], "Delivered by truck."),
            ("Plaster sand", "cube", [("1 m³", 699.99)], "Fine plaster sand."),
            ("Concrete stone, 19 mm", "cube", [("1 m³", 749.99)], "Concrete stone."),
            ("Maxi stock bricks", "pallet", [("500 bricks", 1699.99)], "Stock bricks, a pallet."),
            ("Cement blocks", "pallet", [("100 blocks", 1299.99)], "Hollow cement blocks."),
            ("IBR roof sheet, 0.47 mm", "sheet", [("3.6 m", 289.99), ("6 m", 469.99)], "Galvanised IBR sheet."),
            ("Corrugated roof sheet", "sheet", [("3 m", 219.99)], "Galvanised corrugated sheet."),
            ("Brickforce", "roll", [("20 m", 39.99)], "Brickforce wire, 150 mm."),
            ("Damp-proof course", "roll", [("30 m", 99.99)], "375 mm DPC."),
            ("Timber, 38 x 114 mm", "length", [("3.6 m", 159.99), ("6.6 m", 289.99)], "Treated SA pine."),
        ],
    },
    "tools_hardware": {
        "code": "TH",
        "brands": ["Site Pro", "Fixit", "Iron Hand"],
        "items": [
            ("Builder's wheelbarrow", "each", [("65 litre", 899.99), ("85 litre", 1099.99)], "Heavy-duty wheelbarrow."),
            ("Round-mouth spade", "each", [("Standard", 179.99)], "Steel spade, wooden handle."),
            ("Claw hammer", "each", [("500 g", 149.99)], "Fibreglass handle."),
            ("Brick trowel", "each", [("280 mm", 119.99)], "Forged steel trowel."),
            ("Spirit level", "each", [("600 mm", 189.99), ("1200 mm", 299.99)], "Aluminium spirit level."),
            ("Wire nails, 75 mm", "box", [("5 kg", 229.99)], "Round wire nails."),
            ("Roofing screws", "box", [("100 screws", 149.99)], "Self-drilling roofing screws."),
            ("Tape measure", "each", [("8 m", 99.99)], "Metric tape measure."),
            ("Angle grinder", "each", [("115 mm", 699.99)], "750 W angle grinder."),
            ("Cutting discs", "pack", [("10 x 115 mm", 119.99)], "Steel cutting discs."),
            ("Safety boots", "each", [("Size 8", 499.99)], "Steel-toe safety boots."),
        ],
    },
    "paint_finishes": {
        "code": "PF",
        "brands": ["Colour Kasi", "Coat Pro", "Bright Wall"],
        "items": [
            ("PVA paint, white", "tin", [("5 litre", 249.99), ("20 litre", 899.99)], "Interior/exterior PVA."),
            ("Roof paint, red oxide", "tin", [("20 litre", 1299.99)], "Roof and wall paint."),
            ("Enamel paint, gloss white", "tin", [("5 litre", 449.99)], "For doors and trims."),
            ("Paint roller set", "each", [("225 mm", 119.99)], "Roller, tray and extension."),
            ("Paint brush set", "pack", [("5 brushes", 99.99)], "25 to 100 mm brushes."),
            ("Tile adhesive", "bag", [("20 kg", 159.99)], "Floor and wall tile adhesive."),
            ("Tile grout, white", "bag", [("5 kg", 89.99)], "Fine grout."),
            ("Crack filler", "bag", [("2 kg", 64.99)], "Interior crack filler."),
        ],
    },
    "plumbing": {
        "code": "PL",
        "brands": ["Flow Line", "Hot Flow", "Pipe Pro"],
        "items": [
            ("PVC sewer pipe, 110 mm", "length", [("6 m", 349.99)], "Class 34 sewer pipe."),
            ("PVC pipe, 50 mm", "length", [("6 m", 159.99)], "Waste pipe."),
            ("Copper pipe, 15 mm", "length", [("5.5 m", 299.99)], "Class 1 copper pipe."),
            ("HDPE pipe, 20 mm", "roll", [("50 m", 499.99)], "Water supply pipe."),
            ("Close-coupled toilet suite", "each", [("White", 1399.99)], "Pan, cistern and seat."),
            ("Electric geyser", "each", [("150 litre", 5499.99), ("100 litre", 4399.99)], "SABS-approved geyser."),
            ("Pillar tap, chrome", "each", [("15 mm", 189.99)], "Chrome pillar tap."),
            ("Kitchen sink mixer", "each", [("Standard", 699.99)], "Single-lever mixer."),
            ("Stopcock", "each", [("15 mm", 129.99)], "Brass stopcock."),
            ("Thread tape", "pack", [("10 rolls", 49.99)], "PTFE thread tape."),
        ],
    },
    "electrical": {
        "code": "EL",
        "brands": ["Wire Co", "Bright Home", "Volt Safe"],
        "items": [
            ("Surfix cable, 2.5 mm", "roll", [("100 m", 1499.99)], "Twin and earth cable."),
            ("Surfix cable, 1.5 mm", "roll", [("100 m", 999.99)], "Twin and earth cable."),
            ("LED bulb, 9 W", "pack", [("10 bulbs", 179.99)], "Cool white, B22."),
            ("Double switched socket", "each", [("100 x 100 mm", 69.99)], "Double switched socket."),
            ("Light switch, 1-lever", "each", [("100 x 50 mm", 34.99)], "One-lever switch."),
            ("Distribution board", "each", [("8-way", 599.99), ("12-way", 799.99)], "Surface-mount DB."),
            ("Circuit breaker", "each", [("20 A", 89.99)], "Single-pole breaker."),
            ("Earth leakage unit", "each", [("63 A", 449.99)], "30 mA earth leakage."),
            ("PVC conduit, 20 mm", "length", [("4 m", 24.99)], "Conduit pipe."),
            ("Insulation tape", "pack", [("10 rolls", 59.99)], "Black insulation tape."),
        ],
    },
}

WEEKDAYS = {"days": "mon-fri", "open": "07:00", "close": "17:00"}
SATURDAY = {"days": "sat", "open": "08:00", "close": "13:00"}

# The same fictional suppliers the app's mock data shows (frontend/mobile
# .../suppliers/api/mockSupplierData.ts), now in the feed format.
SUPPLIERS = [
    dict(slug="mahlangu-wholesale", external_id="MAHLANGU-001", trading_name="Mahlangu Wholesale", color="#1F2A44",
         about="Groceries, drinks and household goods for spaza shops. Delivered daily across Tembisa.",
         street="14 Andrew Mapheto Drive", suburb="Tembisa", city="Ekurhuleni", postal="1632", lat=-25.999, lng=28.227,
         hours=[WEEKDAYS, SATURDAY], radius=15, fee=3500, free_over=150000, collect=True, in_app=True, cash=True,
         cash_limit=500000, minimum=50000,
         categories=["food_grocery", "beverages", "snacks_confectionery", "household_cleaning", "personal_care", "dairy_chilled"]),
    dict(slug="dlamini-drinks", external_id="DLAMINI-001", trading_name="Dlamini Drinks", color="#2F5D8A",
         about="Cold drinks, juices and snacks by the case.",
         street="3 Isimuku Street", suburb="Tembisa", city="Ekurhuleni", postal="1632", lat=-25.985, lng=28.21,
         hours=[WEEKDAYS], radius=12, fee=2500, free_over=100000, collect=True, in_app=True, cash=False,
         cash_limit=None, minimum=30000, categories=["beverages", "snacks_confectionery"]),
    dict(slug="kasi-bakers", external_id="KASIBAKERS-001", trading_name="Kasi Bakers", color="#8A5A1E",
         about="Fresh bread every morning, baked in Ivory Park.",
         street="22 Mthimkhulu Street", suburb="Ivory Park", city="Midrand", postal="1693", lat=-25.994, lng=28.183,
         hours=[{"days": "mon-sat", "open": "05:00", "close": "14:00"}], radius=8, fee=1500, free_over=50000,
         collect=True, in_app=True, cash=True, cash_limit=200000, minimum=20000, categories=["bakery"]),
    dict(slug="clean-and-care", external_id="CLEANCARE-001", trading_name="Clean & Care Distributors", color="#3B6E5A",
         about="Cleaning, personal care and baby products at wholesale prices.",
         street="8 Monument Road", suburb="Kempton Park", city="Ekurhuleni", postal="1619", lat=-26.1, lng=28.23,
         hours=[WEEKDAYS, SATURDAY], radius=20, fee=5000, free_over=200000, collect=True, in_app=True, cash=True,
         cash_limit=500000, minimum=80000,
         categories=["household_cleaning", "personal_care", "baby_family", "packaging_disposable"]),
    dict(slug="ndlovu-hardware", external_id="NDLOVU-001", trading_name="Ndlovu Hardware", color="#5E5648",
         about="Building materials, plumbing, electrical and tools for builders and trades.",
         street="51 Olifantsfontein Road", suburb="Tembisa", city="Ekurhuleni", postal="1632", lat=-26.01, lng=28.24,
         hours=[WEEKDAYS, SATURDAY], radius=25, fee=25000, free_over=500000, collect=True, in_app=True, cash=True,
         cash_limit=1000000, minimum=100000,
         categories=["building_materials", "tools_hardware", "paint_finishes", "plumbing", "electrical"]),
    dict(slug="midrand-build-and-plumb", external_id="MIDRANDBP-001", trading_name="Midrand Build & Plumb", color="#6B3A2E",
         about="Plumbing and electrical supplies for contractors.",
         street="120 New Road", suburb="Halfway House", city="Midrand", postal="1685", lat=-25.99, lng=28.13,
         hours=[WEEKDAYS], radius=30, fee=35000, free_over=800000, collect=True, in_app=True, cash=False,
         cash_limit=None, minimum=200000, categories=["plumbing", "electrical", "building_materials"]),
    dict(slug="soweto-cash-and-carry", external_id="SOWETOCC-001", trading_name="Soweto Cash & Carry", color="#4A4E8A",
         about="Groceries, drinks and snacks for Soweto traders.",
         street="9 Chris Hani Road", suburb="Dube", city="Soweto", postal="1818", lat=-26.24, lng=27.9,
         hours=[WEEKDAYS, SATURDAY], radius=20, fee=4000, free_over=150000, collect=True, in_app=True, cash=True,
         cash_limit=400000, minimum=40000,
         categories=["food_grocery", "beverages", "household_cleaning", "snacks_confectionery"]),
]


def check_digit(body: str) -> str:
    """GS1 check digit: weights 3, 1, 3... from the right (any GTIN length)."""
    total = sum(int(d) * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(body)))
    return str((10 - total % 10) % 10)


def ean13(first12: str) -> str:
    return first12 + check_digit(first12)


def gtin14_for_case(unit_ean13: str) -> str:
    """The outer case's GTIN-14: indicator digit 1 + the item's first 12 digits."""
    body = "1" + unit_ean13[:12]
    return body + check_digit(body)


_MULTI = re.compile(r"^(\d+) x ([\d.]+) (g|kg|ml|litre)")
_COUNT = re.compile(r"^(\d+) (pieces|rolls|bulbs|brushes|razors|pads|bags|cups|containers)$")
_SINGLE = re.compile(r"^([\d.]+) (kg|litre)$")


def units_in(pack: str) -> int:
    m = _MULTI.match(pack) or _COUNT.match(pack)
    return int(m.group(1)) if m else 1


def weight_kg(pack: str) -> str:
    """Roughly (liquids as 1 kg per litre); blank when the pack size doesn't say."""
    m = _MULTI.match(pack)
    if m:
        n, size, unit = int(m.group(1)), float(m.group(2)), m.group(3)
        kg = n * size / 1000 if unit in ("g", "ml") else n * size
        return f"{kg:.3f}".rstrip("0").rstrip(".")
    m = _SINGLE.match(pack)
    return m.group(1) if m else ""


def to_rands(cents: int) -> str:
    return f"{cents // 100}.{cents % 100:02d}"


def price_cents(rands: float, factor: float) -> int:
    """Wholesale-style price ending in 9 cents (e.g. R189.99, R86.49)."""
    cents = int(round(rands * factor * 100))
    return max(99, cents - cents % 10 + 9)


def supplier_json(s: dict) -> dict:
    return {
        "external_id": s["external_id"],
        "trading_name": s["trading_name"],
        "legal_name": f"{s['trading_name']} (Pty) Ltd",
        "about": s["about"],
        "vat_number": None,
        "orders_email": f"orders@{s['slug']}.example.com",
        "phone": None,
        "brand_color": s["color"],
        "collection_address": {
            "street": s["street"], "suburb": s["suburb"], "city": s["city"], "province": "Gauteng",
            "postal_code": s["postal"], "latitude": s["lat"], "longitude": s["lng"],
        },
        "hours": s["hours"],
        "delivery": {"offers": True, "radius_km": s["radius"], "fee_cents": s["fee"], "free_over_cents": s["free_over"]},
        "collect": s["collect"],
        "payments": {"in_app": s["in_app"], "cash": s["cash"], "cash_limit_cents": s["cash_limit"]},
        "minimum_order_cents": s["minimum"],
        "categories": s["categories"],
        "payout": {"merchant_id": None},
    }


def products(s: dict, supplier_no: int) -> list[dict]:
    rnd = random.Random(s["external_id"])
    supplier_factor = 0.95 + rnd.random() * 0.10  # this supplier is a bit cheaper or dearer
    combos = []
    for category in s["categories"]:
        spec = CATALOGUE[category]
        for item_no, (name, unit, packs, description) in enumerate(spec["items"]):
            for pack_no, (pack, rands) in enumerate(packs):
                for brand_no, brand in enumerate(spec["brands"]):
                    combos.append((category, spec["code"], item_no, pack_no, brand_no, name, unit, pack, rands, description, brand))
    keep = min(1.0, TARGET_PER_SUPPLIER / max(len(combos), 1))
    rows = []
    for c in combos:
        category, code, item_no, pack_no, brand_no, name, unit, pack, rands, description, brand = c
        if keep < 1.0 and rnd.random() > keep:
            continue
        brand_factor = (0.92, 1.0, 1.08)[brand_no]  # a budget, a middle and a premium brand
        price = price_cents(rands, supplier_factor * brand_factor * (0.98 + rnd.random() * 0.04))
        roll = rnd.random()
        stock = 0 if roll < 0.07 else rnd.randint(1, 10) if roll < 0.18 else rnd.randint(11, 400)
        on_sale = rnd.random() < 0.18
        compare_at = price_cents(price / 100, 1.12 + rnd.random() * 0.13) if on_sale else None
        if compare_at is not None and compare_at <= price:
            compare_at = None
        bulky = unit in ("pallet", "cube", "each") and rands > 500
        unit_barcode = ean13(f"2{supplier_no:02d}{len(rows):09d}")
        per_pack = units_in(pack)
        rows.append({
            "product_code": f"{s['external_id'].split('-')[0][:6]}-{code}-{item_no:02d}{pack_no}{brand_no}",
            "name": name,
            "brand": brand,
            "category": category,
            "unit": unit,
            "pack_size": pack,
            "units_per_pack": str(per_pack),
            "price_rands": to_rands(price),
            "compare_at_rands": to_rands(compare_at) if compare_at else "",
            "vat_rate": "zero" if name in ZERO_RATED else "standard",
            "vat_included": "true",
            "stock": str(stock),
            "min_qty": "1",
            "max_qty": "20" if bulky else "200",
            "unit_barcode": unit_barcode,
            "case_barcode": gtin14_for_case(unit_barcode) if per_pack > 1 else "",
            "weight_kg": weight_kg(pack),
            "description": description,
            "active": "true",
        })
    return rows


def main() -> None:
    columns = [
        "product_code", "name", "brand", "category", "unit", "pack_size", "units_per_pack",
        "price_rands", "compare_at_rands", "vat_rate", "vat_included", "stock", "min_qty", "max_qty",
        "unit_barcode", "case_barcode", "weight_kg", "description", "active",
    ]
    total = 0
    for number, s in enumerate(SUPPLIERS, start=1):
        folder = OUT / s["slug"]
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "supplier.json").write_text(json.dumps(supplier_json(s), indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
        rows = products(s, number)
        with (folder / "products.csv").open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=columns, lineterminator="\n")  # same bytes on every OS
            writer.writeheader()
            writer.writerows(rows)
        total += len(rows)
        print(f"  {s['trading_name']}: {len(rows)} products")
    print(f"{len(SUPPLIERS)} suppliers, {total} products -> {OUT}")


if __name__ == "__main__":
    main()
