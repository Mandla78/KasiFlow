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
free-text field instead of fields.String.
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
