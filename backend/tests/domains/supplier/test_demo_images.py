"""
The seed's demo images (seed/demo_images/, seed/demo_images.csv): every
image has its row, every logo belongs to a real seed supplier, every link
is on our Cloudinary (the feed refuses anything else), and the generated
supplier.json carries it (generate_dataset.py was run after the upload).
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

from src.shared.media.public_urls import is_our_image_url

SEED = Path(__file__).resolve().parents[3] / "seed"


def manifest() -> dict[str, str]:
    with (SEED / "demo_images.csv").open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    assert all(r["source"].strip() and r["licence"].strip() for r in rows), "every image says where it came from"
    return {r["key"]: r["image_url"] for r in rows}


def test_every_demo_image_has_its_row_and_its_supplier():
    links = manifest()
    images = {p.stem for p in (SEED / "demo_images").iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png")}
    suppliers = {p.name for p in (SEED / "suppliers").iterdir() if p.is_dir()}
    logos = {k.removeprefix("logo:") for k in links if k.startswith("logo:")}
    assert images == logos
    assert logos <= suppliers


def test_every_link_is_ours_and_in_the_supplier_feed():
    for key, url in manifest().items():
        assert is_our_image_url(url), key
        if key.startswith("logo:"):
            feed = json.loads((SEED / "suppliers" / key.removeprefix("logo:") / "supplier.json").read_text(encoding="utf-8"))
            assert feed["logo_url"] == url, f"{key}: run python seed/generate_dataset.py"
