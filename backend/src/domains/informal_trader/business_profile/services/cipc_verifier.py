"""
The CIPC check: is the company real and active, and is THIS person one of
its directors? The register is public, so a number alone proves nothing
about who typed it: only a director-name match earns "verified".

Providers (CIPC_PROVIDER):
  sandbox   a small fake register, for development and tests. Same test
            numbers as the app's mock:
              2020/123456/07  active, director NOMSA DLAMINI
              2021/654321/07  active, director THABO MOKOENA
              2019/111111/07  deregistered
              2018/999999/07  CIPC not answering
  none      no provider connected: every check is "unavailable" (never a
            fake "verified"). The production default until a real CIPC
            data provider is contracted; swapping one in is a new class
            here, nothing else changes.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from flask import current_app


@dataclass
class CipcResult:
    status: str  # verified / owner_unconfirmed / deregistered / not_found / unavailable
    registered_name: Optional[str] = None
    entity_type: Optional[str] = None


_SANDBOX_REGISTER = {
    "2020/123456/07": ("N DLAMINI TRADING (PTY) LTD", "Private Company", "In Business", ["NOMSA DLAMINI"]),
    "2021/654321/07": ("MOKOENA BUILD (PTY) LTD", "Private Company", "In Business", ["THABO MOKOENA"]),
    "2019/111111/07": ("KASI BUILD CC", "Close Corporation", "Deregistered", ["SIPHO NDLOVU"]),
}
_SANDBOX_DOWN = "2018/999999/07"


def same_person(director: str, person: str) -> bool:
    """Every word of the person's name appears in the director's name
    (case and spacing ignored), so "Nomsa Dlamini" matches "NOMSA P DLAMINI"."""
    words = [w for w in person.upper().split() if w]
    names = director.upper().split()
    return bool(words) and all(w in names for w in words)


def _sandbox(number: str, owner_name: str) -> CipcResult:
    if number == _SANDBOX_DOWN:
        return CipcResult("unavailable")
    company = _SANDBOX_REGISTER.get(number)
    if not company:
        return CipcResult("not_found")
    name, kind, state, directors = company
    if state != "In Business":
        return CipcResult("deregistered", name, kind)
    owns = any(same_person(d, owner_name) for d in directors)
    return CipcResult("verified" if owns else "owner_unconfirmed", name, kind)


def check(number: str, owner_name: str) -> CipcResult:
    provider = current_app.config["CIPC_PROVIDER"]
    if provider == "sandbox":
        return _sandbox(number, owner_name or "")
    return CipcResult("unavailable")
