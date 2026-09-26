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
  * TWO FACTORS TO SIGN IN. The right password on a phone we don't trust
    yet only earns a code by email; the session starts when the code is
    entered, and that phone is then trusted (see trusted_phones.py). The
    code step is only reached with the right password, so it reveals
    nothing to someone guessing.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from flask import current_app, request

from src.core.base_model import utcnow
from src.core.exceptions import AccountInactiveError, AccountLockedError, AppError, EmailNotVerifiedError, UnauthorizedError, ValidationError
from src.domains.identity.accounts.models import AccountStatus, SignUpMethod
from src.domains.identity.accounts.services import account_service
from src.domains.identity.devices.services import device_service
from src.extensions import db
from src.shared.audit.event_types.auth import AuthAuditEvent as E
from src.shared.email.email import EmailService
from src.shared.net.client_ip import client_ip
from src.shared.security.security import hash_password, validate_password_complexity, verify_password

from ..models import CodePurpose, EmailCode, GoogleIdentity, PasswordCredential, PasswordReset
from . import auth_alerts, auth_audit, google_verifier, secrets, session_service, trusted_phones

logger = logging.getLogger("akayza.auth")

# Compared against when an account doesn't exist, so a wrong email takes as
# long as a wrong password (bcrypt is deliberately slow).
_DUMMY_HASH = hash_password("dummy-password-for-timing-1!A")

GENERIC_LOGIN_ERROR = "Email or password is incorrect."
GENERIC_CODE_ERROR = "That code is wrong or has expired."
GENERIC_RESET_ERROR = "This link is not valid any more. Ask for a new one."
GENERIC_SIGN_IN_CODE_ERROR = "That code is wrong or has expired."

#: Codes one sign-in attempt can ask for (the first + resends) before the
#: password has to be entered again.
MAX_CODES_PER_SIGN_IN = 3


class InvalidCodeError(AppError):
    status_code = 400
    code = "INVALID_CODE"


@dataclass
class PhoneInfo:
    """What the phone says about itself, to name it in the Security screen."""

    platform: Optional[str] = None
    label: Optional[str] = None


@dataclass
class DeviceInfo:
    public_key: str
    signature: str
    platform: Optional[str] = None
    label: Optional[str] = None


def _ip() -> Optional[str]:
    return client_ip()


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


def _tokens(user, device: Optional[DeviceInfo], trusted_phone_id=None) -> dict:
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
    tokens, sid = session_service.start(user.id, device_id, trusted_phone_id)
    auth_audit.record(E.TOKEN_CREATED, user_id=user.id, email=user.email, session_id=sid, device_id=device_id)
    return {**tokens, "user": account_service.public_view(user)}


def _trust_this_phone(user, phone: Optional[PhoneInfo]) -> tuple:
    """After an emailed code: this phone skips the code from now on."""
    phone = phone or PhoneInfo()
    row, token = trusted_phones.add(user.id, phone.platform, phone.label)
    auth_audit.record(E.TRUSTED_PHONE_ADDED, user_id=user.id, email=user.email, trusted_phone_id=str(row.id), platform=phone.platform)
    return row, token


# --------------------------------------------------------------- register


def register(email: str, password: str, privacy_version: str, terms_version: str) -> None:
    """Email, password and consent only. The business name and everything
    else about the business come in the onboarding steps (business profile)."""
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
        account_service.restart_unverified(user)
        credential = db.session.get(PasswordCredential, user.id)
        credential.password_hash = hash_password(password)
        credential.changed_at = utcnow()
    else:
        user = account_service.create_unverified(email)
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


def verify_email(email: str, code: str, device: Optional[DeviceInfo], phone: Optional[PhoneInfo] = None) -> dict:
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
    # The code reached this phone from the inbox: it is trusted from the start.
    trusted, trusted_token = _trust_this_phone(user, phone)
    result = _tokens(user, device, trusted.id)
    db.session.commit()
    auth_audit.record(E.EMAIL_VERIFIED, user_id=user.id, email=user.email)
    return {**result, "trusted_phone_token": trusted_token}


# ------------------------------------------------------------------ login


