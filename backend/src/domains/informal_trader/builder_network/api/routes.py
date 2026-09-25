"""
/api/v1 -- the builder network (docs/teammate/feedback/CONTRACT_jobs_v2.txt).

  GET    /me/builder-profile                     yours (made hidden on first use)
  PUT    /me/builder-profile
  GET    /builders?trade=                        the Builders tab
  GET    /builders/<id>                          a portfolio of builds
  PUT    /builders/<id>/save      DELETE same    a private bookmark
  POST   /builders/<id>/block
  POST   /builders/<id>/report
  GET    /me/jobs/<id>/partners                  who's on your job
  GET    /me/jobs/<id>/candidates?trade=         who you could bring in
  POST   /me/jobs/<id>/partners                  invite, with the pay (Idempotency-Key)
  POST   /me/job-partners/<id>/payments          "I paid" (Idempotency-Key)
  GET    /me/partner-invites                     jobs you're invited to / on
  GET    /me/partner-invites/<id>
  POST   /me/partner-invites/<id>/answer         {accept}
  POST   /me/partner-invites/<id>/payments/<pid>/confirm   "I got"
  POST   /me/jobs/<id>/help-posts                post the offer nearby (Idempotency-Key)
  GET    /help-posts/<id>
  POST   /help-posts/<id>/interested
  POST   /me/help-posts/<id>/pick                {builder_id}
  POST   /me/help-posts/<id>/close

Thin: validate -> service -> answer. Signed-in traders only, rate-limited
per trader; the services scope everything to current_user().
"""
from __future__ import annotations

import uuid

from flask import request

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.domains.informal_trader.credit_book.api import limits
from src.domains.informal_trader.credit_book.api.idempotent import run_once
from src.shared.rate_limit.limiter import limiter

from ..constants import TRADES
from ..schemas.network_schemas import (
    AnswerSchema,
    GotSchema,
    HelpPostSchema,
    InviteSchema,
    PaidSchema,
    PickSchema,
    ProfileSchema,
    ReportSchema,
    load,
)
from ..services import builders_service, help_posts_service, partners_service, profile_service
from ..services.common import invalid

TRADER = "informal_business"


def _trade_arg(required: bool = False):
    trade = (request.args.get("trade") or "").strip() or None
    if trade is not None and trade not in TRADES:
        raise invalid("trade", "Pick a trade from the list.")
    if required and trade is None:
        raise invalid("trade", "Pick the trade you need.")
    return trade


# ------------------------------------------------------------------ your profile


@api_bp.get("/me/builder-profile")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def my_builder_profile():
    return success_response({"profile": profile_service.get(current_user())})


@api_bp.put("/me/builder-profile")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def save_builder_profile():
    data = load(ProfileSchema(), request.get_json(silent=True))
    return success_response({"profile": profile_service.save(current_user(), data)}, message="Saved.")


# ------------------------------------------------------------------ builders


@api_bp.get("/builders")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def builders_home():
    return success_response(builders_service.home(current_user(), _trade_arg()))


@api_bp.get("/builders/<uuid:builder_id>")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def builder_profile(builder_id: uuid.UUID):
    return success_response({"builder": builders_service.profile(current_user(), builder_id)})


@api_bp.put("/builders/<uuid:builder_id>/save")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def save_builder(builder_id: uuid.UUID):
    builders_service.set_saved(current_user(), builder_id, True)
    return success_response({}, message="Saved.")


@api_bp.delete("/builders/<uuid:builder_id>/save")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def unsave_builder(builder_id: uuid.UUID):
    builders_service.set_saved(current_user(), builder_id, False)
    return success_response({}, message="Removed.")


@api_bp.post("/builders/<uuid:builder_id>/block")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def block_builder(builder_id: uuid.UUID):
    builders_service.block(current_user(), builder_id)
    return success_response({}, message="Blocked.")


@api_bp.post("/builders/<uuid:builder_id>/report")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def report_builder(builder_id: uuid.UUID):
    data = load(ReportSchema(), request.get_json(silent=True))
    builders_service.report(current_user(), builder_id, data["reason"], data["note"])
    return success_response({}, message="Thanks. We'll look at it.")


# ------------------------------------------------------------------ partners (owner)


@api_bp.get("/me/jobs/<uuid:job_id>/partners")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def job_partners(job_id: uuid.UUID):
    return success_response({"partners": partners_service.on_job(current_user(), job_id)})


@api_bp.get("/me/jobs/<uuid:job_id>/candidates")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def job_candidates(job_id: uuid.UUID):
    return success_response(partners_service.candidates(current_user(), job_id, _trade_arg(required=True)))


@api_bp.post("/me/jobs/<uuid:job_id>/partners")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def invite_partner(job_id: uuid.UUID):
    def handler():
        data = load(InviteSchema(), request.get_json(silent=True))
        return success_response({"partner": partners_service.invite(current_user(), job_id, data)}, message="Invite sent.", status_code=201)

    return run_once(handler)


@api_bp.post("/me/job-partners/<uuid:partner_id>/payments")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def pay_partner(partner_id: uuid.UUID):
    def handler():
        data = load(PaidSchema(), request.get_json(silent=True))
        return success_response({"partner": partners_service.record_payment(current_user(), partner_id, data["amount_cents"])}, message="Saved.", status_code=201)

    return run_once(handler)


# ------------------------------------------------------------------ invites (partner)


@api_bp.get("/me/partner-invites")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def partner_invites():
    return success_response({"invites": partners_service.invites(current_user())})


@api_bp.get("/me/partner-invites/<uuid:invite_id>")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def partner_invite(invite_id: uuid.UUID):
    return success_response({"invite": partners_service.invite_view(current_user(), invite_id)})


@api_bp.post("/me/partner-invites/<uuid:invite_id>/answer")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def answer_invite(invite_id: uuid.UUID):
    data = load(AnswerSchema(), request.get_json(silent=True))
    return success_response({"invite": partners_service.answer(current_user(), invite_id, data["accept"])})


@api_bp.post("/me/partner-invites/<uuid:invite_id>/payments/<uuid:payment_id>/confirm")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def confirm_partner_payment(invite_id: uuid.UUID, payment_id: uuid.UUID):
    data = load(GotSchema(), request.get_json(silent=True))
    return success_response({"invite": partners_service.confirm_payment(current_user(), invite_id, payment_id, data["amount_cents"])})


# ------------------------------------------------------------------ help posts


@api_bp.post("/me/jobs/<uuid:job_id>/help-posts")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def create_help_post(job_id: uuid.UUID):
    def handler():
        data = load(HelpPostSchema(), request.get_json(silent=True))
        return success_response({"post": help_posts_service.create(current_user(), job_id, data)}, message="Posted.", status_code=201)

    return run_once(handler)


@api_bp.get("/help-posts/<uuid:post_id>")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def help_post(post_id: uuid.UUID):
    return success_response({"post": help_posts_service.get(current_user(), post_id)})


@api_bp.post("/help-posts/<uuid:post_id>/interested")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def help_post_interested(post_id: uuid.UUID):
    return success_response({"post": help_posts_service.interested(current_user(), post_id)})


@api_bp.post("/me/help-posts/<uuid:post_id>/pick")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def pick_help(post_id: uuid.UUID):
    data = load(PickSchema(), request.get_json(silent=True))
    return success_response({"post": help_posts_service.pick(current_user(), post_id, data["builder_id"])})


@api_bp.post("/me/help-posts/<uuid:post_id>/close")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def close_help(post_id: uuid.UUID):
    return success_response({"post": help_posts_service.close(current_user(), post_id)})
