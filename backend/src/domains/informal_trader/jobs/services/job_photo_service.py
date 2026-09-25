"""
Stage photos. The phone uploads straight to Cloudinary (shared.media); this
backend never carries the image in the upload, and trusts nothing the
phone says about it:

  upload_form(user, job_id, stage_id)        one signed upload, in this
                                             job's own folder
  keep(user, job_id, stage_id, public_id)    checked by shared.media
                                             (ownership, real size, daily
                                             limit), then hashed and kept

THE PROOF: photo_taken_at is the server's clock when the photo is kept,
and photo_sha256 is the hash of the stored file itself, downloaded once
from the storage service. Neither comes from the phone, so a swapped or
back-dated photo is detectable. If the file can't be read to hash it,
nothing is kept and the builder is asked to try again.
"""
from __future__ import annotations

import hashlib
import uuid

import requests

from src.core.base_model import utcnow
from src.core.exceptions import AppError, ConflictError, NotFoundError
from src.extensions import db
from src.shared.audit.event_types.business import BusinessAuditEvent as E
from src.shared.media import folders, uploads
from src.shared.media.provider import UploadForm

from ..constants import PHOTO_MAX_BYTES, PHOTO_PURPOSE, PHOTO_STORED_MAX_PX
from . import jobs_audit
from .jobs_service import job_or_404, stage_or_404, view

FETCH_TIMEOUT_SECONDS = 15


class PhotoCheckFailed(AppError):
    status_code = 503
    code = "PHOTO_CHECK_FAILED"


def fetch_bytes(url: str) -> bytes:
    """The stored file, read once to hash it. Capped, so a wrong URL can't
    make us download something huge."""
    with requests.get(url, timeout=FETCH_TIMEOUT_SECONDS, stream=True) as response:
        response.raise_for_status()
        data = b""
        for chunk in response.iter_content(64 * 1024):
            data += chunk
            if len(data) > PHOTO_MAX_BYTES:
                raise ValueError("stored photo larger than allowed")
        return data


def _refuse_if_confirmed(stage) -> None:
    if stage.status == "confirmed":
        raise ConflictError("This stage is already confirmed by both of you.", code="STAGE_CONFIRMED")


def upload_form(user, job_id: uuid.UUID, stage_id: uuid.UUID) -> UploadForm:
    stage = stage_or_404(user, job_id, stage_id)
    _refuse_if_confirmed(stage)
    return uploads.start(user.id, PHOTO_PURPOSE, folders.informal_trader_job_folder(user.id, job_id), PHOTO_STORED_MAX_PX)


def keep(user, job_id: uuid.UUID, stage_id: uuid.UUID, public_id: str) -> dict:
    stage = stage_or_404(user, job_id, stage_id, lock=True)
    _refuse_if_confirmed(stage)
    # The upload must be in THIS job's folder, not another job's (or feature's).
    if not public_id.startswith(folders.informal_trader_job_folder(user.id, job_id) + "/"):
        db.session.rollback()
        raise NotFoundError("Upload not found.", code="MEDIA_NOT_FOUND")

    stored = uploads.finish(user.id, PHOTO_PURPOSE, public_id, PHOTO_MAX_BYTES)
    try:
        sha256 = hashlib.sha256(fetch_bytes(stored.url)).hexdigest()
    except Exception:  # noqa: BLE001 -- any failure to read the file: keep nothing
        db.session.rollback()
        raise PhotoCheckFailed("Couldn't check the photo. Check your connection and try again.") from None

    if stage.photo_public_id:
        uploads.delete_file(stage.photo_public_id)  # a retake replaces the old photo
    stage.photo_public_id = stored.public_id
    stage.photo_url = stored.url
    stage.photo_sha256 = sha256
    stage.photo_taken_at = utcnow()
    if stage.status == "not_started":
        stage.status = "photo_taken"
    db.session.commit()
    jobs_audit.record(E.JOB_STAGE_PHOTO_ADDED, user_id=user.id, job_id=job_id, stage_id=stage.id, photo_sha256=sha256, bytes=stored.bytes)
    return view(job_or_404(user, job_id))