def login(
    email: str,
    password: str,
    device: Optional[DeviceInfo],
    trusted_phone_token: Optional[str] = None,
    phone: Optional[PhoneInfo] = None,
) -> dict:
    """Right password on a trusted phone -> signed in. Right password on
    any other phone -> {"code_required": True, "challenge": ...} and a code
    by email; finish with verify_sign_in."""
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
        just_locked = credential.failed_attempts >= current_app.config["LOGIN_MAX_FAILED_ATTEMPTS"]
        if just_locked:
            credential.locked_until = now + timedelta(minutes=current_app.config["LOGIN_LOCKOUT_MINUTES"])
            credential.failed_attempts = 0
            auth_audit.record(E.LOGIN_LOCKED, False, user_id=user.id, email=user.email, reason="too_many_failed_passwords")
        else:
            auth_audit.record(E.LOGIN_FAILED, False, user_id=user.id, email=user.email, reason="wrong_password", attempts=credential.failed_attempts)
        db.session.commit()
        if just_locked:
            auth_alerts.locked(user.id, credential.locked_until, current_app.config["LOGIN_LOCKOUT_MINUTES"])
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

    trusted = trusted_phones.match(user.id, trusted_phone_token)
    if not trusted:
        challenge = secrets.new_token()
        _send_sign_in_code(user, secrets.digest(challenge))
        db.session.commit()
        auth_audit.record(
            E.LOGIN_CODE_REQUIRED, user_id=user.id, email=user.email,
            reason="unknown_phone" if not trusted_phone_token else "phone_not_trusted",
        )
        return {"code_required": True, "challenge": challenge, "expires_in_minutes": current_app.config["EMAIL_CODE_EXPIRY_MINUTES"]}

    result = _tokens(user, device, trusted.id)
    db.session.commit()
    auth_audit.record(E.LOGIN_SUCCESS, user_id=user.id, email=user.email, second_factor="trusted_phone", trusted_phone_id=str(trusted.id))
    return result


def _send_sign_in_code(user, challenge_hash: str, resent: bool = False) -> None:
    """A fresh code for this sign-in attempt; any earlier one for it dies."""
    now = utcnow()
    EmailCode.query.filter_by(user_id=user.id, purpose=CodePurpose.SIGN_IN.value, challenge_hash=challenge_hash, used_at=None).update(
        {"used_at": now}
    )
    code = secrets.new_code()
    minutes = current_app.config["EMAIL_CODE_EXPIRY_MINUTES"]
    db.session.add(
        EmailCode(
            user_id=user.id,
            purpose=CodePurpose.SIGN_IN.value,
            challenge_hash=challenge_hash,
            code_hash=secrets.digest(code),
            expires_at=now + timedelta(minutes=minutes),
        )
    )
    EmailService.send_template(
        to=user.email,
        template_name="sign_in_code.html",
        subject="Your Akayza sign-in code",
        context={"code": code, "minutes": minutes},
        rate_limit_key=f"sign_in_code:{user.email}",
        rate_limit_max=6,
        rate_limit_window_seconds=3600,
    )
    auth_audit.record(E.OTP_RESENT if resent else E.OTP_SENT, user_id=user.id, email=user.email, purpose="sign_in")


def _live_sign_in_code(challenge: str) -> Optional[EmailCode]:
    return (
        EmailCode.query.filter_by(purpose=CodePurpose.SIGN_IN.value, challenge_hash=secrets.digest(challenge or ""), used_at=None)
        .order_by(EmailCode.created_at.desc())
        .first()
    )


