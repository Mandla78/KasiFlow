"""
Check the media setup against the REAL Cloudinary account. A manual tool,
not part of the app (nothing in src/ imports it). Adapted from
TruConnect's verify_cloudinary_connection.py (see REUSE.md).

    cd backend
    .venv\\Scripts\\activate
    python scripts/verify_media.py

Steps (each prints PASS or FAIL; secrets are never printed):
  1. settings     the Cloudinary keys are in .env
  2. connection   Cloudinary answers with these keys
  3. upload       a tiny test image, uploaded EXACTLY as the phone does:
                  the app's own signing code, a multipart post straight
                  to Cloudinary, into {MEDIA_ROOT_FOLDER}/informal-trader/
  4. check        fetch_asset (what registration uses) sees the real file
  5. webhook      if CLOUDINARY_WEBHOOK_BASE_URL is set and the backend
                  is running: the tunnel reaches it, a forged
                  notification is refused (401) and a correctly signed
                  one is accepted (200)
  6. clean-up     the test image is deleted again
"""
from __future__ import annotations

import json
import os
import struct
import sys
import time
import uuid
import zlib
from pathlib import Path

import requests
from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND / ".env")
sys.path.insert(0, str(BACKEND))
os.environ["MEDIA_PROVIDER"] = "cloudinary"  # this script is about the real thing

from src.shared.media import folder_naming  # noqa: E402
from src.shared.media.config.media_config import MediaConfig  # noqa: E402
from src.shared.media.providers.composition import get_media_provider  # noqa: E402

failures = 0


def report(ok: bool, step: str, detail: str = "") -> bool:
    global failures
    failures += 0 if ok else 1
    print(f"{'PASS' if ok else 'FAIL'}  {step}{('  -  ' + detail) if detail else ''}")
    return ok


def tiny_png(size: int = 32) -> bytes:
    """A small solid-blue PNG, built by hand (no image library needed)."""
    raw = b"".join(b"\x00" + b"\x25\x63\xeb" * size for _ in range(size))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def main() -> int:
    config = MediaConfig.from_env()

    # 1. settings
    missing = [k for k in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET") if not os.environ.get(k)]
    if not report(not missing, "settings", f"missing: {', '.join(missing)}" if missing else f"root folder '{folder_naming.root()}'"):
        return 1

    provider = get_media_provider()

    # 2. connection
    import cloudinary.api

    try:
        cloudinary.api.ping()
        report(True, "connection", f"cloud '{config.cloud_name}'")
    except Exception as e:  # noqa: BLE001
        report(False, "connection", type(e).__name__ + ": " + str(e)[:120])
        return 1

    # 3. upload, exactly like the phone
    folder = folder_naming.informal_trader_profile_folder("verify-media-script")
    public_id = f"{folder}/verify-{uuid.uuid4()}"
    signed = provider.generate_signed_upload(public_id, 800, folder)
    fields = {
        "api_key": signed.api_key,
        "timestamp": str(signed.timestamp),
        "signature": signed.signature,
        "public_id": signed.public_id,
        "allowed_formats": signed.allowed_formats,
        "transformation": signed.transformation,
        "asset_folder": signed.asset_folder,
        "notification_url": signed.notification_url,
        "moderation": signed.moderation,
    }
    fields = {k: v for k, v in fields.items() if v}
    r = requests.post(signed.upload_url, data=fields, files={"file": ("verify.png", tiny_png(), "image/png")}, timeout=30)
    if not report(r.ok, "upload", f"{public_id}" if r.ok else f"HTTP {r.status_code}: {r.text[:200]}"):
        return 1

    # 4. check: what registration does
    asset = provider.fetch_asset(public_id)
    report(
        asset is not None and asset.secure_url.startswith("https://res.cloudinary.com/"),
        "check",
        f"{asset.bytes} bytes, {asset.width}x{asset.height} {asset.format}" if asset else "Cloudinary doesn't know the file",
    )

    # 5. webhook through the tunnel
    base = config.webhook_base_url
    if not base:
        print("SKIP  webhook  -  CLOUDINARY_WEBHOOK_BASE_URL is empty")
    else:
        try:
            health = requests.get(f"{base}/api/v1/health", timeout=15, headers={"ngrok-skip-browser-warning": "1"})
            reachable, why = health.ok and "healthy" in health.text, f"HTTP {health.status_code}"
        except requests.RequestException as e:
            reachable, why = False, type(e).__name__
        detail = "reaches the backend" if reachable else f"can't reach {base}/api/v1/health ({why}): is the backend running, and the tunnel (ngrok http 5000 --url={base})?"
        if report(reachable, "webhook tunnel", detail):
            url = config.notification_url
            body = json.dumps({"notification_type": "upload", "public_id": public_id})
            ts = str(int(time.time()))
            forged = requests.post(url, data=body, timeout=15, headers={"X-Cld-Timestamp": ts, "X-Cld-Signature": "forged", "ngrok-skip-browser-warning": "1"})
            report(forged.status_code == 401, "webhook refuses a forged call", f"HTTP {forged.status_code}")
            import cloudinary.utils

            # Cloudinary's own notification signature: SHA1(body + timestamp + api_secret).
            sig = cloudinary.utils.compute_hex_hash(body + ts + config.api_secret, "sha1")
            genuine = requests.post(url, data=body, timeout=15, headers={"X-Cld-Timestamp": ts, "X-Cld-Signature": sig, "ngrok-skip-browser-warning": "1"})
            report(genuine.status_code == 200, "webhook accepts a signed call", f"HTTP {genuine.status_code}")

    # 6. clean-up
    provider.delete_asset(public_id)
    time.sleep(1)
    report(provider.fetch_asset(public_id) is None, "clean-up", "test image deleted")

    print()
    print("All good." if failures == 0 else f"{failures} step(s) failed.")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
