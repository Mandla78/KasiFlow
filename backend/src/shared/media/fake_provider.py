"""
A stand-in for Cloudinary in the automated tests (MEDIA_PROVIDER=fake).
Talks to nothing. A test "uploads" a file by putting it in `files`, the way
a phone would post it to Cloudinary; callbacks signed "valid" are genuine.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from .provider import MediaProvider, ScanVerdict, StoredFile, UploadForm


class FakeProvider(MediaProvider):
    def __init__(self):
        self.files: Dict[str, StoredFile] = {}
        self.deleted: List[str] = []
        self.scan = False

    def put(self, public_id: str, size: int = 200_000) -> StoredFile:
        """What the phone's upload to Cloudinary would have created."""
        f = StoredFile(public_id, f"https://res.cloudinary.com/fake/image/upload/v1/{public_id}.jpg", "jpg", 800, 800, size)
        self.files[public_id] = f
        return f

    def upload_form(self, public_id: str, folder: str, max_px: int) -> UploadForm:
        return UploadForm("https://api.cloudinary.com/v1_1/fake/image/upload", {"public_id": public_id, "asset_folder": folder, "signature": "fake"})

    def find(self, public_id: str) -> Optional[StoredFile]:
        return self.files.get(public_id)

    def delete(self, public_id: str) -> None:
        self.deleted.append(public_id)
        self.files.pop(public_id, None)

    def scanning(self) -> bool:
        return self.scan

    def callback_is_genuine(self, body: str, timestamp: str, signature: str) -> bool:
        return signature == "valid"

    def read_verdict(self, payload: dict) -> ScanVerdict:
        status = str(payload.get("moderation_status", "")).lower()
        return ScanVerdict(payload.get("public_id", ""), status if status in ("approved", "rejected") else "none")
