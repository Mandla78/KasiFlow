"""
The trader's profile photo. The phone uploads straight to Cloudinary; this
backend never carries the image bytes. Three calls:

  request_upload_signature(user)   a one-upload signature for exactly one
                                   public_id in this trader's own folder
  register(user, public_id)        after the phone's upload: checked, then
                                   shown on the profile
  remove(user)                     photo removed, asset deleted

NOTHING THE PHONE REPORTS ABOUT THE FILE IS TRUSTED. Registration asks
Cloudinary itself for the asset (real URL, real size): a phone can't
register a link to another website, or understate a file's size.

Replacing a photo removes the old one (row soft-deleted, asset deleted).
When malware scanning is on, a new photo stays hidden until Cloudinary's
webhook approves it (apply_scan_result); when it's off, it's shown at once.
"""
from __future__ import annotations

import uuid
from typing import Optional

from src.core.exceptions import AppError, NotFoundError
from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E
from src.shared.media import folder_naming
from src.shared.media.intents.services import cancel_intent, create_intent, mark_registered
from src.shared.media.ledger.services import check_quota_before_upload, record_upload
from src.shared.media.mixins import MediaScanStatus
from src.shared.media.providers.composition import get_media_provider
from src.shared.media.providers.provider import ScanResult, SignedUpload

from ..models import BusinessProfileImage
from ..repositories import business_profile_repository as profiles
from . import profile_audit

LEDGER_DOMAIN = "trader_profile"
#: What a phone may send (Cloudinary shrinks it on the way in anyway).
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
#: What is stored: a profile photo never needs more.
STORED_MAX_PX = 800


class ImageTooLargeError(AppError):
    status_code = 422
    code = "IMAGE_TOO_LARGE"


def request_upload_signature(user) -> SignedUpload:
    folder = folder_naming.informal_trader_profile_folder(user.id)
    public_id = f"{folder}/profile-{uuid.uuid4()}"
    create_intent(user.id, LEDGER_DOMAIN, public_id)
    return get_media_provider().generate_signed_upload(public_id, STORED_MAX_PX, folder)


def register(user, public_id: str):
    # Only this trader's own folder: another account's public_id never matches.
    if not public_id.startswith(folder_naming.informal_trader_profile_folder(user.id) + "/"):
        raise NotFoundError("Image upload not found.", code="MEDIA_NOT_FOUND")

    provider = get_media_provider()
    asset = provider.fetch_asset(public_id)
    if asset is None:
        raise NotFoundError("Image upload not found.", code="MEDIA_NOT_FOUND")
    if (asset.bytes or 0) > MAX_UPLOAD_BYTES:
        _best_effort_delete(public_id)
        cancel_intent(public_id)
        raise ImageTooLargeError("That photo is too large. Choose one under 5 MB.")
    check_quota_before_upload(user.id, asset.bytes or 0)

    _remove_current(user)
    if profiles.for_user(user.id) is None:
        profiles.create(user.id)  # a photo can come before the first answers
    image = BusinessProfileImage(
        user_id=user.id,
        cloudinary_public_id=asset.public_id,
        secure_url=asset.secure_url,
        resource_type=asset.resource_type,
        format=asset.format,
        width=asset.width,
        height=asset.height,
        bytes=asset.bytes,
    )
    db.session.add(image)
    if not provider.is_moderation_enabled():
        # No scan was requested, so no verdict will ever arrive: trust it now.
        image.scan_status = MediaScanStatus.APPROVED.value
        image.scan_provider = "none"
        _promote(user.id, image)
    db.session.commit()

    record_upload(user.id, LEDGER_DOMAIN, asset.bytes or 0)
    mark_registered(public_id)
    profile_audit.record(E.PROFILE_IMAGE_UPLOADED, user_id=user.id, bytes=asset.bytes, scan_status=image.scan_status)
    return profiles.for_user(user.id)


def remove(user):
    _remove_current(user)
    profile = profiles.for_user(user.id)
    if profile:
        profile.profile_image_url = None
    db.session.commit()
    profile_audit.record(E.PROFILE_IMAGE_REMOVED, user_id=user.id)
    return profile


def apply_scan_result(result: ScanResult) -> None:
    """Cloudinary's scan verdict (webhook). Idempotent: webhooks retry."""
    if result.status == "IGNORED":
        return
    image = BusinessProfileImage.query.filter_by(cloudinary_public_id=result.public_id, is_deleted=False).first()
    if image is None or image.scan_status != MediaScanStatus.PENDING.value:
        return
    image.scan_status = result.status
    image.scan_provider = result.provider
    image.scan_result = result.raw_result
    if result.status == MediaScanStatus.APPROVED.value:
        _promote(image.user_id, image)
    else:
        _best_effort_delete(image.cloudinary_public_id)
        image.soft_delete()
        profile_audit.record(E.PROFILE_IMAGE_REJECTED, ok=False, user_id=image.user_id, reason=result.status.lower())
    db.session.commit()


def _current(user_id) -> Optional[BusinessProfileImage]:
    return BusinessProfileImage.query.filter_by(user_id=user_id, is_deleted=False).first()


def _remove_current(user) -> None:
    existing = _current(user.id)
    if existing is not None:
        _best_effort_delete(existing.cloudinary_public_id)
        existing.soft_delete()


def _promote(user_id, image: BusinessProfileImage) -> None:
    profile = profiles.for_user(user_id) or profiles.create(user_id)
    profile.profile_image_url = image.secure_url


def _best_effort_delete(public_id: str) -> None:
    try:
        get_media_provider().delete_asset(public_id)
    except Exception:  # noqa: BLE001 -- clean-up must never break the caller
        pass
