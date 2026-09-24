"""
/api/v1/auth/* -- thin: validate, call the service, answer.
Every route is rate-limited; the numbers live in ../rate_limit/policies.py.
"""
from __future__ import annotations

from flask import request
from flask_jwt_extended import get_jwt, jwt_required

from src.api import api_bp
from src.core.decorators import auth_required, current_user
from src.core.responses import success_response
from src.shared.rate_limit.limiter import limiter

from ..rate_limit import policies
from ..schemas.auth_schemas import (
    ChangePasswordSchema,
    EmailOnlySchema,
    LoginSchema,
    PasswordConfirmSchema,
    RegisterSchema,
    ResetPasswordSchema,
    VerifyEmailSchema,
    load,
)
from ..services import auth_service
from ..services.auth_service import DeviceInfo

CHECK_EMAIL = "Check your email."


def _device(data: dict):
    d = data.get("device")
    return DeviceInfo(**d) if d else None


@api_bp.post("/auth/register")
@limiter.limit(policies.REGISTER)
def register():
    data = load(RegisterSchema(), request.get_json(silent=True))
    auth_service.register(
        data["business_name"], data["email"], data["password"], data["consent"]["privacy_version"], data["consent"]["terms_version"]
    )
    return success_response({}, message=CHECK_EMAIL, status_code=202)


@api_bp.post("/auth/verify-email")
@limiter.limit(policies.VERIFY_EMAIL)
def verify_email():
    data = load(VerifyEmailSchema(), request.get_json(silent=True))
    return success_response(auth_service.verify_email(data["email"], data["code"], _device(data)), message="Email confirmed.")


@api_bp.post("/auth/resend-code")
@limiter.limit(policies.RESEND_CODE)
def resend_code():
    data = load(EmailOnlySchema(), request.get_json(silent=True))
    auth_service.resend_code(data["email"])
    return success_response({}, message=CHECK_EMAIL, status_code=202)


@api_bp.post("/auth/login")
@limiter.limit(policies.LOGIN, key_func=policies.login_key_func)
def login():
    data = load(LoginSchema(), request.get_json(silent=True))
    return success_response(auth_service.login(data["email"], data["password"], _device(data)), message="Signed in.")


@api_bp.post("/auth/refresh")
@limiter.limit(policies.REFRESH)
@jwt_required(refresh=True)
def refresh():
    claims = get_jwt()
    return success_response(auth_service.refresh(claims.get("sid", ""), claims["jti"]))


@api_bp.post("/auth/logout")
@jwt_required()
def logout():
    auth_service.logout(get_jwt().get("sid", ""))
    return success_response({}, message="Signed out.")


@api_bp.post("/auth/forgot-password")
@limiter.limit(policies.FORGOT_PASSWORD)
def forgot_password():
    data = load(EmailOnlySchema(), request.get_json(silent=True))
    auth_service.forgot_password(data["email"])
    return success_response({}, message=CHECK_EMAIL, status_code=202)


@api_bp.post("/auth/reset-password")
@limiter.limit(policies.RESET_PASSWORD)
def reset_password():
    data = load(ResetPasswordSchema(), request.get_json(silent=True))
    auth_service.reset_password(data["token"], data["password"])
    return success_response({}, message="Password changed. Sign in with your new password.")


# ----------------------------------------------------- account security
# Signed-in only. The user and the current session come from the token.


def _sid() -> str:
    return get_jwt().get("sid", "")


@api_bp.get("/auth/sessions")
@auth_required
def signed_in_phones():
    return success_response({"sessions": auth_service.signed_in_phones(current_user(), _sid())})


@api_bp.post("/auth/logout-others")
@auth_required
def logout_others():
    ended = auth_service.sign_out_other_phones(current_user(), _sid())
    return success_response({"signed_out": ended}, message="Signed out of your other phones.")


@api_bp.post("/auth/change-password")
@limiter.limit(policies.CHANGE_PASSWORD)
@auth_required
def change_password():
    data = load(ChangePasswordSchema(), request.get_json(silent=True))
    ended = auth_service.change_password(current_user(), _sid(), data["current_password"], data["new_password"])
    return success_response({"signed_out": ended}, message="Password changed. Your other phones were signed out.")


@api_bp.post("/me/close-account")
@limiter.limit(policies.CLOSE_ACCOUNT)
@auth_required
def close_account():
    data = load(PasswordConfirmSchema(), request.get_json(silent=True))
    auth_service.close_account(current_user(), _sid(), data["password"])
    return success_response({}, message="Your account is closed.")


@api_bp.get("/me/export")
@limiter.limit(policies.EXPORT_DATA)
@auth_required
def export_my_data():
    return success_response(auth_service.export_my_data(current_user(), _sid()))
