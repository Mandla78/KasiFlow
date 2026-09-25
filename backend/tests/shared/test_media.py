"""
shared.media on its own: folders, the abandoned-upload sweep, the daily
limit, and our check of Cloudinary's callback signatures.
"""
from __future__ import annotations

import hashlib
import time
import uuid
from datetime import timedelta

import pytest

from src.core.base_model import utcnow
from src.extensions import db
from src.shared.media import folders, sweep, uploads
from src.shared.media.cloudinary_provider import CloudinaryProvider
from src.shared.media.models import MediaUpload
from src.shared.media.provider import get_provider


def test_folder_layout():
    trader = folders.informal_trader_folder("u1")
    assert trader.startswith("akayza-test/informal-trader/")
    assert folders.informal_trader_profile_folder("u1") == f"{trader}/profile"
    assert folders.informal_trader_job_folder("u1", "j1").startswith(f"{trader}/jobs/")
    supplier = folders.supplier_folder("s1")
    assert supplier.startswith("akayza-test/supplier/")
    assert folders.supplier_product_folder("s1", "p1").startswith(f"{supplier}/products/")
    assert folders.supplier_category_folder("s1") == f"{supplier}/categories"
    assert folders.informal_trader_folder("u1") == trader and folders.informal_trader_folder("u2") != trader
    assert "u1" not in trader  # a key, never the id itself


def test_sweep_deletes_only_abandoned_uploads(app):
    with app.app_context():
        user = uuid.uuid4()
        uploads.start(user, "test", "akayza-test/t", 800)
        old = MediaUpload.query.filter_by(user_id=user).first()
        old.expires_at = utcnow() - timedelta(minutes=1)
        uploads.start(user, "test", "akayza-test/t", 800)  # still within its hour
        db.session.commit()

        result = sweep.run()
        assert result.success and result.count == 1
        assert get_provider().deleted == [old.public_id]
        states = sorted(u.state for u in MediaUpload.query.filter_by(user_id=user))
        assert states == ["abandoned", "started"]


def test_daily_limit_across_features(app):
    with app.app_context():
        user = uuid.uuid4()
        big = 60 * 1024 * 1024
        first = uploads.start(user, "a", "akayza-test/t", 800).fields["public_id"]
        get_provider().put(first, big)
        uploads.finish(user, "a", first, 100 * 1024 * 1024)
        db.session.commit()
        second = uploads.start(user, "b", "akayza-test/t", 800).fields["public_id"]
        get_provider().put(second, big)
        with pytest.raises(uploads.DailyLimitError):
            uploads.finish(user, "b", second, 100 * 1024 * 1024)
        assert second in get_provider().deleted


def test_cloudinary_callback_signature():
    p = CloudinaryProvider("cloud", "key", "s3cret")
    body, ts = '{"public_id":"x"}', str(int(time.time()))
    sha1 = hashlib.sha1(f"{body}{ts}s3cret".encode()).hexdigest()
    sha256 = hashlib.sha256(f"{body}{ts}s3cret".encode()).hexdigest()
    assert p.callback_is_genuine(body, ts, sha1)
    assert p.callback_is_genuine(body, ts, sha256)
    assert not p.callback_is_genuine(body + " ", ts, sha1)  # body changed
    assert not p.callback_is_genuine(body, ts, "0" * 40)
    stale = str(int(time.time()) - 3 * 3600)
    assert not p.callback_is_genuine(body, stale, hashlib.sha1(f"{body}{stale}s3cret".encode()).hexdigest())  # replayed


def test_cloudinary_upload_form_is_signed_for_one_file():
    form = CloudinaryProvider("cloud", "key", "s3cret").upload_form("akayza-test/f/abc", "akayza-test/f", 800)
    assert form.url == "https://api.cloudinary.com/v1_1/cloud/image/upload"
    f = form.fields
    assert f["public_id"] == "akayza-test/f/abc" and f["asset_folder"] == "akayza-test/f" and f["signature"]
    assert "s3cret" not in str(f)