def verify_sign_in(challenge: str, code: str, device: Optional[DeviceInfo], phone: Optional[PhoneInfo] = None) -> dict:
    """Second step: the code from the email, with the challenge from step one."""
    now = utcnow()
    record = _live_sign_in_code(challenge)
    if not record or record.expires_at <= now:
        auth_audit.record(E.OTP_FAILED, False, user_id=record.user_id if record else None, reason="no_valid_code", purpose="sign_in")
        raise InvalidCodeError(GENERIC_SIGN_IN_CODE_ERROR)
    user = account_service.get(record.user_id)
    if not user or not user.is_active:
        record.used_at = now
        db.session.commit()
        raise InvalidCodeError(GENERIC_SIGN_IN_CODE_ERROR)

    if not secrets.matches((code or "").strip(), record.code_hash):
        record.attempts += 1
        burnt = record.attempts >= current_app.config["EMAIL_CODE_MAX_ATTEMPTS"]
        if burnt:
            record.used_at = now
        db.session.commit()
        auth_audit.record(
            E.OTP_EXPIRED if burnt else E.OTP_FAILED, False, user_id=user.id, email=user.email,
            reason="too_many_attempts" if burnt else "wrong_code", attempts=record.attempts, purpose="sign_in",
        )
        raise InvalidCodeError(GENERIC_SIGN_IN_CODE_ERROR)

    record.used_at = now
    auth_audit.record(E.OTP_VERIFIED, user_id=user.id, email=user.email, purpose="sign_in")
    trusted, trusted_token = _trust_this_phone(user, phone)
    result = _tokens(user, device, trusted.id)
    db.session.commit()
    auth_audit.record(E.LOGIN_SUCCESS, user_id=user.id, email=user.email, second_factor="email_code", trusted_phone_id=str(trusted.id))
    # A phone that needed an emailed code is a phone the account hasn't seen: tell the owner.
    auth_alerts.new_phone(user.id, trusted.id)
    return {**result, "trusted_phone_token": trusted_token}


def resend_sign_in_code(challenge: str) -> None:
    """A new code for the same sign-in attempt. Same answer whatever happens;
    after MAX_CODES_PER_SIGN_IN codes the password has to be entered again."""
    record = _live_sign_in_code(challenge)
    if not record or record.expires_at <= utcnow():
        return
    challenge_hash = record.challenge_hash
    sent = EmailCode.query.filter_by(purpose=CodePurpose.SIGN_IN.value, challenge_hash=challenge_hash).count()
    user = account_service.get(record.user_id)
    if sent >= MAX_CODES_PER_SIGN_IN or not user or not user.is_active:
        auth_audit.record(E.OTP_REQUEST_RATE_LIMITED, False, user_id=record.user_id, reason="too_many_codes", purpose="sign_in")
        return
    _send_sign_in_code(user, challenge_hash, resent=True)
    db.session.commit()


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
        context={"link": f"{current_app.config['APP_BASE_URL']}/reset-password?ticket={token}", "minutes": minutes},
        rate_limit_key=f"password_reset:{user.email}",
        rate_limit_max=3,
        rate_limit_window_seconds=3600,
    )
    auth_audit.record(E.PASSWORD_RESET_REQUESTED, user_id=user.id, email=user.email)
    auth_audit.record(E.PASSWORD_RESET_TOKEN_CREATED, user_id=user.id, email=user.email, expires_in_minutes=minutes)


def reset_link_is_valid(token: str) -> bool:
    """For the reset page: is this ticket still usable? (Doesn't use it up.)"""
    reset = PasswordReset.query.filter_by(token_hash=secrets.digest(token or "")).first()
    return bool(reset and reset.used_at is None and reset.expires_at > utcnow())


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
    auth_alerts.password_changed(user.id, now)
    auth_audit.record(E.TOKEN_REVOKED, user_id=user.id, email=user.email, reason="password_reset", sessions_ended=ended)


# -------------------------------------------------------- account security
# Every function here acts on the SIGNED-IN user only (from the token);
# none takes a user id from the request, so there is nothing to swap.


def _require_password(user, password: str, failed_event) -> PasswordCredential:
    """Re-check the password before a sensitive action. Wrong guesses count
    toward the same lockout as sign-in."""
    credential = db.session.get(PasswordCredential, user.id)
    if not credential:
        raise AppError("This account has no password. Sign in with Google instead.", status_code=400, code="NO_PASSWORD")
    now = utcnow()
    if credential.locked_until and credential.locked_until > now:
        raise AccountLockedError("Too many attempts. Try again in a few minutes.")
    if not verify_password(password, credential.password_hash):
        credential.failed_attempts += 1
        just_locked = credential.failed_attempts >= current_app.config["LOGIN_MAX_FAILED_ATTEMPTS"]
        if just_locked:
            credential.locked_until = now + timedelta(minutes=current_app.config["LOGIN_LOCKOUT_MINUTES"])
            credential.failed_attempts = 0
        db.session.commit()
        auth_audit.record(failed_event, False, user_id=user.id, email=user.email, reason="wrong_password")
        if just_locked:
            auth_alerts.locked(user.id, credential.locked_until, current_app.config["LOGIN_LOCKOUT_MINUTES"])
        raise AppError("That password is incorrect.", status_code=400, code="WRONG_PASSWORD")
    credential.failed_attempts = 0
    return credential


