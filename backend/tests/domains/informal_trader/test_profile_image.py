"""
The trader's profile photo: signed direct upload to (fake) Cloudinary,
registration checked against what Cloudinary itself holds.
"""
from __future__ import annotations

import json
import re

from src.shared.media import folder_naming
from src.shared.media.providers.composition import get_media_provider
from src.shared.media.providers.provider import UploadedAsset

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}
SIGN = "/api/v1/me/business-profile/image/upload-signature"
IMAGE = "/api/v1/me/business-profile/image"


def signed_in(client, outbox, email="photo@example.com") -> dict:
    client.post("/api/v1/auth/register", json={"business_name": "Photo Spaza", "email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def phone_uploads(public_id: str, size: int = 200_000, url: str | None = None) -> None:
    """Stands in for the phone posting the file straight to Cloudinary."""
    get_media_provider().uploaded[public_id] = UploadedAsset(
        public_id, url or f"https://res.cloudinary.com/fake-cloud/image/upload/v1/{public_id}.jpg", "image", "jpg", 800, 800, size
    )


def signature(client, me) -> dict:
    r = client.post(SIGN, headers=me)
    assert r.status_code == 200
    return r.get_json()["data"]


def test_signature_is_for_one_file_in_my_own_folder(app, client, outbox):
    me = signed_in(client, outbox)
    s = signature(client, me)
    public_id = s["fields"]["public_id"]
    assert public_id.startswith("akayza-test/informal-trader/") and "/profile/profile-" in public_id
    assert s["fields"]["asset_folder"] == public_id.rsplit("/", 1)[0]
    assert "api_secret" not in json.dumps(s)  # the secret never leaves the server
    # The folder key is not our database id.
    with app.app_context():
        from src.domains.identity.accounts.services import account_service

        user_id = str(account_service.find_by_email("photo@example.com").id)
    assert user_id not in public_id


def test_upload_then_register_shows_the_photo(client, outbox):
    me = signed_in(client, outbox)
    public_id = signature(client, me)["fields"]["public_id"]
    phone_uploads(public_id)
    r = client.post(IMAGE, headers=me, json={"public_id": public_id})
    assert r.status_code == 200
    assert r.get_json()["data"]["profile"]["profile_image_url"].endswith(f"{public_id}.jpg")


def test_the_url_comes_from_cloudinary_not_the_phone(client, outbox):
    me = signed_in(client, outbox)
    public_id = signature(client, me)["fields"]["public_id"]
    phone_uploads(public_id)
    r = client.post(IMAGE, headers=me, json={"public_id": public_id, "secure_url": "https://evil.example/x.png"})
    assert r.status_code == 422  # extra fields refused outright
    r = client.post(IMAGE, headers=me, json={"public_id": public_id})
    assert "evil" not in r.get_json()["data"]["profile"]["profile_image_url"]


def test_nothing_uploaded_nothing_registered(client, outbox):
    me = signed_in(client, outbox)
    public_id = signature(client, me)["fields"]["public_id"]
    r = client.post(IMAGE, headers=me, json={"public_id": public_id})  # the phone never uploaded
    assert r.status_code == 404


def test_cannot_register_someone_elses_upload(client, outbox):
    mine = signed_in(client, outbox)
    theirs = signed_in(client, outbox, email="other@example.com")
    their_id = signature(client, theirs)["fields"]["public_id"]
    phone_uploads(their_id)
    r = client.post(IMAGE, headers=mine, json={"public_id": their_id})
    assert r.status_code == 404


def test_too_large_is_refused_and_deleted(client, outbox):
    me = signed_in(client, outbox)
    public_id = signature(client, me)["fields"]["public_id"]
    phone_uploads(public_id, size=6 * 1024 * 1024)
    r = client.post(IMAGE, headers=me, json={"public_id": public_id})
    assert r.status_code == 422 and r.get_json()["code"] == "IMAGE_TOO_LARGE"
    assert public_id in get_media_provider().deleted


def test_a_new_photo_replaces_and_deletes_the_old(client, outbox):
    me = signed_in(client, outbox)
    first = signature(client, me)["fields"]["public_id"]
    phone_uploads(first)
    client.post(IMAGE, headers=me, json={"public_id": first})
    second = signature(client, me)["fields"]["public_id"]
    phone_uploads(second)
    r = client.post(IMAGE, headers=me, json={"public_id": second})
    assert r.get_json()["data"]["profile"]["profile_image_url"].endswith(f"{second}.jpg")
    assert first in get_media_provider().deleted


def test_remove_photo(client, outbox):
    me = signed_in(client, outbox)
    public_id = signature(client, me)["fields"]["public_id"]
    phone_uploads(public_id)
    client.post(IMAGE, headers=me, json={"public_id": public_id})
    r = client.delete(IMAGE, headers=me)
    assert r.status_code == 200 and r.get_json()["data"]["profile"]["profile_image_url"] is None
    assert public_id in get_media_provider().deleted


def test_with_malware_scan_on_the_photo_waits_for_approval(client, outbox):
    me = signed_in(client, outbox)
    get_media_provider().moderation = True
    public_id = signature(client, me)["fields"]["public_id"]
    phone_uploads(public_id)
    r = client.post(IMAGE, headers=me, json={"public_id": public_id})
    assert r.get_json()["data"]["profile"]["profile_image_url"] is None  # hidden until scanned

    body = json.dumps({"public_id": public_id, "moderation_status": "approved", "notification_type": "moderation"})
    bad = client.post("/api/v1/media/webhooks/cloudinary-notifications", data=body, headers={"X-Cld-Timestamp": "1", "X-Cld-Signature": "forged"})
    assert bad.status_code == 401  # only Cloudinary can approve
    ok = client.post("/api/v1/media/webhooks/cloudinary-notifications", data=body, headers={"X-Cld-Timestamp": "1", "X-Cld-Signature": "valid"})
    assert ok.status_code == 200
    profile = client.get("/api/v1/me/business-profile", headers=me).get_json()["data"]["profile"]
    assert profile["profile_image_url"].endswith(f"{public_id}.jpg")


def test_needs_a_token(client):
    assert client.post(SIGN).status_code == 401
    assert client.post(IMAGE, json={"public_id": "x" * 20}).status_code == 401


def test_folder_layout():
    trader = folder_naming.informal_trader_folder("u1")
    assert folder_naming.informal_trader_profile_folder("u1") == f"{trader}/profile"
    assert folder_naming.informal_trader_job_folder("u1", "j1").startswith(f"{trader}/jobs/")
    supplier = folder_naming.supplier_folder("s1")
    assert supplier.startswith("akayza-test/supplier/")
    assert folder_naming.supplier_product_folder("s1", "p1").startswith(f"{supplier}/products/")
    assert folder_naming.supplier_category_folder("s1") == f"{supplier}/categories"
    assert folder_naming.informal_trader_folder("u1") == trader  # stable
    assert folder_naming.informal_trader_folder("u2") != trader  # unique
