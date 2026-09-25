"""
Where every uploaded file lives on Cloudinary. ONE place every feature's
upload path calls into.

ORGANISED BY WHO OWNS THE FILE, then what it is, so one trader's or one
supplier's whole folder can be browsed (or removed) in one place:

    akayza/informal-trader/{key}/profile/{asset}                 profile photo       [BUILT]
    akayza/informal-trader/{key}/jobs/{job-key}/{asset}          job photos (builders: proof of each stage)
    akayza/supplier/{key}/profile/{asset}                        supplier logo / photo
    akayza/supplier/{key}/products/{product-key}/{asset}         product images
    akayza/supplier/{key}/categories/{asset}                     category images

The root is MEDIA_ROOT_FOLDER ("akayza"; "akayza-dev" in development), so
test uploads never mix with real ones.

{key} IS NOT OUR DATABASE ID. It is an HMAC-SHA256 of the id keyed with
SECRET_KEY: the same account always gets the same key (so building a path
and checking one agree), but the real id can't be recovered from a URL.
Ownership is still always enforced by the signed-in user plus a database
check; the key only avoids leaking internal ids to a third party.

Two Cloudinary concepts use the same string: public_id (the permanent URL)
and asset_folder (where it shows in the Media Library). Both are always
set together (see providers/cloudinary_provider.py).

Read via os.environ, not current_app, so background jobs build identical
paths.
"""
from __future__ import annotations

import hashlib
import hmac
import os

INFORMAL_TRADER = "informal-trader"
SUPPLIER = "supplier"


def root() -> str:
    return os.environ.get("MEDIA_ROOT_FOLDER", "akayza").strip("/") or "akayza"


def _key(real_id) -> str:
    """128 bits of HMAC: unique per account, stable, not reversible."""
    secret = os.environ.get("SECRET_KEY", "").encode("utf-8")
    return hmac.new(secret, str(real_id).encode("utf-8"), hashlib.sha256).hexdigest()[:32]


# ---------------------------------------------------------------- informal trader


def informal_trader_folder(user_id) -> str:
    return f"{root()}/{INFORMAL_TRADER}/{_key(user_id)}"


def informal_trader_profile_folder(user_id) -> str:
    return f"{informal_trader_folder(user_id)}/profile"


def informal_trader_job_folder(user_id, job_id) -> str:
    return f"{informal_trader_folder(user_id)}/jobs/{_key(job_id)}"


def is_informal_trader_profile_asset(public_id: str) -> bool:
    return f"/{INFORMAL_TRADER}/" in public_id and "/profile/" in public_id


def is_informal_trader_job_asset(public_id: str) -> bool:
    return f"/{INFORMAL_TRADER}/" in public_id and "/jobs/" in public_id


# ------------------------------------------------------------------------ supplier


def supplier_folder(supplier_id) -> str:
    return f"{root()}/{SUPPLIER}/{_key(supplier_id)}"


def supplier_profile_folder(supplier_id) -> str:
    return f"{supplier_folder(supplier_id)}/profile"


def supplier_product_folder(supplier_id, product_id) -> str:
    return f"{supplier_folder(supplier_id)}/products/{_key(product_id)}"


def supplier_category_folder(supplier_id) -> str:
    return f"{supplier_folder(supplier_id)}/categories"


def is_supplier_profile_asset(public_id: str) -> bool:
    return f"/{SUPPLIER}/" in public_id and "/profile/" in public_id


def is_supplier_product_asset(public_id: str) -> bool:
    return f"/{SUPPLIER}/" in public_id and "/products/" in public_id


def is_supplier_category_asset(public_id: str) -> bool:
    return f"/{SUPPLIER}/" in public_id and "/categories/" in public_id
