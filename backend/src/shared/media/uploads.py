"""
The three calls a feature makes for an upload (see __init__.py for the flow):

    form = uploads.start(user_id, purpose, folder, max_px)
    file = uploads.finish(user_id, purpose, public_id, max_bytes)
    uploads.cancel(public_id)      # the feature refused it after all

finish() trusts nothing the phone says about the file: the URL, size and
format come from the storage service. It raises NotFoundError for an
upload that isn't this user's (or wasn't uploaded), FileTooLargeError and
DailyLimitError for limits; in those two cases the file is deleted.
"""
from __future__ import annotations

import uuid
from datetime import timedelta

from src.core.base_model import utcnow
from src.core.exceptions import AppError, NotFoundError
from src.extensions import db

from .models import MediaUpload, UploadState
from .provider import StoredFile, UploadForm, get_provider

#: Time to finish an upload before the sweep treats it as abandoned. Generous:
#: phones on slow connections, switching apps mid-upload.
FINISH_WITHIN = timedelta(minutes=60)
#: All finished uploads of one account, all features together, per 24 hours.
DAILY_BYTES_PER_ACCOUNT = 100 * 1024 * 1024


class FileTooLargeError(AppError):
    status_code = 422
    code = "FILE_TOO_LARGE"


class DailyLimitError(AppError):
    status_code = 429
    code = "UPLOAD_LIMIT"


def start(user_id, purpose: str, folder: str, max_px: int) -> UploadForm:
    public_id = f"{folder}/{uuid.uuid4().hex}"
    db.session.add(MediaUpload(user_id=user_id, purpose=purpose, public_id=public_id, expires_at=utcnow() + FINISH_WITHIN))
    db.session.commit()
    return get_provider().upload_form(public_id, folder, max_px)


def finish(user_id, purpose: str, public_id: str, max_bytes: int) -> StoredFile:
    upload = MediaUpload.query.filter_by(public_id=public_id, user_id=user_id, purpose=purpose, state=UploadState.STARTED.value).first()
    if upload is None or upload.expires_at <= utcnow():
        raise NotFoundError("Upload not found.", code="MEDIA_NOT_FOUND")

    stored = get_provider().find(public_id)
    if stored is None:
        raise NotFoundError("Upload not found.", code="MEDIA_NOT_FOUND")
    if stored.bytes > max_bytes:
        _refuse(upload)
        raise FileTooLargeError(f"That file is too large. The limit is {max_bytes // (1024 * 1024)} MB.")
    if _bytes_today(user_id) + stored.bytes > DAILY_BYTES_PER_ACCOUNT:
        _refuse(upload)
        raise DailyLimitError("You've uploaded a lot today. Try again tomorrow.")

    upload.state = UploadState.FINISHED.value
    upload.finished_at = utcnow()
    upload.bytes = stored.bytes
    return stored  # the caller commits, together with its own row


def cancel(public_id: str) -> None:
    upload = MediaUpload.query.filter_by(public_id=public_id).first()
    if upload is not None and upload.state == UploadState.STARTED.value:
        _refuse(upload)


def delete_file(public_id: str) -> None:
    """Remove a kept file (replaced or removed photo). Never raises: a
    failed delete must not break the user's action."""
    try:
        get_provider().delete(public_id)
    except Exception:  # noqa: BLE001
        pass


def _refuse(upload: MediaUpload) -> None:
    delete_file(upload.public_id)
    upload.state = UploadState.CANCELLED.value
    db.session.commit()


def _bytes_today(user_id) -> int:
    since = utcnow() - timedelta(days=1)
    total = (
        db.session.query(db.func.coalesce(db.func.sum(MediaUpload.bytes), 0))
        .filter(MediaUpload.user_id == user_id, MediaUpload.state == UploadState.FINISHED.value, MediaUpload.finished_at >= since)
        .scalar()
    )
    return int(total or 0)
