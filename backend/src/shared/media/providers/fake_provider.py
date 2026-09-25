"""
FakeMediaProvider -- for the automated tests (MEDIA_PROVIDER=fake). Talks
to nothing. Signatures are deterministic, and "uploads" are whatever a
test puts in `uploaded` (public_id -> UploadedAsset), standing in for a
phone that really posted a file to Cloudinary.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from src.shared.media.providers.provider import MediaProvider, ScanResult, SignedUpload, UploadedAsset


class FakeMediaProvider(MediaProvider):
    def __init__(self):
        self.uploaded: Dict[str, UploadedAsset] = {}
        self.deleted: List[str] = []
        self.moderation = False

    def generate_signed_upload(self, public_id: str, max_dimension_px: int, asset_folder: str) -> SignedUpload:
        return SignedUpload(
            cloud_name="fake-cloud", api_key="fake-key", timestamp=0, signature="fake-signature",
            public_id=public_id, upload_url="https://api.cloudinary.com/v1_1/fake-cloud/image/upload",
            allowed_formats="jpg,jpeg,png,webp", transformation=f"c_limit,w_{max_dimension_px},h_{max_dimension_px},q_auto",
            notification_url="", moderation="", asset_folder=asset_folder,
        )

    def upload_asset(self, public_id, file_bytes, max_dimension_px, asset_folder, resource_type="image") -> UploadedAsset:
        asset = UploadedAsset(public_id, f"https://res.cloudinary.com/fake-cloud/image/upload/{public_id}.jpg", resource_type, "jpg", 100, 100, len(file_bytes))
        self.uploaded[public_id] = asset
        return asset

    def fetch_asset(self, public_id: str) -> Optional[UploadedAsset]:
        return self.uploaded.get(public_id)

    def is_moderation_enabled(self) -> bool:
        return self.moderation

    def verify_webhook_signature(self, raw_body: str, timestamp: str, signature: str) -> bool:
        return signature == "valid"

    def parse_scan_result(self, payload: dict) -> ScanResult:
        status = {"approved": "APPROVED", "rejected": "REJECTED"}.get(payload.get("moderation_status", ""), "IGNORED")
        return ScanResult(public_id=payload.get("public_id", ""), status=status, provider="fake")

    def delete_asset(self, public_id: str) -> None:
        self.deleted.append(public_id)
        self.uploaded.pop(public_id, None)

    def delete_assets(self, public_ids: List[str]) -> None:
        for p in public_ids:
            self.delete_asset(p)

    def delete_folder(self, folder_path: str) -> None:
        pass
