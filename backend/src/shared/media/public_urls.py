"""
Image LINKS in data feeds (a supplier's logo, product photos).

A supplier's system sends links, not files. We accept only links to OUR
Cloudinary account (https://res.cloudinary.com/<our cloud>/image/upload/...):
a feed must never make the app load images from any site it likes (tracking
pixels, swapped content, slow hosts). Anything else is refused at import.

delivery_url() adds Cloudinary's resize-on-delivery (auto format, auto
quality, width-limited), so a phone on slow data gets a small image.
"""
from __future__ import annotations

import os
import re
from urllib.parse import urlsplit

MAX_URL_LENGTH = 500
_SAFE_PATH = re.compile(r"^[A-Za-z0-9/_.,\-]+$")


def _cloud() -> str:
    return os.environ.get("CLOUDINARY_CLOUD_NAME", "")


def is_our_image_url(url: str) -> bool:
    if not url or len(url) > MAX_URL_LENGTH:
        return False
    parts = urlsplit(url)
    cloud = _cloud()
    return (
        bool(cloud)
        and parts.scheme == "https"
        and parts.netloc == "res.cloudinary.com"
        and not parts.query
        and not parts.fragment
        and parts.path.startswith(f"/{cloud}/image/upload/")
        and bool(_SAFE_PATH.match(parts.path))
        and ".." not in parts.path
    )


def delivery_url(url: str, width: int) -> str:
    """The same image, resized on Cloudinary's side for a phone screen."""
    marker = "/image/upload/"
    head, _, tail = url.partition(marker)
    if not tail or tail.startswith(("f_", "q_", "c_", "w_")):  # not ours, or already transformed
        return url
    return f"{head}{marker}f_auto,q_auto,c_limit,w_{width}/{tail}"
