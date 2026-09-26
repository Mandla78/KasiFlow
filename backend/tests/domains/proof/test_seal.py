"""
Record seals (proof/integrity): the owner seals every record in their
tools; the server signs the Merkle root with Ed25519 and ML-DSA-65 (NIST
FIPS 204); later "check" shows whether anything sealed changed since --
even when the change was made straight in the database.
"""
from __future__ import annotations

import base64
import copy
import json
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from dilithium_py.ml_dsa import ML_DSA_65
from order_book_helpers import place, save_menu
from test_record import trader

from src.domains.informal_trader.credit_book import demo as credit_demo
from src.domains.informal_trader.credit_book.models import CreditPayment
from src.domains.identity.accounts.models.user import User
from src.domains.proof.integrity.services import fingerprints as fp
from src.domains.proof.integrity.services import seal_keys
from src.domains.proof.integrity.services.seal_service import DOMAIN
from src.extensions import db
from src.shared.rate_limit.limiter import limiter

API = "/api/v1"
SEAL, CHECK, KEYS = f"{API}/me/record/seal", f"{API}/me/record/check", f"{API}/proof/keys"
SA = ZoneInfo("Africa/Johannesburg")
HEADER = ("v", "alg", "business", "sealed_at", "count", "root")


@pytest.fixture
def me(client, outbox):
    return trader(client, outbox, "nomsa@example.com")


def today() -> str:
    return datetime.now(SA).date().isoformat()


def sale(client, who, cents=10_000, name="Thandi Mokoena") -> str:
    due = (datetime.now(SA).date() + timedelta(days=7)).isoformat()
    body = {"customer": {"name": name}, "amount_cents": cents, "description": "Bread and airtime", "given_on": today(), "due_on": due}
    r = client.post(f"{API}/me/credit-book/entries", headers=who.headers, json=body)
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]["entry"]["id"]


def repay(client, who, entry, cents=3_000):
    r = client.post(f"{API}/me/credit-book/entries/{entry}/payments", headers=who.headers, json={"amount_cents": cents, "paid_on": today()})
    assert r.status_code == 201, r.get_json()


def confirmed_job(client, who):
    job = {"title": "Mokoena room", "client_name": "Mokoena family", "client_phone": "082 123 4567", "total_cents": 1_800_000,
           "stages": [{"name": "Walls", "amount_cents": 1_800_000}]}  # fmt: skip
    j = client.post(f"{API}/me/jobs", headers=who.headers, json=job).get_json()["data"]["job"]
    stage = j["stages"][0]["id"]
    link = client.post(f"{API}/me/jobs/{j['id']}/stages/{stage}/sign-off", headers=who.headers, json={"builder_amount_cents": 1_800_000}).get_json()["data"]["link"]
    client.post("/sign-off", data={"ticket": link.split("ticket=")[1], "answer": "done", "amount": "18000"})


def seal(client, who) -> dict:
    r = client.post(SEAL, headers=who.headers)
    assert r.status_code == 201, r.get_json()
    return r.get_json()["data"]["seal"]


def check(client, who, s, status=200) -> dict:
    r = client.post(CHECK, headers=who.headers, json={"seal": s})
    assert r.status_code == status, r.get_json()
    return r.get_json()["data"].get("check") if status == 200 else r.get_json()


@pytest.fixture
def full(client, me):
    """A business with something in every tool."""
    entry = sale(client, me)
    repay(client, me, entry)
    confirmed_job(client, me)
    menu = save_menu(client, me.headers, [{"name": "Kota", "price_cents": 3_500, "ingredients": ["quarter_loaf", "chips"]}])
    place(client, me.headers, menu, ("Kota", 2))
    return entry


# ------------------------------------------------------------------ access


def test_sealing_and_checking_need_a_signed_in_trader(client):
    assert client.post(SEAL).status_code == 401
    assert client.post(CHECK, json={"seal": {}}).status_code == 401
    assert client.get(KEYS).status_code == 200  # the public keys are public


# ------------------------------------------------------------------ the seal


def test_a_seal_covers_every_tool_and_carries_no_personal_data(client, me, full):
    s = seal(client, me)
    kinds = {k for k, _, _ in s["leaves"]}
    assert {"credit_given", "credit_repayment", "stage_confirmed", "sign_off_answer", "counter_order", "menu_price"} <= kinds
    assert s["count"] == len(s["leaves"]) and s["alg"] == ["Ed25519", "ML-DSA-65"]
    # The root is the RFC 6962 Merkle root of the leaves, recomputable by anyone.
    assert fp.root([bytes.fromhex(h) for _, _, h in s["leaves"]]).hex() == s["root"]
    text = json.dumps(s)
    for secret in ("Thandi", "Mokoena", "082", "Bread", "Kota", "10000", "18000"):
        assert secret not in text, secret


