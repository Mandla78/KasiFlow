"""
Password security utilities.
 "SECURITY" -- bcrypt hashing; never expose
password hashes.
"""
import re

import bcrypt

# THE PASSWORD RULE, identical to frontend/mobile/src/shared/lib/validation.ts
# (passwordRules). The server must never be more permissive than the app,
# or a request that bypasses the app could set a weaker password than the
# screen promised. Change both together.
PASSWORD_MIN_LENGTH = 8
# bcrypt only reads the first 72 BYTES; a longer password would be silently
# truncated (or rejected by the bcrypt library), so cap it well below that.
PASSWORD_MAX_LENGTH = 64
# "Special" = anything that is not a letter, a digit or whitespace, so any
# symbol on a phone keyboard counts, not just a short fixed list.
_SPECIAL = re.compile(r"[^A-Za-z0-9\s]")


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password for storage. NEVER store plain_password
    itself, and never log it."""
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password attempt against a stored bcrypt hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def validate_password_complexity(password: str) -> list[str]:
    """Returns a list of human-readable complexity violations (empty list
    means valid).

    Kept in sync with the mobile app's passwordRules, so a password
    accepted by one is accepted by the other.
    """
    errors: list[str] = []

    if len(password) < PASSWORD_MIN_LENGTH:
        errors.append(f"Password must be at least {PASSWORD_MIN_LENGTH} characters long.")
    if len(password) > PASSWORD_MAX_LENGTH:
        errors.append(f"Password must be at most {PASSWORD_MAX_LENGTH} characters long.")
    if not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter.")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter.")
    if not re.search(r"\d", password):
        errors.append("Password must contain at least one number.")
    if not _SPECIAL.search(password):
        errors.append("Password must contain at least one special character.")

    return errors


def passwords_match(password: str, confirm_password: str) -> bool:
    """Equality helper used by registration and password-change flows."""
    return password == confirm_password