def change_password(user, current_sid: str, current_password: str, new_password: str) -> int:
    credential = _require_password(user, current_password, E.PASSWORD_CHANGE_FAILED)
    _check_password_rule(new_password)
    if verify_password(new_password, credential.password_hash):
        raise ValidationError("Choose a new password, not your current one.", code="PASSWORD_UNCHANGED")
    credential.password_hash = hash_password(new_password)
    credential.changed_at = utcnow()
    ended = session_service.revoke_all_except(user.id, current_sid, session_service.RevokeReason.PASSWORD_CHANGE)
    db.session.commit()
    auth_audit.record(E.PASSWORD_CHANGED, user_id=user.id, email=user.email, session_id=current_sid, other_sessions_ended=ended)
    auth_alerts.password_changed(user.id, credential.changed_at)
    return ended


def sign_out_other_phones(user, current_sid: str) -> int:
    """Other phones are signed out AND stop being trusted: to come back they
    need the password and a fresh code from the owner's email."""
    current = session_service.get(current_sid)
    ended = session_service.revoke_all_except(user.id, current_sid, session_service.RevokeReason.OTHERS_SIGNED_OUT)
    keep = current.trusted_phone_id if current else None
    untrusted = trusted_phones.revoke_all(user.id, trusted_phones.RevokeReason.SIGNED_OUT, keep_id=keep)
    db.session.commit()
    auth_audit.record(
        E.LOGOUT_ALL_DEVICES, user_id=user.id, email=user.email, session_id=current_sid, sessions_ended=ended, phones_untrusted=untrusted,
    )
    if untrusted:
        auth_audit.record(E.TRUSTED_PHONE_REVOKED, user_id=user.id, email=user.email, reason="others_signed_out", count=untrusted)
    auth_alerts.phones_signed_out(user.id, utcnow())
    return ended


def signed_in_phones(user, current_sid: str) -> list[dict]:
    """Where the account is signed in. Never tokens, never raw IPs."""
    current = session_service.get(current_sid)
    devices = {d.id: d for d in device_service.list_for(user.id)}
    out = []
    for s in session_service.live_for(user.id):
        d = devices.get(s.device_id) or trusted_phones.get(s.trusted_phone_id)
        out.append(
            {
                "id": str(s.id),
                "this_phone": current is not None and s.id == current.id,
                "signed_in_at": s.created_at.isoformat(),
                "last_used_at": s.last_used_at.isoformat(),
                "platform": d.platform if d else None,
                "label": d.label if d else None,
            }
        )
    return out


def close_account(user, current_sid: str, password: str) -> None:
    _require_password(user, password, E.ACCOUNT_DISABLED)
    account_service.deactivate(user)
    ended = session_service.revoke_all(user.id, session_service.RevokeReason.ACCOUNT_CLOSED)
    keys = device_service.revoke_all(user.id)
    trusted_phones.revoke_all(user.id, trusted_phones.RevokeReason.ACCOUNT_CLOSED)
    db.session.commit()
    auth_audit.record(E.ACCOUNT_DISABLED, user_id=user.id, email=user.email, session_id=current_sid, sessions_ended=ended, device_keys_revoked=keys)