def test_anyone_can_check_the_signatures_with_the_public_keys(client, me, full):
    s = seal(client, me)
    keys = client.get(KEYS).get_json()["data"]["keys"]
    assert keys["ml_dsa_65"]["standard"] == "NIST FIPS 204"
    message = DOMAIN + fp.canonical({k: s[k] for k in HEADER})
    Ed25519PublicKey.from_public_bytes(base64.b64decode(keys["ed25519"]["public_key"])).verify(base64.b64decode(s["sig"]["ed25519"]), message)
    assert ML_DSA_65.verify(base64.b64decode(keys["ml_dsa_65"]["public_key"]), message, base64.b64decode(s["sig"]["ml_dsa_65"]))
    assert s["key_ids"] == {"ed25519": keys["ed25519"]["id"], "ml_dsa_65": keys["ml_dsa_65"]["id"]}


def test_an_empty_book_can_be_sealed(client, me):
    s = seal(client, me)
    assert s["count"] == 0 and s["root"] == fp.root([]).hex()
    assert check(client, me, s)["intact"] is True


# ------------------------------------------------------------------ checking


def test_nothing_changed_and_new_records_are_fine(client, me, full):
    s = seal(client, me)
    c = check(client, me, s)
    assert c["intact"] and c["sealed"] == c["unchanged"] == s["count"] and c["added_since"] == 0
    assert c["signatures"] == {"ed25519": "valid", "ml_dsa_65": "valid"}
    sale(client, me, 2_500, "Sipho")
    c = check(client, me, s)
    assert c["intact"] and c["added_since"] == 1


def test_normal_changes_are_not_tampering(client, me, full):
    s = seal(client, me)
    repay(client, me, full, 7_000)  # paid off: the status changes
    body = {"amount_cents": 9_000, "due_on": (datetime.now(SA).date() + timedelta(days=3)).isoformat(), "description": "Bread", "reason": "Typed it wrong"}
    other = sale(client, me, 5_000, "Lerato")
    other_seal = seal(client, me)
    assert client.post(f"{API}/me/credit-book/entries/{other}/corrections", headers=me.headers, json=body).status_code in (200, 201)
    assert client.delete(f"{API}/me/credit-book/entries/{other}", headers=me.headers).status_code == 200  # the bin
    assert check(client, me, s)["intact"] is True
    c = check(client, me, other_seal)
    assert c["intact"] is True and c["added_since"] >= 1  # the correction is a new record


def test_a_change_straight_in_the_database_is_caught(app, client, me, full):
    s = seal(client, me)
    with app.app_context():
        user = db.session.get(User, uuid.UUID(me.id))
        assert "repayment" in credit_demo.tamper(user)
    c = check(client, me, s)
    assert c["intact"] is False and c["missing"] == []
    assert [x["kind"] for x in c["changed"]] == ["Repayment"] and c["changed"][0]["on"] == today()
    assert c["unchanged"] == s["count"] - 1


def test_a_record_deleted_from_the_database_is_caught(app, client, me, full):
    s = seal(client, me)
    with app.app_context():
        CreditPayment.query.filter_by(user_id=uuid.UUID(me.id)).delete()
        db.session.commit()
    c = check(client, me, s)
    assert c["intact"] is False and [x["kind"] for x in c["missing"]] == ["Repayment"]


# ------------------------------------------------------------------ forged or foreign seals


def _altered(s: dict, how: str) -> dict:
    t = copy.deepcopy(s)
    if how == "leaf":
        t["leaves"][0][2] = "0" * 64
    elif how == "root":
        t["root"] = "0" * 64
    elif how == "time":
        t["sealed_at"] = "2026-01-01T00:00:00+00:00"
    elif how == "count":
        t["count"] += 1
    elif how == "no_pq_signature":
        t["sig"]["ml_dsa_65"] = None
    elif how == "swapped_signatures":
        t["sig"]["ed25519"] = base64.b64encode(b"\x00" * 64).decode()
    elif how == "order":
        t["leaves"].reverse()
    elif how == "duplicate":
        t["leaves"].append(list(t["leaves"][0]))
        t["count"] += 1
    return t


@pytest.mark.parametrize("how", ["leaf", "root", "time", "count", "no_pq_signature", "swapped_signatures", "order", "duplicate"])
def test_an_altered_seal_is_refused(client, me, full, how):
    body = check(client, me, _altered(seal(client, me), how), status=422)
    assert body["message"] == "This seal has been altered, or it wasn't made by us."


