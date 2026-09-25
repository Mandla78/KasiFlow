"""
/api/v1/me/business-profile -- the signed-in trader's own profile.

  GET    the profile ({"profile": null} before the first save)
  PATCH  save one or more sections: business, registration, location,
         buying, tools. Creates the profile on the first save.
"""
from __future__ import annotations

from flask import request

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.shared.rate_limit.limiter import limiter

from ..schemas.business_profile_schemas import load_patch
from ..services import business_profile_service as service

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
