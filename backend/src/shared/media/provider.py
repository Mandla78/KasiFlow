"""
What Akayza needs from a file-storage service, and which one is in use.

Features never talk to Cloudinary directly: they go through uploads.py,
which uses get_provider(). Swapping Cloudinary for another service means
one new class that implements MediaProvider.

Settings come from the environment (not Flask's config) so the clean-up
job builds the same provider as a request does.
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class UploadForm:
    """Where the phone posts the file, and the exact form fields to send
    with it (the file itself goes in the field "file")."""

    url: str
    fields: dict


@dataclass(frozen=True)
class StoredFile:
    """What the storage service itself reports about a stored file."""

    public_id: str
    url: str
    format: Optional[str]
    width: Optional[int]
    height: Optional[int]
    bytes: int


@dataclass(frozen=True)
class ScanVerdict:
    """A malware-scan result from a callback. outcome: approved, rejected,
    or none (a callback that carries no verdict, e.g. "file received")."""

    public_id: str
    outcome: str


class MediaProvider(ABC):
    @abstractmethod
    def upload_form(self, public_id: str, folder: str, max_px: int) -> UploadForm:
        """A signed form for ONE upload: exactly this public_id, in this
        folder, images only, shrunk to max_px on the way in. Signing is
        local; no secret ever goes to the phone."""

    @abstractmethod
    def find(self, public_id: str) -> Optional[StoredFile]:
        """The stored file, or None if nothing was uploaded under it."""

    @abstractmethod
    def delete(self, public_id: str) -> None:
        """Remove the file. Deleting something that isn't there is fine."""

    @abstractmethod
    def scanning(self) -> bool:
        """Is a malware scan requested for new uploads?"""

    @abstractmethod
    def callback_is_genuine(self, body: str, timestamp: str, signature: str) -> bool:
        """Did this callback really come from the storage service?"""

    @abstractmethod
    def read_verdict(self, payload: dict) -> ScanVerdict:
        """The scan result in a callback, in our own terms."""


_provider: Optional[MediaProvider] = None


def get_provider() -> MediaProvider:
    """MEDIA_PROVIDER=cloudinary (default) or fake (the automated tests)."""
    global _provider
    if _provider is None:
        if os.environ.get("MEDIA_PROVIDER", "cloudinary") == "fake":
            from .fake_provider import FakeProvider

            _provider = FakeProvider()
        else:
            from .cloudinary_provider import CloudinaryProvider

            _provider = CloudinaryProvider.from_env()
    return _provider


def reset_provider() -> None:
    """Tests: start each test with a fresh provider."""
    global _provider
    _provider = None