def test_another_accounts_seal_is_refused(client, outbox, me, full):
    s = seal(client, me)
    other = trader(client, outbox, "sipho@example.com")
    body = check(client, other, s, status=422)
    assert body["message"] == "This seal is for another account."
    s["business"] = other.id  # pretending it's theirs breaks the signature
    assert check(client, other, s, status=422)["message"] == "This seal has been altered, or it wasn't made by us."


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"seal": "x"},
        {"seal": {}},
        {"seal": None},
        {"seal": [], "extra": 1},
    ],
)
def test_broken_bodies_are_refused(client, me, body):
    assert client.post(CHECK, headers=me.headers, json=body).status_code == 422


@pytest.mark.parametrize(
    "change",
    [
        lambda s: s.update(v=2),
        lambda s: s.update(v="1"),
        lambda s: s.update(count=-1),
        lambda s: s.update(root="xyz"),
        lambda s: s.update(alg=["RSA"]),
        lambda s: s.update(extra="field"),
        lambda s: s["sig"].update(extra="field"),
        lambda s: s["sig"].update(ed25519=""),
        lambda s: s["key_ids"].update(ed25519="nothex!!nothex!!"),
        lambda s: s["leaves"].append(["credit_given", "x"]),
        lambda s: s["leaves"].append(["passwords", "x", "0" * 64]),
        lambda s: s["leaves"].append(["credit_given", "x" * 65, "0" * 64]),
        lambda s: s["leaves"].append(["credit_given", "x", "Z" * 64]),
        lambda s: s.update(sealed_at="x" * 41),
    ],
)
def test_hostile_seals_are_refused_cleanly(client, me, full, change):
    s = seal(client, me)
    change(s)
    assert client.post(CHECK, headers=me.headers, json={"seal": s}).status_code == 422


# ------------------------------------------------------------------ keys


def test_without_ml_dsa_seals_are_ed25519_only(client, me, full, monkeypatch):
    monkeypatch.setattr(seal_keys, "ML_DSA_65", None)
    s = seal(client, me)
    assert s["alg"] == ["Ed25519"] and s["sig"]["ml_dsa_65"] is None
    c = check(client, me, s)
    assert c["intact"] and c["signatures"] == {"ed25519": "valid", "ml_dsa_65": "absent"}
    assert "ml_dsa_65" not in client.get(KEYS).get_json()["data"]["keys"]


def test_a_seal_made_with_a_retired_key_says_so(app, client, me, full):
    s = seal(client, me)
    app.config["SEAL_SECRET"] = "a-different-seal-secret-for-this-test-only"
    try:
        assert check(client, me, s, status=409)["code"] == "SEAL_OLD_KEY"
    finally:
        app.config.pop("SEAL_SECRET", None)


# ------------------------------------------------------------------ fingerprints


def test_the_merkle_root_follows_rfc_6962():
    import hashlib

    a, b, c = (fp.leaf("counter_order", str(i), {"n": i}) for i in range(3))
    node = lambda x, y: hashlib.sha256(b"\x01" + x + y).digest()  # noqa: E731
    assert fp.root([a]) == a
    assert fp.root([a, b]) == node(a, b)
    assert fp.root([a, b, c]) == node(node(a, b), c)
    assert fp.leaf("x", "1", {"b": 1, "a": 2}) == fp.leaf("x", "1", {"a": 2, "b": 1})  # key order doesn't matter


# ------------------------------------------------------------------ limits and the demo tool


@pytest.fixture
def limits_on(app):
    was = limiter.enabled
    limiter.enabled = True
    with app.app_context():
        limiter.reset()
    yield
    with app.app_context():
        limiter.reset()
    limiter.enabled = was


def test_sealing_is_limited_per_user(client, me, limits_on):
    codes = [client.post(SEAL, headers=me.headers).status_code for _ in range(21)]
    assert codes[:20] == [201] * 20 and codes[20] == 429


def test_the_tamper_tool_changes_one_number_and_is_development_only(app, client, me, full):
    runner = app.test_cli_runner()
    s = seal(client, me)
    result = runner.invoke(args=["tools", "tamper", "--me", "nomsa@example.com"])
    assert result.exit_code == 0 and "changed: repayment" in result.output
    assert check(client, me, s)["intact"] is False
    was = app.config.get("ENV_NAME")
    app.config["ENV_NAME"] = "production"
    try:
        result = runner.invoke(args=["tools", "tamper", "--me", "nomsa@example.com"])
        assert result.exit_code != 0 and "Development only" in result.output
    finally:
        app.config["ENV_NAME"] = was
