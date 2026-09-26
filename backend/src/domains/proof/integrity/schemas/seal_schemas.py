"""
What "check my record" accepts: exactly the seal the app was given, and
nothing else. Every field is typed and bounded (hex lengths, base64 sizes,
at most MAX_RECORDS leaves); unknown fields are refused at every level.
"""
from __future__ import annotations

from marshmallow import RAISE, Schema, ValidationError as MarshmallowError, fields, validate

from src.core.exceptions import ValidationError

from ..services.seal_service import KINDS, MAX_RECORDS

HEX64 = validate.Regexp(r"^[0-9a-f]{64}$", error="Not a fingerprint.")
HEX16 = validate.Regexp(r"^[0-9a-f]{16}$", error="Not a key id.")


class _Strict(Schema):
    class Meta:
        unknown = RAISE


class _Signatures(_Strict):
    ed25519 = fields.String(required=True, validate=validate.Length(1, 200))
    ml_dsa_65 = fields.String(load_default=None, allow_none=True, validate=validate.Length(1, 6000))


class _KeyIds(_Strict):
    ed25519 = fields.String(required=True, validate=HEX16)
    ml_dsa_65 = fields.String(load_default=None, allow_none=True, validate=HEX16)


class _Seal(_Strict):
    v = fields.Integer(required=True, strict=True, validate=validate.Equal(1))
    alg = fields.List(fields.String(validate=validate.OneOf(["Ed25519", "ML-DSA-65"])), required=True, validate=validate.Length(1, 2))
    business = fields.String(required=True, validate=validate.Length(1, 36))
    sealed_at = fields.String(required=True, validate=validate.Length(1, 40))
    count = fields.Integer(required=True, strict=True, validate=validate.Range(0, MAX_RECORDS))
    root = fields.String(required=True, validate=HEX64)
    leaves = fields.List(
        fields.Tuple((fields.String(validate=validate.OneOf(list(KINDS))), fields.String(validate=validate.Length(1, 64)), fields.String(validate=HEX64))),
        required=True,
        validate=validate.Length(max=MAX_RECORDS),
    )
    sig = fields.Nested(_Signatures, required=True)
    key_ids = fields.Nested(_KeyIds, required=True)


class CheckSchema(_Strict):
    seal = fields.Nested(_Seal, required=True)


def load(schema: Schema, data) -> dict:
    try:
        return schema.load(data if isinstance(data, dict) else {})
    except MarshmallowError as e:
        raise ValidationError("Send the seal exactly as the app saved it.", errors=[e.messages]) from None