def export_my_data(user, current_sid: str) -> dict:
    """POPIA: everything identity holds about the signed-in user."""
    data = {
        "account": account_service.public_view(user)
        | {"created_at": user.created_at.isoformat(), "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None},
        "consents": account_service.consents_view(user),
        "signed_in_phones": signed_in_phones(user, current_sid),
        "phone_keys": [device_service.public_view(d) for d in device_service.list_for(user.id)],
        "trusted_phones": [trusted_phones.public_view(p) for p in trusted_phones.list_live(user.id)],
        "google_linked": db.session.get(GoogleIdentity, user.id) is not None,
    }
    auth_audit.record(E.DATA_EXPORTED, user_id=user.id, email=user.email, session_id=current_sid)
    return data


# ---------------------------------------------------- continue with Google


def _google_claims(id_token_value: str):
    try:
        return google_verifier.verify(id_token_value)
    except google_verifier.InvalidGoogleToken:
        auth_audit.record(E.GOOGLE_TOKEN_REJECTED, False, reason="invalid_google_token")
        raise


def google_sign_in(
    id_token_value: str,
    privacy_version: Optional[str],
    terms_version: Optional[str],
    device: Optional[DeviceInfo],
) -> dict:
    """
    Continue with Google. Outcomes:
      * this Google account is already linked       -> signed in
      * the email has a PASSWORD account             -> 409 GOOGLE_LINK_REQUIRED
        (never merged silently: the owner proves the password once)
      * new here (or a sign-up that was never verified) -> needs consent;
        422 GOOGLE_SIGNUP_DETAILS_REQUIRED until the app sends it
    """
    claims = _google_claims(id_token_value)

    link = GoogleIdentity.query.filter_by(google_sub=claims.sub).first()
    if link:
        user = account_service.get(link.user_id)
        if not user or not user.is_active:
            raise AccountInactiveError("This account is closed.")
        result = _tokens(user, device)
        db.session.commit()
        auth_audit.record(E.LOGIN_SUCCESS, user_id=user.id, email=user.email, method="google")
        return result

    user = account_service.find_by_email(claims.email)
    if user and user.status == AccountStatus.DEACTIVATED.value:
        raise AccountInactiveError("This account is closed.")
    if user and user.status == AccountStatus.ACTIVE.value and db.session.get(PasswordCredential, user.id):
        # Only someone holding a valid Google token for this email sees this.
        raise AppError(
            "You already have an account with a password. Enter it once to link Google.",
            status_code=409,
            code="GOOGLE_LINK_REQUIRED",
            data={"email": user.email},
        )

    if not privacy_version or not terms_version:
        raise AppError(
            "Accept the Privacy Policy and Terms to continue.",
            status_code=422,
            code="GOOGLE_SIGNUP_DETAILS_REQUIRED",
            data={"email": claims.email, "name": claims.name},
        )
    account_service.check_consent_versions(privacy_version, terms_version)

    claimed = False
    if user and user.status == AccountStatus.UNVERIFIED.value:
        # PRE-HIJACK DEFENCE: someone else may have signed up with this email
        # and set a password, waiting for the owner to verify it. The owner
        # has now proven the email through Google: that password is deleted.
        credential = db.session.get(PasswordCredential, user.id)
        if credential:
            db.session.delete(credential)
        EmailCode.query.filter_by(user_id=user.id, used_at=None).update({"used_at": utcnow()})
        account_service.claim_unverified_with(user, SignUpMethod.GOOGLE)
        claimed = True
    elif not user:
        user = account_service.create_verified(claims.email, SignUpMethod.GOOGLE)
    # (an active account with no password and no Google link can't normally
    # exist; if it does, the Google-proven email links it below)

    account_service.record_consents(user, privacy_version, terms_version, _ip(), request.headers.get("User-Agent"))
    db.session.add(GoogleIdentity(user_id=user.id, google_sub=claims.sub, email_at_link=user.email))
    result = _tokens(user, device)
    db.session.commit()
    auth_audit.record(
        E.REGISTER_SUCCESS, user_id=user.id, email=user.email, method="google",
        reason="unverified_signup_claimed" if claimed else None,
        privacy_version=privacy_version, terms_version=terms_version,
    )
    return result


def link_google(id_token_value: str, password: str, device: Optional[DeviceInfo]) -> dict:
    """Add Google to an existing password account: the password proves it's theirs."""
    claims = _google_claims(id_token_value)
    user = account_service.find_by_email(claims.email)
    if not user or not user.is_active:
        raise AppError("There's no account to link. Continue with Google to sign up.", status_code=400, code="NOTHING_TO_LINK")
    _require_password(user, password, E.LOGIN_FAILED)
    if GoogleIdentity.query.filter_by(google_sub=claims.sub).first() or db.session.get(GoogleIdentity, user.id):
        raise AppError("This Google account is already linked.", status_code=409, code="GOOGLE_ALREADY_LINKED")
    db.session.add(GoogleIdentity(user_id=user.id, google_sub=claims.sub, email_at_link=user.email))
    result = _tokens(user, device)
    db.session.commit()
    auth_audit.record(E.GOOGLE_LINKED, user_id=user.id, email=user.email)
    return result
