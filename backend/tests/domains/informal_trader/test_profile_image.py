"""
The trader's profile photo: a signed upload straight to (fake) Cloudinary,
kept only after shared.media checks it against its own record and against
what Cloudinary itself holds.
"""
from __future__ import annotations

import json
import re

from src.shared.media.provider import get_provider

PASSWORD = "Spaza2026!"
CONSENT = {"privacy_version": "0.2-draft", "terms_version": "0.2-draft"}
SIGN = "/api/v1/me/business-profile/image/upload-signature"
IMAGE = "/api/v1/me/business-profile/image"
WEBHOOK = "/api/v1/media/webhooks/cloudinary-notifications"


def signed_in(client, outbox, email="photo@example.com") -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "consent": CONSENT})
    code = re.search(r">(\d{6})<", outbox[-1]["html_body"]).group(1)
    token = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code}).get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def start(client, me) -> str:
    r = client.post(SIGN, headers=me)
    assert r.status_code == 200
    return r.get_json()["data"]["fields"]["public_id"]


def upload_and_keep(client, me, size=200_000):
    public_id = start(client, me)
    get_provider().put(public_id, size)  # the phone's post to Cloudinary
    return public_id, client.post(IMAGE, headers=me, json={"public_id": public_id})


def test_form_is_for_one_file_in_my_own_folder(app, client, outbox):
    me = signed_in(client, outbox)
    data = client.post(SIGN, headers=me).get_json()["data"]
    public_id = data["fields"]["public_id"]
    assert public_id.startswith("akayza-test/informal-trader/") and "/profile/" in public_id
    assert data["fields"]["asset_folder"] == public_id.rsplit("/", 1)[0]
    assert "secret" not in json.dumps(data).lower()
    with app.app_context():
        from src.domains.identity.accounts.services import account_service

        assert str(account_service.find_by_email("photo@example.com").id) not in public_id  # a key, not our id


def test_upload_then_keep_shows_the_photo(client, outbox):
    me = signed_in(client, outbox)
    public_id, r = upload_and_keep(client, me)
    assert r.status_code == 200 and r.get_json()["data"]["profile"]["profile_image_url"].endswith(f"{public_id}.jpg")


def test_the_phone_cannot_supply_the_url(client, outbox):
    me = signed_in(client, outbox)
    public_id = start(client, me)
    get_provider().put(public_id)
    assert client.post(IMAGE, headers=me, json={"public_id": public_id, "secure_url": "https://evil.example/x.png"}).status_code == 422


def test_nothing_uploaded_nothing_kept(client, outbox):
    me = signed_in(client, outbox)
    assert client.post(IMAGE, headers=me, json={"public_id": start(client, me)}).status_code == 404


def test_cannot_keep_someone_elses_upload(client, outbox):
    mine = signed_in(client, outbox)
    theirs = signed_in(client, outbox, email="other@example.com")
    their_id = start(client, theirs)
    get_provider().put(their_id)
    assert client.post(IMAGE, headers=mine, json={"public_id": their_id}).status_code == 404
    # ...and a file nobody started through us is refused too
    get_provider().put("akayza-test/informal-trader/x/profile/planted")
    assert client.post(IMAGE, headers=mine, json={"public_id": "akayza-test/informal-trader/x/profile/planted"}).status_code == 404


def test_an_upload_is_kept_only_once(client, outbox):
    me = signed_in(client, outbox)
    public_id, _ = upload_and_keep(client, me)
    assert client.post(IMAGE, headers=me, json={"public_id": public_id}).status_code == 404


def test_too_large_is_refused_and_deleted(client, outbox):
    me = signed_in(client, outbox)
    public_id, r = upload_and_keep(client, me, size=6 * 1024 * 1024)
    assert r.status_code == 422 and r.get_json()["code"] == "FILE_TOO_LARGE"
    assert public_id in get_provider().deleted


def test_a_new_photo_replaces_and_deletes_the_old(client, outbox):
    me = signed_in(client, outbox)
    first, _ = upload_and_keep(client, me)
    second, r = upload_and_keep(client, me)
    assert r.get_json()["data"]["profile"]["profile_image_url"].endswith(f"{second}.jpg")
    assert first in get_provider().deleted


def test_remove_photo(client, outbox):
    me = signed_in(client, outbox)
    public_id, _ = upload_and_keep(client, me)
    r = client.delete(IMAGE, headers=me)
    assert r.status_code == 200 and r.get_json()["data"]["profile"]["profile_image_url"] is None
    assert public_id in get_provider().deleted


def test_with_malware_scan_on_the_photo_waits_for_approval(client, outbox):
    me = signed_in(client, outbox)
    get_provider().scan = True
    public_id, r = upload_and_keep(client, me)
    assert r.get_json()["data"]["profile"]["profile_image_url"] is None  # hidden until scanned

    body = json.dumps({"public_id": public_id, "moderation_status": "approved"})
    assert client.post(WEBHOOK, data=body, headers={"X-Cld-Timestamp": "1", "X-Cld-Signature": "forged"}).status_code == 401
    assert client.post(WEBHOOK, data=body, headers={"X-Cld-Timestamp": "1", "X-Cld-Signature": "valid"}).status_code == 200
    profile = client.get("/api/v1/me/business-profile", headers=me).get_json()["data"]["profile"]
    assert profile["profile_image_url"].endswith(f"{public_id}.jpg")


def test_a_rejected_photo_is_deleted_and_never_shown(client, outbox):
    me = signed_in(client, outbox)
    get_provider().scan = True
    public_id, _ = upload_and_keep(client, me)
    body = json.dumps({"public_id": public_id, "moderation_status": "rejected"})
    client.post(WEBHOOK, data=body, headers={"X-Cld-Timestamp": "1", "X-Cld-Signature": "valid"})
    profile = client.get("/api/v1/me/business-profile", headers=me).get_json()["data"]["profile"]
    assert profile["profile_image_url"] is None and public_id in get_provider().deleted


def test_needs_a_token(client):
    assert client.post(SIGN).status_code == 401
    assert client.post(IMAGE, json={"public_id": "x" * 20}).status_code == 401
