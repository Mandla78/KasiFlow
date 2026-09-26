"""
PayFast's rules, as PayFast's own SDK implements them
(github.com/Payfast/payfast-php-sdk: lib/Auth.php, Notification.php).

SIGNATURE (payment form): the fields IN THE DOCUMENTED ORDER (not
alphabetical -- that's only for their separate API), empty values
skipped, each value trimmed and URL-encoded the PHP way (spaces as "+",
uppercase %XX), joined with "&", then "&passphrase=..." last, then MD5.
The split-payment "setup" field is NOT signed.

ITN (payment notification): trusted only if ALL FOUR pass --
  1. the signature, recomputed over the posted fields in the order they
     arrived (up to "signature") plus our passphrase, matches
  2. it comes from PayFast's own servers
  3. the amount equals what we asked for, to the cent
  4. PayFast answers VALID when we post the same fields back to them
"""
from __future__ import annotations

import hashlib
import json
import socket
from typing import Optional
from urllib.parse import quote_plus

import requests
from flask import current_app

#: The payment form's fields, in the order PayFast signs them.
FORM_ORDER = (
    "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url", "notify_method",
    "name_first", "name_last", "email_address", "cell_number", "m_payment_id", "amount",
    "item_name", "item_description", "custom_int1", "custom_int2", "custom_int3", "custom_int4",
    "custom_int5", "custom_str1", "custom_str2", "custom_str3", "custom_str4", "custom_str5",
    "email_confirmation", "confirmation_address", "currency", "payment_method",
)

#: Where PayFast's notifications come from.
PAYFAST_HOSTS = ("www.payfast.co.za", "sandbox.payfast.co.za", "w1w.payfast.co.za", "w2w.payfast.co.za")
VALIDATE_TIMEOUT_SECONDS = 15


def base_url() -> str:
    return "https://www.payfast.co.za" if current_app.config["PAYFAST_MODE"] == "live" else "https://sandbox.payfast.co.za"


def process_url() -> str:
    return f"{base_url()}/eng/process"


def _enc(value: str) -> str:
    """PHP urlencode: spaces as "+", uppercase hex, "~" encoded."""
    return quote_plus(str(value).strip(), safe="").replace("~", "%7E")


def form_signature(fields: dict[str, str], passphrase: str) -> str:
    parts = [f"{k}={_enc(fields[k])}" for k in FORM_ORDER if k in fields and str(fields[k]).strip() != ""]
    if passphrase:
        parts.append(f"passphrase={_enc(passphrase)}")
    return hashlib.md5("&".join(parts).encode("utf-8")).hexdigest()


def rands(cents: int) -> str:
    return f"{cents // 100}.{cents % 100:02d}"


def payment_form(*, payment_id: str, amount_cents: int, item_name: str, item_description: str,
                 return_url: str, cancel_url: str, notify_url: str, split_merchant_id: Optional[str] = None,
                 split_cents: Optional[int] = None) -> dict[str, str]:
    """The fields to POST to PayFast's process page, signed."""
    cfg = current_app.config
    fields = {
        "merchant_id": cfg["PAYFAST_MERCHANT_ID"],
        "merchant_key": cfg["PAYFAST_MERCHANT_KEY"],
        "return_url": return_url,
        "cancel_url": cancel_url,
        "notify_url": notify_url,
        "m_payment_id": payment_id,
        "amount": rands(amount_cents),
        "item_name": item_name[:100],
        "item_description": item_description[:255],
    }
    fields["signature"] = form_signature(fields, cfg["PAYFAST_PASSPHRASE"])
    if split_merchant_id and split_cents:
        # The supplier's share goes to their own PayFast account. Not signed.
        fields["setup"] = json.dumps({"split_payment": {"merchant_id": int(split_merchant_id), "amount": split_cents}})
    return fields


# ------------------------------------------------------------ notifications


def itn_param_string(posted: list[tuple[str, str]]) -> str:
    """The posted fields in arrival order, up to "signature", encoded."""
    parts = []
    for key, value in posted:
        if key == "signature":
            break
        parts.append(f"{key}={_enc(value)}")
    return "&".join(parts)


def itn_signature_ok(posted: list[tuple[str, str]], passphrase: str) -> bool:
    sent = dict(posted).get("signature", "")
    base = itn_param_string(posted)
    if passphrase:
        base += f"&passphrase={_enc(passphrase)}"
    return bool(sent) and hashlib.md5(base.encode("utf-8")).hexdigest() == sent


def payfast_ips() -> set[str]:
    ips: set[str] = set()
    for host in PAYFAST_HOSTS:
        try:
            ips.update(socket.gethostbyname_ex(host)[2])
        except OSError:
            continue
    return ips


def from_payfast(remote_ip: Optional[str]) -> bool:
    return bool(remote_ip) and remote_ip in payfast_ips()


def amount_ok(posted: list[tuple[str, str]], expected_cents: int) -> bool:
    raw = dict(posted).get("amount_gross", "")
    try:
        return abs(round(float(raw) * 100) - expected_cents) < 1
    except ValueError:
        return False


def confirmed_by_payfast(posted: list[tuple[str, str]]) -> bool:
    """Server-to-server: PayFast must say VALID to exactly what we received."""
    try:
        response = requests.post(
            f"{base_url()}/eng/query/validate",
            data=itn_param_string(posted),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=VALIDATE_TIMEOUT_SECONDS,
        )
    except requests.RequestException:
        return False
    return response.status_code == 200 and response.text.strip() == "VALID"
