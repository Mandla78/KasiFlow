"""
/api/v1/me/business-profile -- the signed-in trader's own profile.

  GET    the profile ({"profile": null} before the first save)
  PATCH  save one or more sections: business, registration, location,
         buying, tools. Creates the profile on the first save.

/api/v1/me/business-profile/image -- the profile photo (Cloudinary):
  POST /upload-signature   one-upload signature; the phone then posts the
                           file straight to Cloudinary
  POST                     {"public_id"} after the upload: checked and shown
  DELETE                   remove the photo
"""
from __future__ import annotations

from flask import request

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.exceptions import ValidationError
from src.core.responses import success_response
from src.shared.rate_limit.limiter import limiter

from ..schemas.business_profile_schemas import load_patch
from ..services import business_profile_service as service
from ..services import profile_image_service

#: The app saves one screen at a time; this is plenty for a human.
SAVE_LIMIT = "30 per minute"


@api_bp.get("/me/business-profile")
@auth_required(dashboard="informal_business")
def get_business_profile():
    return success_response({"profile": service.public_view(service.get(current_user()))})


@api_bp.patch("/me/business-profile")
@limiter.limit(SAVE_LIMIT)
@auth_required(dashboard="informal_business")
def save_business_profile():
    patch = load_patch(request.get_json(silent=True))
    profile = service.save(current_user(), patch)
    return success_response({"profile": service.public_view(profile)}, message="Saved.")


UPLOAD_LIMIT = "20 per hour"


@api_bp.post("/me/business-profile/image/upload-signature")
@limiter.limit(UPLOAD_LIMIT)
@auth_required(dashboard="informal_business")
def profile_image_upload_signature():
    form = profile_image_service.upload_form(current_user())
    # The phone posts the file to upload_url with exactly these fields (+ "file").
    return success_response({"upload_url": form.url, "fields": form.fields, "max_bytes": profile_image_service.MAX_BYTES})


@api_bp.post("/me/business-profile/image")
@limiter.limit(UPLOAD_LIMIT)
@auth_required(dashboard="informal_business")
def register_profile_image():
    body = request.get_json(silent=True) or {}
    public_id = body.get("public_id")
    if not isinstance(public_id, str) or not 10 <= len(public_id) <= 500 or set(body) - {"public_id"}:
        raise ValidationError("Please check the highlighted fields.", errors=[{"public_id": ["Required."]}])
    profile = profile_image_service.keep(current_user(), public_id)
    return success_response({"profile": service.public_view(profile)}, message="Photo saved.")


@api_bp.delete("/me/business-profile/image")
@auth_required(dashboard="informal_business")
def remove_profile_image():
    profile = profile_image_service.remove(current_user())
    return success_response({"profile": service.public_view(profile)}, message="Photo removed.")
