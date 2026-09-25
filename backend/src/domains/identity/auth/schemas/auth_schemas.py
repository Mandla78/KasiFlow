"""
What the auth endpoints accept. Unknown fields are rejected, lengths are
capped (no megabyte "passwords"), and emails must look like emails.
The password RULE itself is checked in the service, with a single message.
"""
from __future__ import annotations

from marshmallow import RAISE, Schema, fields, pre_load, validate

from src.core.exceptions import ValidationError
from src.shared.validation.text import CleanText

_email = fields.Email(required=True, validate=validate.Length(max=254))
_password = fields.String(required=True, validate=validate.Length(min=1, max=128))


class _Strict(Schema):
    class Meta:
        unknown = RAISE

    @pre_load
    def _trim_email(self, data, **_kwargs):
        # Phone keyboards add stray spaces; trim before the email check.
        if isinstance(data, dict) and isinstance(data.get("email"), str):
            data = {**data, "email": data["email"].strip()}
        return data


class DeviceSchema(_Strict):
    public_key = fields.String(required=True, validate=validate.Length(min=40, max=64))
    #: The phone signs "akayza-device:<public_key>" with its private key:
    #: proof it really holds the key, not just a copied public key.
    signature = fields.String(required=True, validate=validate.Length(min=80, max=100))
    platform = fields.String(load_default=None, validate=validate.Length(max=20))
    label = fields.String(load_default=None, validate=validate.Length(max=80))


class PhoneSchema(_Strict):
    """How the phone names itself on the Security screen. Not a secret."""

    platform = fields.String(load_default=None, validate=validate.OneOf(["android", "ios", "web"]))
    label = fields.String(load_default=None, validate=validate.Length(max=80))


_code = fields.String(required=True, validate=validate.Regexp(r"^\d{6}$", error="Enter the 6-digit code."))
_challenge = fields.String(required=True, validate=validate.Length(min=20, max=100))


class ConsentSchema(_Strict):
    privacy_version = fields.String(required=True, validate=validate.Length(max=30))
    terms_version = fields.String(required=True, validate=validate.Length(max=30))


class RegisterSchema(_Strict):
    business_name = CleanText(required=True, min_len=2, max_len=80)
    email = _email
    password = _password
    consent = fields.Nested(ConsentSchema, required=True)


class VerifyEmailSchema(_Strict):
    email = _email
    code = _code
    device = fields.Nested(DeviceSchema, load_default=None)
    phone = fields.Nested(PhoneSchema, load_default=None)


class EmailOnlySchema(_Strict):
    email = _email


class LoginSchema(_Strict):
    email = _email
    password = _password
    device = fields.Nested(DeviceSchema, load_default=None)
    #: Given to this phone after it passed an email code; skips the code.
    trusted_phone_token = fields.String(load_default=None, validate=validate.Length(min=20, max=100))
    phone = fields.Nested(PhoneSchema, load_default=None)


class VerifySignInSchema(_Strict):
    challenge = _challenge
    code = _code
    device = fields.Nested(DeviceSchema, load_default=None)
    phone = fields.Nested(PhoneSchema, load_default=None)


class ChallengeSchema(_Strict):
    challenge = _challenge


class GoogleSignInSchema(_Strict):
    id_token = fields.String(required=True, validate=validate.Length(min=20, max=4096))
    business_name = CleanText(load_default=None, min_len=2, max_len=80)
    consent = fields.Nested(ConsentSchema, load_default=None)
    device = fields.Nested(DeviceSchema, load_default=None)


class GoogleLinkSchema(_Strict):
    id_token = fields.String(required=True, validate=validate.Length(min=20, max=4096))
    password = _password
    device = fields.Nested(DeviceSchema, load_default=None)


class ChangePasswordSchema(_Strict):
    current_password = _password
    new_password = _password


class PasswordConfirmSchema(_Strict):
    password = _password


class ResetPasswordSchema(_Strict):
    token = fields.String(required=True, validate=validate.Length(min=20, max=100))
    password = _password


def load(schema: Schema, data) -> dict:
    """Validate a JSON body or raise our 422 with field errors."""
    from marshmallow import ValidationError as MarshmallowError

    try:
        return schema.load(data or {})
    except MarshmallowError as e:
        raise ValidationError("Please check the highlighted fields.", errors=[e.messages]) from None
