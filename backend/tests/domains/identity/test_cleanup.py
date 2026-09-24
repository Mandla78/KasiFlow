"""The identity clean-up job removes only what's past its time."""
from __future__ import annotations

from datetime import timedelta

from src.core.base_model import utcnow
from src.domains.identity.accounts.models import User
from src.domains.identity.auth.jobs import cleanup
from src.domains.identity.auth.models import EmailCode, PasswordCredential
from src.extensions import db

CONSENT = {"privacy_version": "0.1-draft", "terms_version": "0.1-draft"}


def register(client, email):
    return client.post("/api/v1/auth/register", json={"business_name": "Clean Spaza", "email": email, "password": "Spaza2026!", "consent": CONSENT})


def test_old_unverified_sign_up_is_deleted_but_a_new_one_is_kept(app, client):
    register(client, "old@example.com")
    register(client, "new@example.com")
    with app.app_context():
        old = User.query.filter_by(email="old@example.com").one()
        old.created_at = utcnow() - timedelta(days=8)
        db.session.commit()

        result = cleanup.run()
        assert result.success
        assert User.query.filter_by(email="old@example.com").first() is None
        assert db.session.get(PasswordCredential, old.id) is None  # cascaded
        assert User.query.filter_by(email="new@example.com").first() is not None


def test_expired_codes_are_removed_after_a_day(app, client):
    register(client, "codes@example.com")
    with app.app_context():
        code = EmailCode.query.one()
        code.expires_at = utcnow() - timedelta(days=2)
        db.session.commit()
        cleanup.run()
        assert EmailCode.query.count() == 0


def test_the_job_is_registered_with_the_scheduler():
    from src.master_scheduler.registry import ALL_JOB_SPECS

    assert "identity_cleanup" in {s.name for s in ALL_JOB_SPECS}
