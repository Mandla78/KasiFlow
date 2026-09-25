"""
The product categories: ONE list for the whole backend. A trader picks
from it ("what you buy"), a supplier sells from it, every product is in
one, and the supplier recommendation engine matches on it.

It MUST match the app's frontend/mobile/src/constants/categories.ts.
Removing a code needs a data migration for rows that hold it (see
migrations/versions/0013_drop_airtime_category.py).
"""
from __future__ import annotations

CATEGORIES = (
    "food_grocery", "beverages", "snacks_confectionery", "bakery", "dairy_chilled", "fresh_produce",
    "meat_frozen", "household_cleaning", "personal_care", "baby_family", "packaging_disposable",
    "stationery_school", "clothing_apparel", "fragrances_beauty", "phone_accessories",
    "building_materials", "plumbing", "electrical", "tools_hardware", "paint_finishes", "other",
)
