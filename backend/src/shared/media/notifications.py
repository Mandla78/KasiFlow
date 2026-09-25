"""
Callbacks from the storage service: malware-scan verdicts for files that
were uploaded while scanning was on.

The callback is the only proof of who's calling (no user, no token), so
it is checked first: a forged or stale callback is refused.

Each feature registers which files are its own and what to do with a
verdict (src/__init__.py does this at start-up):

    notifications.on_verdict(folders.is_informal_trader_profile_asset, profile_image_service.apply_verdict)

A handler must be idempotent: the service retries callbacks.
"""
from __future__ import annotations

import json
from typing import Callable, List, Tuple

from .provider import ScanVerdict, get_provider

_handlers: List[Tuple[Callable[[str], bool], Callable[[ScanVerdict], None]]] = []


class ForgedCallback(Exception):
    pass


def on_verdict(owns: Callable[[str], bool], handle: Callable[[ScanVerdict], None]) -> None:
    _handlers.append((owns, handle))


def clear_handlers() -> None:
    _handlers.clear()


def receive(body: str, timestamp: str, signature: str) -> ScanVerdict:
    provider = get_provider()
    if not provider.callback_is_genuine(body, timestamp, signature):
        raise ForgedCallback()
    verdict = provider.read_verdict(json.loads(body))
    if verdict.outcome != "none":
        for owns, handle in _handlers:
            if owns(verdict.public_id):
                handle(verdict)
                break
    return verdict
