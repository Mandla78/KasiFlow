"""
/api/v1/me/jobs -- the signed-in builder's own jobs.

  GET    /me/jobs                                         active first, then done
  POST   /me/jobs                                         a job with stages (Idempotency-Key)
  GET    /me/jobs/summary                                 Home and Account numbers
  GET    /me/jobs/<id>
  POST   /me/jobs/<id>/stages/<sid>/photo/upload-signature   one signed upload
  POST   /me/jobs/<id>/stages/<sid>/photo                 {public_id} -> kept, hashed
  POST   /me/jobs/<id>/stages/<sid>/sign-off              {builder_amount_cents}
                                                          -> {job, link, message}
  GET    /me/jobs/history?q=                              done jobs (search)
  DELETE /me/jobs/<id>                                    move to the bin; open links stop working
  POST   /me/jobs/<id>/restore                            back from the bin
  GET    /me/jobs/bin                                     deleted in the last 30 days

Thin: validate -> service -> answer. Signed-in traders only, rate-limited
per trader, scoped to current_user() by the services. The client's page
is not here: see web/sign_off_page.py.

The per-trader limit key and the Idempotency-Key handling are the credit
book's (docs/teammate/feedback/NEEDS_shared_components.txt asks to move
them to shared/).
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

from ..schemas.jobs_schemas import HistoryQuerySchema, NewJobSchema, PhotoSchema, SignOffSchema, load
from ..services import job_photo_service, jobs_service, sign_off_service

BASE = "/me/jobs"
TRADER = "informal_business"
PHOTO_LIMIT = "20 per hour"


@api_bp.get(BASE)
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def list_jobs():
    return success_response({"jobs": jobs_service.list_jobs(current_user())})


@api_bp.post(BASE)
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def create_job():
    def handler():
        data = load(NewJobSchema(), request.get_json(silent=True))
        return success_response({"job": jobs_service.create_job(current_user(), data)}, message="Saved.", status_code=201)

    return run_once(handler)


@api_bp.get(f"{BASE}/summary")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def jobs_summary():
    return success_response({"summary": jobs_service.summary(current_user())})


@api_bp.get(f"{BASE}/<uuid:job_id>")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def get_job(job_id: uuid.UUID):
    return success_response({"job": jobs_service.get_job(current_user(), job_id)})


@api_bp.post(f"{BASE}/<uuid:job_id>/stages/<uuid:stage_id>/photo/upload-signature")
@limiter.limit(PHOTO_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def stage_photo_upload_signature(job_id: uuid.UUID, stage_id: uuid.UUID):
    form = job_photo_service.upload_form(current_user(), job_id, stage_id)
    # The phone posts the file to upload_url with exactly these fields (+ "file").
    return success_response({"upload_url": form.url, "fields": form.fields})


@api_bp.post(f"{BASE}/<uuid:job_id>/stages/<uuid:stage_id>/photo")
@limiter.limit(PHOTO_LIMIT, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def keep_stage_photo(job_id: uuid.UUID, stage_id: uuid.UUID):
    data = load(PhotoSchema(), request.get_json(silent=True))
    return success_response({"job": job_photo_service.keep(current_user(), job_id, stage_id, data["public_id"])}, message="Photo saved.")


@api_bp.post(f"{BASE}/<uuid:job_id>/stages/<uuid:stage_id>/sign-off")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def send_stage_sign_off(job_id: uuid.UUID, stage_id: uuid.UUID):
    def handler():
        data = load(SignOffSchema(), request.get_json(silent=True))
        job, link, text = sign_off_service.send(current_user(), job_id, stage_id, data["builder_amount_cents"])
        return success_response({"job": job, "link": link, "message": text}, message="Sign-off link ready.", status_code=201)

    return run_once(handler)


@api_bp.get(f"{BASE}/history")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def jobs_history():
    query = load(HistoryQuerySchema(), request.args.to_dict())
    return success_response({"jobs": jobs_service.history(current_user(), query["q"])})


@api_bp.delete(f"{BASE}/<uuid:job_id>")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def bin_job(job_id: uuid.UUID):
    jobs_service.move_to_bin(current_user(), job_id)
    return success_response({}, message="Moved to the bin.")


@api_bp.post(f"{BASE}/<uuid:job_id>/restore")
@limiter.limit(limits.CHANGE, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def restore_job(job_id: uuid.UUID):
    return success_response({"job": jobs_service.restore(current_user(), job_id)}, message="Restored.")


@api_bp.get(f"{BASE}/bin")
@limiter.limit(limits.READ, key_func=limits.per_user)
@auth_required(dashboard=TRADER)
def jobs_bin():
    return success_response({"jobs": jobs_service.bin_jobs(current_user())})
