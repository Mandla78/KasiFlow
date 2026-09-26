"""
Uploads the demo images in seed/demo_images/ to OUR Cloudinary and writes
their links into seed/demo_images.csv, where generate_dataset.py picks them
up (docs/HANDOFF.txt: supplier photos are wired through demo_images.csv).

    python seed/upload_demo_images.py      (from backend/, development only)
    python seed/generate_dataset.py        (the links go into supplier.json)
    flask suppliers load                   (and into the database)

  seed/demo_images/<slug>.jpg  ->  logo:<slug>  (that supplier's logo)

Each file goes to <MEDIA_ROOT_FOLDER>/demo/suppliers/<slug> through the
same signed upload a phone uses (shared/media), so the keys stay in .env
and never leave the server. A file that's already there is reused: safe to
run twice. Only links on our own cloud are written, because the supplier
feed refuses any other image host.
"""
from __future__ import annotations

import csv
import os
import sys
from pathlib import Path

import requests

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND / ".env")

from src import create_app  # noqa: E402
from src.shared.media import folders  # noqa: E402
from src.shared.media.provider import get_provider  # noqa: E402
from src.shared.media.public_urls import is_our_image_url  # noqa: E402

IMAGES = Path(__file__).resolve().parent / "demo_images"
MANIFEST = Path(__file__).resolve().parent / "demo_images.csv"
FIELDS = ["key", "image_url", "source", "licence"]
SOURCE = "Team demo artwork: the logo on the supplier's delivery truck, cropped from our banner (supplied by Risuna)"
LICENCE = "Team-owned, for the demo; the companies are fictional"
#: Stored at most this wide on Cloudinary (a logo is shown at 200 px).
MAX_PX = 800


def upload(path: Path, folder: str) -> str:
    provider = get_provider()
    public_id = f"{folder}/{path.stem}"
    found = provider.find(public_id)
    if found is None:
        form = provider.upload_form(public_id, folder, MAX_PX)
        with path.open("rb") as f:
            r = requests.post(form.url, data=form.fields, files={"file": f}, timeout=60)
        if r.status_code >= 300:
            sys.exit(f"Couldn't upload {path.name} ({r.status_code}): check the Cloudinary keys in .env.")
        found = provider.find(public_id)
        print(f"  uploaded {path.name}")
    else:
        print(f"  {path.name} was already there")
    if found is None or not is_our_image_url(found.url):
        sys.exit(f"{path.name}: the stored link isn't on our Cloudinary, so the supplier feed would refuse it.")
    return found.url


def write_manifest(links: dict[str, str]) -> None:
    """Adds or replaces the rows for these keys; every other row stays as it was."""
    rows: list[dict[str, str]] = []
    if MANIFEST.is_file():
        with MANIFEST.open(encoding="utf-8", newline="") as f:
            rows = [r for r in csv.DictReader(f) if r.get("key", "").strip() not in links]
    rows += [{"key": k, "image_url": url, "source": SOURCE, "licence": LICENCE} for k, url in sorted(links.items())]
    with MANIFEST.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows({k: r.get(k, "") for k in FIELDS} for r in rows)


def main() -> None:
    app = create_app("development")
    if app.config.get("ENV_NAME") != "development":
        sys.exit("Development only.")
    if os.environ.get("MEDIA_PROVIDER", "").lower() == "fake":
        sys.exit("MEDIA_PROVIDER is fake here: set the Cloudinary keys in .env to upload.")
    files = sorted(p for p in IMAGES.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png"))
    if not files:
        sys.exit(f"No images in {IMAGES}.")
    with app.app_context():
        folder = f"{folders.root()}/demo/suppliers"
        links = {f"logo:{p.stem}": upload(p, folder) for p in files}
    write_manifest(links)
    print(f"Done: {len(links)} link(s) in {MANIFEST.name}. Next: python seed/generate_dataset.py, then flask suppliers load.")


if __name__ == "__main__":
    main()
