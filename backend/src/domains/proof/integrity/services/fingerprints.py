"""
How a record becomes a fingerprint, and many fingerprints one root.
Nothing here is secret: anyone holding a seal can redo it.

  canonical(obj)            JSON, keys sorted, no spaces, UTF-8; dates and
                            times as ISO 8601 (times in UTC); ids as text
  leaf(kind, id, fields)    SHA-256(0x00 || canonical({"kind", "id", "fields"}))
  root(leaves)              the Merkle tree hash of RFC 6962 over the leaves
                            in (kind, id) order: a node is
                            SHA-256(0x01 || left || right)

The 0x00 / 0x01 prefixes keep a leaf from ever passing for a node.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import date, datetime, timezone
from typing import Any


def _plain(v: Any) -> Any:
    if isinstance(v, datetime):
        return (v if v.tzinfo else v.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, (list, tuple)):
        return [_plain(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _plain(x) for k, x in v.items()}
    return v


def canonical(obj: Any) -> bytes:
    return json.dumps(_plain(obj), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def leaf(kind: str, rid: str, fields: dict) -> bytes:
    return hashlib.sha256(b"\x00" + canonical({"kind": kind, "id": rid, "fields": fields})).digest()


def root(leaves: list[bytes]) -> bytes:
    """RFC 6962 section 2.1: split at the largest power of two below n."""
    n = len(leaves)
    if n == 0:
        return hashlib.sha256(b"").digest()
    if n == 1:
        return leaves[0]
    k = 1
    while k * 2 < n:
        k *= 2
    return hashlib.sha256(b"\x01" + root(leaves[:k]) + root(leaves[k:])).digest()
