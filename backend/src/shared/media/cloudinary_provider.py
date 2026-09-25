"""
Cloudinary -- the only file that imports the Cloudinary SDK.

Settings (backend/.env): CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
CLOUDINARY_API_SECRET; optional CLOUDINARY_WEBHOOK_BASE_URL (public https
address of this backend, for scan callbacks) and
CLOUDINARY_MODERATION_ENABLED=true (needs the Perception Point add-on).

TWO NAMES FOR ONE PLACE: public_id is the file's permanent address;
asset_folder is where it shows in Cloudinary's Media Library. Accounts
made since mid-2024 use "dynamic folders", where a file without
asset_folder is findable by search but invisible in the folder tree, so
both are always set to the same folder.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import time
from typing import Optional

import cloudinary
import cloudinary.api
import cloudinary.exceptions
import cloudinary.uploader
import cloudinary.utils

from .provider import MediaProvider, ScanVerdict, StoredFile, UploadForm

IMAGE_FORMATS = "jpg,jpeg,png,webp"
#: A callback older than this is refused even with a valid signature (replays).
CALLBACK_MAX_AGE_SECONDS = 2 * 3600
CALLBACK_PATH = "/api/v1/media/webhooks/cloudinary-notifications"


class CloudinaryProvider(MediaProvider):
    def __init__(self, cloud_name: str, api_key: str, api_secret: str, callback_base_url: str = "", scan: bool = False):
        self._cloud = cloud_name
        self._key = api_key
        self._secret = api_secret
        self._callback_url = f"{callback_base_url.rstrip('/')}{CALLBACK_PATH}" if callback_base_url else ""
        self._scan = scan
        cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)

    @classmethod
    def from_env(cls) -> "CloudinaryProvider":
        return cls(
            os.environ.get("CLOUDINARY_CLOUD_NAME", ""),
            os.environ.get("CLOUDINARY_API_KEY", ""),
            os.environ.get("CLOUDINARY_API_SECRET", ""),
            os.environ.get("CLOUDINARY_WEBHOOK_BASE_URL", ""),
            os.environ.get("CLOUDINARY_MODERATION_ENABLED", "false").lower() == "true",
        )

    def upload_form(self, public_id: str, folder: str, max_px: int) -> UploadForm:
        signed = {
            "timestamp": str(int(time.time())),
            "public_id": public_id,
            "asset_folder": folder,
            "allowed_formats": IMAGE_FORMATS,
            # Shrink on the way in: we store at most max_px, whatever the phone sends.
            "transformation": f"c_limit,w_{max_px},h_{max_px},q_auto",
        }
        if self._callback_url:
            signed["notification_url"] = self._callback_url
        if self._scan:
            signed["moderation"] = "perception_point"
        signature = cloudinary.utils.api_sign_request(dict(signed), self._secret)
        return UploadForm(
            url=f"https://api.cloudinary.com/v1_1/{self._cloud}/image/upload",
            fields={**signed, "api_key": self._key, "signature": signature},
        )

    def find(self, public_id: str) -> Optional[StoredFile]:
        try:
            r = cloudinary.api.resource(public_id)
        except cloudinary.exceptions.NotFound:
            return None
        return StoredFile(r["public_id"], r["secure_url"], r.get("format"), r.get("width"), r.get("height"), int(r.get("bytes") or 0))

    def delete(self, public_id: str) -> None:
        cloudinary.uploader.destroy(public_id, invalidate=True)

    def scanning(self) -> bool:
        return self._scan

    def callback_is_genuine(self, body: str, timestamp: str, signature: str) -> bool:
        """Cloudinary signs a callback as hex(SHA1(body + timestamp + api_secret));
        accounts set to SHA-256 use that instead (a 64-character signature)."""
        try:
            age = abs(time.time() - int(timestamp))
        except (TypeError, ValueError):
            return False
        if not signature or not self._secret or age > CALLBACK_MAX_AGE_SECONDS:
            return False
        algorithm = hashlib.sha256 if len(signature) == 64 else hashlib.sha1
        expected = algorithm(f"{body}{timestamp}{self._secret}".encode("utf-8")).hexdigest()
        return hmac.compare_digest(expected, signature)

    def read_verdict(self, payload: dict) -> ScanVerdict:
        # Two shapes exist: a flat moderation_status, or moderation[0].status.
        status = payload.get("moderation_status")
        if status is None and isinstance(payload.get("moderation"), list) and payload["moderation"]:
            status = payload["moderation"][0].get("status")
        # "file received" callbacks carry no verdict, and "pending" means queued, not decided.
        outcome = {"approved": "approved", "rejected": "rejected"}.get(str(status or "").lower(), "none")
        return ScanVerdict(payload.get("public_id", ""), outcome)
