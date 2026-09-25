"""
The trader's profile photo. The phone uploads straight to Cloudinary; this
backend never carries the image bytes (see src/shared/media).

  upload_form(user)          a signed form for ONE file in this trader's
                             own folder
  keep(user, public_id)      after the phone's upload: checked by
                             shared.media (ownership, real size, daily
                             limit), then shown on the profile
  remove(user)               photo gone, file deleted
  apply_verdict(verdict)     malware-scan result (only when scanning is on)

Replacing a photo deletes the old file. With scanning on, a new photo stays
hidden until the scan approves it; with scanning off, it shows at once.
"""
from __future__ import annotations

from typing import Optional

from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E
from src.shared.media import folders, uploads
from src.shared.media.models import ScanStatus
from src.shared.media.provider import ScanVerdict, UploadForm, get_provider

from ..models import BusinessProfileImage
from ..repositories import business_profile_repository as profiles
from . import profile_audit

PURPOSE = "trader_profile_photo"
#: What a phone may send (Cloudinary shrinks it on the way in anyway).
MAX_BYTES = 5 * 1024 * 1024
#: What is stored: a profile photo never needs more.
STORED_MAX_PX = 800


def upload_form(user) -> UploadForm:
    return uploads.start(user.id, PURPOSE, folders.informal_trader_profile_folder(user.id), STORED_MAX_PX)


def keep(user, public_id: str):
    stored = uploads.finish(user.id, PURPOSE, public_id, MAX_BYTES)
    _remove_current(user.id)
    profile = profiles.for_user(user.id) or profiles.create(user.id)  # a photo can come before the first answers
    image = BusinessProfileImage(
        user_id=user.id, public_id=stored.public_id, url=stored.url, format=stored.format,
        width=stored.width, height=stored.height, bytes=stored.bytes,
    )
    db.session.add(image)
    if not get_provider().scanning():
        image.scan_status = ScanStatus.APPROVED.value  # no scan requested: no verdict will come
        profile.profile_image_url = image.url
    db.session.commit()
    profile_audit.record(E.PROFILE_IMAGE_UPLOADED, user_id=user.id, bytes=stored.bytes, scan_status=image.scan_status)
    return profile


def remove(user):
    _remove_current(user.id)
    profile = profiles.for_user(user.id)
    if profile:
        profile.profile_image_url = None
    db.session.commit()
    profile_audit.record(E.PROFILE_IMAGE_REMOVED, user_id=user.id)
    return profile


def apply_verdict(verdict: ScanVerdict) -> None:
    """Idempotent: a verdict for a photo that's already decided (or gone) is ignored."""
    image = BusinessProfileImage.query.filter_by(public_id=verdict.public_id, is_deleted=False).first()
    if image is None or image.scan_status != ScanStatus.PENDING.value:
        return
    if verdict.outcome == "approved":
        image.scan_status = ScanStatus.APPROVED.value
        profile = profiles.for_user(image.user_id) or profiles.create(image.user_id)
        profile.profile_image_url = image.url
    else:
        image.scan_status = ScanStatus.REJECTED.value
        uploads.delete_file(image.public_id)
        image.soft_delete()
        profile_audit.record(E.PROFILE_IMAGE_REJECTED, ok=False, user_id=image.user_id, reason="malware_scan")
    db.session.commit()


def _current(user_id) -> Optional[BusinessProfileImage]:
    return BusinessProfileImage.query.filter_by(user_id=user_id, is_deleted=False).first()


def _remove_current(user_id) -> None:
    existing = _current(user_id)
    if existing is not None:
        uploads.delete_file(existing.public_id)
        existing.soft_delete()
