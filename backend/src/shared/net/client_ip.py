"""
The client's IP address: the one place the app decides it
(docs/teammate/feedback/FINDING_client_ip_behind_cloudflare.txt).

  client_ip()       the address, or None outside a request
  client_ip_key()   the same for rate-limit keys (never empty)

BEHIND_CLOUDFLARE off (the default): the address of the connection itself
(request.remote_addr), full stop. Every forwarding header is ignored:
X-Forwarded-For, CF-Connecting-IP and the rest are typed by the caller as
easily as the body is.

BEHIND_CLOUDFLARE on: Cloudflare's CF-Connecting-IP, which Cloudflare
itself sets on every request it passes on, when it holds exactly one valid
IP address; otherwise remote_addr. Switch it on ONLY when the server can be
reached through Cloudflare alone (a cloudflared tunnel, or a firewall that
lets in Cloudflare's addresses only): anyone who reaches the server
directly can send that header too.

Used by the rate limiter (every per-IP key and the login key), the 429
audit, sessions, auth_service and audit_context. PayFast keeps its own
rule (PAYFAST_TRUST_PROXY, commerce/payments) while we run ngrok.
"""
from __future__ import annotations

import ipaddress
from typing import Optional

from flask import current_app, has_request_context, request

CLOUDFLARE_HEADER = "CF-Connecting-IP"
#: The longest text form of an IPv6 address.
MAX_LEN = 45


def _one_ip(value: str) -> Optional[str]:
    """The header's value as one IP address in its normal form, or None
    (empty, a list, a name, garbage, too long)."""
    value = value.strip()
    if not value or len(value) > MAX_LEN:
        return None
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None


def client_ip() -> Optional[str]:
    if not has_request_context():
        return None
    if current_app.config.get("BEHIND_CLOUDFLARE"):
        ip = _one_ip(request.headers.get(CLOUDFLARE_HEADER, ""))
        if ip:
            return ip
    return request.remote_addr


def client_ip_key() -> str:
    """For rate-limit keys, like flask-limiter's get_remote_address."""
    return client_ip() or "127.0.0.1"
