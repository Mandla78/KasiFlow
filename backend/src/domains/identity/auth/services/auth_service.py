"""
auth -- proving it's you.

RULES THIS FILE KEEPS (security by design):
  * NO ACCOUNT ENUMERATION. Register, resend-code and forgot-password
    answer identically whether or not the email has an account. Wrong
    email and wrong password get the same error, and take the same time
    (a dummy bcrypt check runs when there is no account).
  * LOCKOUT. Too many wrong passwords lock the account for a while. The
    lock is only revealed to someone who then gives the RIGHT password.
  * ONE-TIME SECRETS are stored hashed, expire, and die after too many
    wrong attempts.
  * A PASSWORD RESET signs the user out everywhere.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from flask import current_app, request

from src.core.base_model import utcnow
from src.core.exceptions import AccountInactiveError, AccountLockedError, AppError, EmailNotVerifiedError, UnauthorizedError, ValidationError
from src.domains.identity.accounts.models import AccountStatus
from src.domains.identity.accounts.services import account_service
from src.domains.identity.devices.services import device_service
from src.extensions import db
from src.shared.audit.event_types.auth import AuthAuditEvent as E
from src.shared.email.email import EmailService
from src.shared.security.security import hash_password, validate_password_complexity, verify_password

from ..models import CodePurpose, EmailCode, PasswordCredential, PasswordReset
from . import auth_audit, secrets, session_service

logger = logging.getLogger("akayza.auth")

# Compared against when an account doesn't exist, so a wrong email takes as
# long as a wrong password (bcrypt is deliberately slow).
_DUMMY_HASH = hash_password("dummy-password-for-timing-1!A")

GENERIC_LOGIN_ERROR = "Email or password is incorrect."
GENERIC_CODE_ERROR = "That code is wrong or has expired."
GENERIC_RESET_ERROR = "This link is not valid any more. Ask for a new one."


class InvalidCodeError(AppError):
    status_code = 400
    code = "INVALID_CODE"


@dataclass
class DeviceInfo:
    public_key: str
    signature: str
    platform: Optional[str] = None
    label: Optional[str] = None


def _ip() -> Optional[str]:
    return request.remote_addr


def _check_password_rule(password: str) -> None:
    problems = validate_password_complexity(password)
    if problems:
        raise ValidationError(
            "Use 8 to 64 characters with a capital letter, a small letter, a number and a special character.",
            errors=problems,
            code="WEAK_PASSWORD",
        )


def _send_code(user, resent: bool = False) -> None:
    """Replace any unused code with a fresh one and email it."""
    now = utcnow()
    EmailCode.query.filter_by(user_id=user.id, purpose=CodePurpose.VERIFY_EMAIL.value, used_at=None).update({"used_at": now})
    code = secrets.new_code()
    minutes = current_app.config["EMAIL_CODE_EXPIRY_MINUTES"]
    db.session.add(
        EmailCode(
            user_id=user.id,
            purpose=CodePurpose.VERIFY_EMAIL.value,
            code_hash=secrets.digest(code),
            expires_at=now + timedelta(minutes=minutes),
        )
    )
    EmailService.send_template(
        to=user.email,
        template_name="verify_email.html",
        subject="Your Akayza code",
        context={"code": code, "minutes": minutes},
        rate_limit_key=f"verify_email:{user.email}",
        rate_limit_max=6,
        rate_limit_window_seconds=3600,
    )
    auth_audit.record(E.OTP_RESENT if resent else E.OTP_SENT, user_id=user.id, email=user.email, purpose="verify_email")


def _tokens(user, device: Optional[DeviceInfo]) -> dict:
    device_id = None
    if device and device.public_key:
        registered, previous_id = device_service.register(user.id, device.public_key, device.signature, device.platform, device.label)
        device_id = registered.id
        if previous_id:
            # The old phone is switched off: its sessions end now.
            ended = session_service.revoke_all(user.id, session_service.RevokeReason.NEW_DEVICE, device_id=previous_id)
            auth_audit.record(
                E.TOKEN_REVOKED, user_id=user.id, email=user.email, device_id=previous_id,
                reason="new_device", sessions_ended=ended, new_device_id=str(device_id),
            )
    account_service.record_login(user)
    tokens, sid = session_service.start(user.id, device_id)
    auth_audit.record(E.TOKEN_CREATED, user_id=user.id, email=user.email, session_id=sid, device_id=device_id)
    return {**tokens, "user": account_service.public_view(user)}


# --------------------------------------------------------------- register


def register(business_name: str, email: str, password: str, privacy_version: str, terms_version: str) -> None:
    """Always ends the same way for the caller ("check your email"), so the
    response never reveals whether the email already has an account."""
    _check_password_rule(password)
    account_service.check_consent_versions(privacy_version, terms_version)

    user = account_service.find_by_email(email)
    if user and user.status != AccountStatus.UNVERIFIED.value:
        # Already a real account: tell its OWNER, change nothing.
        EmailService.send_template(
            to=user.email,
            template_name="account_exists.html",
            subject="Someone tried to sign up with your email",
            context={},
            rate_limit_key=f"account_exists:{user.email}",
            rate_limit_max=3,
            rate_limit_window_seconds=3600,
        )
        logger.info("register_existing_account user_id=%s", user.id)
        db.session.commit()
        # Stored for investigators; never shown to whoever tried.
        auth_audit.record(E.REGISTER_FAILED, False, user_id=user.id, email=user.email, reason="email_already_registered", owner_notified=True)
        return

    resumed = bool(user)
    if user:  # never verified: the earlier attempt proved nothing, start over
        account_service.restart_unverified(user, business_name)
        credential = db.session.get(PasswordCredential, user.id)
        credential.password_hash = hash_password(password)
        credential.changed_at = utcnow()
    else:
        user = account_service.create_unverified(email, business_name)
        db.session.add(PasswordCredential(user_id=user.id, password_hash=hash_password(password)))

    account_service.record_consents(user, privacy_version, terms_version, _ip(), request.headers.get("User-Agent"))
    _send_code(user)
    db.session.commit()
    auth_audit.record(
        E.REGISTER_RESUMED if resumed else E.REGISTER_SUCCESS, user_id=user.id, email=user.email,
        privacy_version=privacy_version, terms_version=terms_version,
    )


def resend_code(email: str) -> None:
    """Same answer whether or not there is anything to resend."""
    user = account_service.find_by_email(email)
    if user and user.status == AccountStatus.UNVERIFIED.value:
        _send_code(user, resent=True)
        db.session.commit()


def verify_email(email: str, code: str, device: Optional[DeviceInfo]) -> dict:
    user = account_service.find_by_email(email)
    if not user or user.status != AccountStatus.UNVERIFIED.value:
        auth_audit.record(
            E.EMAIL_VERIFICATION_FAILED, False, user_id=user.id if user else None, email=email, reason="no_pending_verification"
        )
        raise InvalidCodeError(GENERIC_CODE_ERROR)

    now = utcnow()
    record = (
        EmailCode.query.filter_by(user_id=user.id, purpose=CodePurpose.VERIFY_EMAIL.value, used_at=None)
        .order_by(EmailCode.created_at.desc())
        .first()
    )
    if not record or record.expires_at <= now:
        auth_audit.record(E.EMAIL_VERIFICATION_EXPIRED, False, user_id=user.id, email=user.email, reason="no_valid_code")
        raise InvalidCodeError(GENERIC_CODE_ERROR)

    if not secrets.matches((code or "").strip(), record.code_hash):
        record.attempts += 1
        burnt = record.attempts >= current_app.config["EMAIL_CODE_MAX_ATTEMPTS"]
        if burnt:
            record.used_at = now  # burnt: ask for a new code
        db.session.commit()
        auth_audit.record(
            E.OTP_EXPIRED if burnt else E.OTP_FAILED, False, user_id=user.id, email=user.email,
            reason="too_many_attempts" if burnt else "wrong_code", attempts=record.attempts,
        )
        raise InvalidCodeError(GENERIC_CODE_ERROR)

    record.used_at = now
    account_service.mark_verified(user)
    result = _tokens(user, device)
    db.session.commit()
    auth_audit.record(E.EMAIL_VERIFIED, user_id=user.id, email=user.email)
    return result


# ------------------------------------------------------------------ login


def login(email: str, password: str, device: Optional[DeviceInfo]) -> dict:
    user = account_service.find_by_email(email)
    credential = db.session.get(PasswordCredential, user.id) if user else None

    if not user or not credential:
        verify_password(password, _DUMMY_HASH)  # same time as a real check
        auth_audit.record(E.LOGIN_FAILED, False, email=email, reason="no_account")
        raise UnauthorizedError(GENERIC_LOGIN_ERROR, code="INVALID_CREDENTIALS")

    now = utcnow()
    correct = verify_password(password, credential.password_hash)

    if credential.locked_until and credential.locked_until > now:
        if correct:  # only the real owner learns about the lock
            auth_audit.record(E.LOGIN_BLOCKED, False, user_id=user.id, email=user.email, reason="account_locked")
            raise AccountLockedError("Too many attempts. Try again in a few minutes, or reset your password.")
        raise UnauthorizedError(GENERIC_LOGIN_ERROR, code="INVALID_CREDENTIALS")

    if not correct:
        credential.failed_attempts += 1
        if credential.failed_attempts >= current_app.config["LOGIN_MAX_FAILED_ATTEMPTS"]:
            credential.locked_until = now + timedelta(minutes=current_app.config["LOGIN_LOCKOUT_MINUTES"])
            credential.failed_attempts = 0
            auth_audit.record(E.LOGIN_LOCKED, False, user_id=user.id, email=user.email, reason="too_many_failed_passwords")
        else:
            auth_audit.record(E.LOGIN_FAILED, False, user_id=user.id, email=user.email, reason="wrong_password", attempts=credential.failed_attempts)
        db.session.commit()
        raise UnauthorizedError(GENERIC_LOGIN_ERROR, code="INVALID_CREDENTIALS")

    credential.failed_attempts = 0
    credential.locked_until = None

    if user.status == AccountStatus.UNVERIFIED.value:
        _send_code(user)
        db.session.commit()
        auth_audit.record(E.LOGIN_UNVERIFIED, False, user_id=user.id, email=user.email, reason="email_not_verified")
        raise EmailNotVerifiedError("Confirm your email first. We've sent you a new code.")
    if not user.is_active:
        db.session.commit()
        auth_audit.record(E.LOGIN_BLOCKED, False, user_id=user.id, email=user.email, reason="account_closed")
        raise AccountInactiveError("This account is closed.")

    result = _tokens(user, device)
    db.session.commit()
    auth_audit.record(E.LOGIN_SUCCESS, user_id=user.id, email=user.email)
    return result


def refresh(sid: str, jti: str) -> dict:
    session = session_service.get(sid)
    if not session_service.is_alive(session):
        raise UnauthorizedError("Please sign in again.", code="SESSION_ENDED")
    tokens = session_service.rotate(session, jti)
    db.session.commit()
    if tokens is None:
        # An OLD refresh token came back: someone kept a copy. Session killed.
        logger.warning("refresh_token_reuse session_id=%s user_id=%s", session.id, session.user_id)
        auth_audit.record(
            E.TOKEN_REVOKED, False, user_id=session.user_id, session_id=session.id, device_id=session.device_id,
            reason="refresh_token_reuse",
        )
        raise UnauthorizedError("Please sign in again.", code="SESSION_ENDED")
    auth_audit.record(E.TOKEN_REFRESHED, user_id=session.user_id, session_id=session.id, device_id=session.device_id)
    return tokens


def logout(sid: str) -> None:
    session = session_service.get(sid)
    if session:
        session_service.revoke(session, session_service.RevokeReason.LOGOUT)
        db.session.commit()
        auth_audit.record(E.LOGOUT, user_id=session.user_id, session_id=session.id, device_id=session.device_id)


# --------------------------------------------------------- password reset


def forgot_password(email: str) -> None:
    """Same answer for everyone. Only a real account gets an email."""
    user = account_service.find_by_email(email)
    if not user or user.status == AccountStatus.DEACTIVATED.value or not db.session.get(PasswordCredential, user.id):
        # Stored so repeated probing of unknown emails can be spotted; the caller sees nothing.
        auth_audit.record(E.PASSWORD_RESET_REQUESTED, False, email=email, reason="no_eligible_account")
        return

    now = utcnow()
    PasswordReset.query.filter_by(user_id=user.id, used_at=None).update({"used_at": now})  # older links die
    token = secrets.new_token()
    minutes = current_app.config["PASSWORD_RESET_EXPIRY_MINUTES"]
    db.session.add(PasswordReset(user_id=user.id, token_hash=secrets.digest(token), expires_at=now + timedelta(minutes=minutes)))
    db.session.commit()
    EmailService.send_template(
        to=user.email,
        template_name="password_reset.html",
        subject="Reset your Akayza password",
        context={"link": f"{current_app.config['PASSWORD_RESET_URL']}?token={token}", "minutes": minutes},
        rate_limit_key=f"password_reset:{user.email}",
        rate_limit_max=3,
        rate_limit_window_seconds=3600,
    )
    auth_audit.record(E.PASSWORD_RESET_REQUESTED, user_id=user.id, email=user.email)
    auth_audit.record(E.PASSWORD_RESET_TOKEN_CREATED, user_id=user.id, email=user.email, expires_in_minutes=minutes)


def reset_password(token: str, new_password: str) -> None:
    _check_password_rule(new_password)
    now = utcnow()
    reset = PasswordReset.query.filter_by(token_hash=secrets.digest(token or "")).first()
    if not reset or reset.used_at is not None or reset.expires_at <= now:
        reason = "unknown_token" if not reset else ("already_used" if reset.used_at else "expired")
        auth_audit.record(E.PASSWORD_RESET_FAILED, False, user_id=reset.user_id if reset else None, reason=reason)
        raise AppError(GENERIC_RESET_ERROR, status_code=400, code="INVALID_RESET_LINK")

    credential = db.session.get(PasswordCredential, reset.user_id)
    user = account_service.get(reset.user_id)
    if not credential or not user:
        raise AppError(GENERIC_RESET_ERROR, status_code=400, code="INVALID_RESET_LINK")

    reset.used_at = now
    credential.password_hash = hash_password(new_password)
    credential.changed_at = now
    credential.failed_attempts = 0
    credential.locked_until = None
    # The link arrived by email, so the address is proven.
    account_service.mark_verified(user)
    ended = session_service.revoke_all(user.id, session_service.RevokeReason.PASSWORD_RESET)
    db.session.commit()
    auth_audit.record(E.PASSWORD_RESET_SUCCESS, user_id=user.id, email=user.email)
    auth_audit.record(E.TOKEN_REVOKED, user_id=user.id, email=user.email, reason="password_reset", sessions_ended=ended)
