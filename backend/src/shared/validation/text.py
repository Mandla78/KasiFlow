"""
Clean text from users: names, addresses, short descriptions.

What people (and attackers) actually type into a name box:
  - stray spaces, several spaces, a line break from a paste
  - invisible characters: zero-width spaces, a right-to-left override that
    makes "evil.exe" read as "exe.live", control characters, the null
    character PostgreSQL can't even store
  - nothing visible at all

clean_text() returns the tidy version or raises ValueError(message):
  * Unicode-normalised (NFC), so "é" typed two ways is one string
  * control, format and private-use characters refused (the emoji joiner
    U+200D is allowed, so family/flag emoji still work)
  * whitespace runs collapsed to one space, ends trimmed
  * length checked AFTER cleaning; a required value needs at least one
    letter or number

CleanText is the marshmallow field that applies it; use it for every
free-text field instead of fields.String. BusinessName and PersonName add
the stricter rules for names (the app's shared/lib/validation.ts mirrors
them for instant messages; the server decides).
"""
from __future__ import annotations

import re
import unicodedata

from marshmallow import ValidationError, fields

# Allowed despite being a "format" character: joins emoji sequences.
_ALLOWED_FORMAT = {"‍"}
_WHITESPACE_RUN = re.compile(r"\s+")


def _bad_char(ch: str) -> bool:
    category = unicodedata.category(ch)
    if ch in _ALLOWED_FORMAT:
        return False
    if category == "Cc":  # control (incl. NUL); whitespace ones are folded below
        return ch not in "\t\n\r"
    return category in ("Cf", "Cs", "Co", "Cn")  # format, surrogates, private use, unassigned


def clean_text(value: str, *, min_len: int = 0, max_len: int = 200) -> str:
    text = unicodedata.normalize("NFC", value)
    if any(_bad_char(ch) for ch in text):
        raise ValueError("Remove the hidden or special characters.")
    text = _WHITESPACE_RUN.sub(" ", text).strip()
    if min_len and not any(ch.isalnum() for ch in text):
        raise ValueError("Enter a name with letters or numbers.")
    if len(text) < min_len:
        raise ValueError(f"Use at least {min_len} characters.")
    if len(text) > max_len:
        raise ValueError(f"Use at most {max_len} characters.")
    return text


class CleanText(fields.String):
    """fields.String that runs clean_text. min_len > 0 means "required to
    have visible content"; pass allow_none/load_default as usual."""

    def __init__(self, *, min_len: int = 0, max_len: int = 200, **kwargs):
        super().__init__(**kwargs)
        self._min_len = min_len
        self._max_len = max_len

    def _deserialize(self, value, attr, data, **kwargs):
        text = super()._deserialize(value, attr, data, **kwargs)
        try:
            return clean_text(text, min_len=self._min_len, max_len=self._max_len)
        except ValueError as e:
            raise ValidationError(str(e)) from None


# ------------------------------------------------------------------- names

#: Symbols a real business name uses ("Nomsa's Spaza & Deli", "Shop 24/7").
BUSINESS_NAME_SYMBOLS = set(" &'’-.,()/+#")
#: Symbols in a person's name ("Mary-Jane O'Neil", "Dr. N. Dlamini").
PERSON_NAME_SYMBOLS = set(" '’-.")

BUSINESS_NAME_RULE = "Use letters for the business name (numbers and & - ' . are fine; no emoji)."
PERSON_NAME_RULE = "Use letters for your name (no numbers or emoji)."


def _letters(text: str) -> int:
    return sum(1 for ch in text if ch.isalpha())


def business_name(value: str) -> str:
    """At least 2 DIFFERENT letters, only letters/digits/a few symbols:
    refuses "12334566", "00000", emoji, "aaaa", "a1 a1"."""
    text = clean_text(value, min_len=2, max_len=80)
    allowed = all(ch.isalpha() or ch.isdigit() or ch in BUSINESS_NAME_SYMBOLS or unicodedata.category(ch).startswith("M") for ch in text)
    distinct_letters = {ch.lower() for ch in text if ch.isalpha()}
    if not allowed or len(distinct_letters) < 2:
        raise ValueError(BUSINESS_NAME_RULE)
    return text


def person_name(value: str) -> str:
    """At least 2 letters; letters, spaces and ' - . only."""
    text = clean_text(value, min_len=2, max_len=80)
    allowed = all(ch.isalpha() or ch in PERSON_NAME_SYMBOLS or unicodedata.category(ch).startswith("M") for ch in text)
    if not allowed or _letters(text) < 2:
        raise ValueError(PERSON_NAME_RULE)
    return text


class _RuleText(fields.String):
    _rule = staticmethod(clean_text)

    def _deserialize(self, value, attr, data, **kwargs):
        text = super()._deserialize(value, attr, data, **kwargs)
        try:
            return self._rule(text)
        except ValueError as e:
            raise ValidationError(str(e)) from None


class BusinessName(_RuleText):
    _rule = staticmethod(business_name)


class PersonName(_RuleText):
    _rule = staticmethod(person_name)
