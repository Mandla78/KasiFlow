"""
The builder network end to end: your builder profile and builds, the
Builders tab, partners on jobs with the pay stated first, payments both
sides confirm, and help posts.
"""
from __future__ import annotations

import json
import uuid

import pytest

from network_helpers import API, CAPE_TOWN, IVORY_PARK, OFFER, builder, confirm_stage, data, deal, error, finish, job, stage_id


@pytest.fixture
def nomsa(client, outbox):
    return builder(client, outbox, "nomsa@example.com", "Nomsa Dlamini", phone="0821111111")


@pytest.fixture
def thabo(client, outbox):
    return builder(client, outbox, "thabo@example.com", "Thabo Nkosi", trade="plumber", pin=IVORY_PARK, suburb="Ivory Park", phone="0761234501")


# ------------------------------------------------------------------ access


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/me/builder-profile"),
        ("put", "/me/builder-profile"),
        ("get", "/builders"),
        ("get", "/builders/{x}"),
        ("put", "/builders/{x}/save"),
        ("delete", "/builders/{x}/save"),
        ("post", "/builders/{x}/block"),
        ("post", "/builders/{x}/report"),
        ("get", "/me/jobs/{x}/partners"),
        ("get", "/me/jobs/{x}/candidates"),
        ("post", "/me/jobs/{x}/partners"),
        ("post", "/me/job-partners/{x}/payments"),
        ("get", "/me/partner-invites"),
        ("get", "/me/partner-invites/{x}"),
        ("post", "/me/partner-invites/{x}/answer"),
        ("post", "/me/partner-invites/{x}/payments/{x}/confirm"),
        ("post", "/me/jobs/{x}/help-posts"),
        ("get", "/help-posts/{x}"),
        ("post", "/help-posts/{x}/interested"),
        ("post", "/me/help-posts/{x}/pick"),
        ("post", "/me/help-posts/{x}/close"),
    ],
)
def test_every_route_needs_a_token(client, method, path):
    assert getattr(client, method)(API + path.format(x=uuid.uuid4()), json={}).status_code == 401


# ------------------------------------------------------------------ your profile


def test_profile_starts_hidden_from_the_sign_up_trade(client, outbox):
    b = builder(client, outbox, "kagiso@example.com", "Kagiso Molefe", trade="painter_tiler", visible=False)
    p = data(client.get(f"{API}/me/builder-profile", headers=b.headers), "profile")
    assert p == {"trades": ["painter", "tiler"], "about": "", "travel_km": 20, "visible": False, "builds": []}


def test_save_profile_and_choose_builds(client, app, nomsa):
    j = job(client, nomsa)
    finish(app, j["id"])
    p = data(client.get(f"{API}/me/builder-profile", headers=nomsa.headers), "profile")
    assert [b["title"] for b in p["builds"]] == ["Room extension"] and p["builds"][0]["shown"] is True
    build = p["builds"][0]
    assert build["stages_confirmed"] == build["stages_total"] == 4 and build["suburb"] == "Tembisa"
    assert "/image/upload/c_limit,w_1200,q_auto,f_auto/" in build["photos"][0]["url"]

    body = {"trades": ["general_builder", "bricklayer"], "about": "Rooms and walls", "travel_km": 40, "visible": True, "shown_job_ids": []}
    p = data(client.put(f"{API}/me/builder-profile", headers=nomsa.headers, json=body), "profile")
    assert p["trades"] == ["general_builder", "bricklayer"] and p["travel_km"] == 40 and p["builds"][0]["shown"] is False


@pytest.mark.parametrize(
    "patch,field",
    [
        ({"trades": []}, "trades"),
        ({"trades": ["plumber", "tiler", "painter", "welder"]}, "trades"),
        ({"trades": ["astronaut"]}, "trades"),
        ({"travel_km": 15}, "travel_km"),
        ({"visible": "true"}, "visible"),
        ({"about": "x" * 81}, "about"),
    ],
)
def test_profile_rules(client, nomsa, patch, field):
    body = {"trades": ["general_builder"], "about": "", "travel_km": 20, "visible": True, "shown_job_ids": [], **patch}
    r = error(client.put(f"{API}/me/builder-profile", headers=nomsa.headers, json=body), 422)
    assert field in r["errors"][0]


# ------------------------------------------------------------------ the Builders tab and profiles


def test_builders_tab_shows_visible_builders_with_reasons_and_no_pins_or_phones(client, app, nomsa, thabo, outbox):
    builder(client, outbox, "hidden@example.com", "Hidden Person", trade="electrician", visible=False)
    j = job(client, thabo, title="Bathroom extension", place="Ivory Park")
    finish(app, j["id"])

    home = data(client.get(f"{API}/builders", headers=nomsa.headers))
    assert home["visible"] is True and home["travel_km"] == 20
    names = [b["name"] for b in home["nearby"]]
    assert names == ["Thabo Nkosi"]  # the hidden builder isn't listed
    t = home["nearby"][0]
    assert t["trades"] == ["plumber"] and t["suburb"] == "Ivory Park" and 2.8 < t["distance_km"] < 3.5
    assert t["reason"] == "4 stages confirmed by clients" and t["builds_confirmed"] == 1 and t["confirmed_stages"] == 4
    assert t["relation"] == "none" and t["phone"] is None and t["cover_url"].endswith(".jpg")
    text = json.dumps(home)
    assert "latitude" not in text and "longitude" not in text and "0761234501" not in text and "Mokoena" not in text

    assert data(client.get(f"{API}/builders?trade=electrician", headers=nomsa.headers))["nearby"] == []
    error(client.get(f"{API}/builders?trade=astronaut", headers=nomsa.headers), 422)


def test_a_builders_profile_is_their_builds(client, app, nomsa, thabo):
    shown = job(client, thabo, title="Bathroom extension", place="Ivory Park, Ext 2")
    hidden = job(client, thabo, title="Kitchen redo")
    finish(app, shown["id"])
    finish(app, hidden["id"])
    p = data(client.get(f"{API}/me/builder-profile", headers=thabo.headers), "profile")
    body = {"trades": ["plumber"], "about": "Bathrooms and geysers", "travel_km": 20, "visible": True, "shown_job_ids": [shown["id"]]}
    assert len(p["builds"]) == 2
    data(client.put(f"{API}/me/builder-profile", headers=thabo.headers, json=body))

    b = data(client.get(f"{API}/builders/{thabo.id}", headers=nomsa.headers), "builder")
    assert [x["title"] for x in b["builds"]] == ["Bathroom extension"] and b["builds"][0]["suburb"] == "Ivory Park"
    assert [ph["stage_name"] for ph in b["builds"][0]["photos"]] == ["Deposit", "Walls", "Roof", "Final"]
    assert b["about"] == "Bathrooms and geysers" and b["builds_confirmed"] == 2 and b["phone"] is None
    assert "Plumbers often work with general builders" in b["reasons"]
    text = json.dumps(b)
    assert "Mokoena" not in text and "0821234567" not in text and "amount_cents" not in text


def test_hidden_or_unknown_builders_are_not_found(client, outbox, nomsa):
    hidden = builder(client, outbox, "quiet@example.com", "Quiet Builder", visible=False)
    error(client.get(f"{API}/builders/{hidden.id}", headers=nomsa.headers), 404)
    error(client.get(f"{API}/builders/{uuid.uuid4()}", headers=nomsa.headers), 404)
    error(client.put(f"{API}/builders/{hidden.id}/save", headers=nomsa.headers), 404)


def test_save_is_a_private_bookmark(client, nomsa, thabo):
    data(client.put(f"{API}/builders/{thabo.id}/save", headers=nomsa.headers))
    home = data(client.get(f"{API}/builders", headers=nomsa.headers))
    assert [b["name"] for b in home["saved"]] == ["Thabo Nkosi"] and home["saved"][0]["relation"] == "saved" and home["nearby"] == []
    assert data(client.get(f"{API}/builders", headers=thabo.headers))["saved"] == []  # he isn't told
    data(client.delete(f"{API}/builders/{thabo.id}/save", headers=nomsa.headers))
    assert data(client.get(f"{API}/builders", headers=nomsa.headers))["saved"] == []


def test_a_block_works_both_ways(client, nomsa, thabo):
    data(client.post(f"{API}/builders/{thabo.id}/block", headers=nomsa.headers))
    assert data(client.get(f"{API}/builders", headers=nomsa.headers))["nearby"] == []
    assert data(client.get(f"{API}/builders", headers=thabo.headers))["nearby"] == []
    error(client.get(f"{API}/builders/{thabo.id}", headers=nomsa.headers), 404)
    error(client.get(f"{API}/builders/{nomsa.id}", headers=thabo.headers), 404)


def test_report_needs_a_reason_and_a_note_for_other(client, nomsa, thabo):
    data(client.post(f"{API}/builders/{thabo.id}/report", headers=nomsa.headers, json={"reason": "fake"}))
    r = error(client.post(f"{API}/builders/{thabo.id}/report", headers=nomsa.headers, json={"reason": "other"}), 422)
    assert r["message"] == "Say what happened."
    error(client.post(f"{API}/builders/{thabo.id}/report", headers=nomsa.headers, json={"reason": "mean"}), 422)
    error(client.post(f"{API}/builders/{nomsa.id}/report", headers=nomsa.headers, json={"reason": "fake"}), 404)


# ------------------------------------------------------------------ partners on a job


def invite(client, owner, partner, job_json, **kw):
    return client.post(f"{API}/me/jobs/{job_json['id']}/partners", headers=owner.headers, json={"builder_id": partner.id, **deal(job_json, **kw)})


def test_invite_accept_pay_confirm(client, nomsa, thabo):
    j = job(client, nomsa)
    p = data(invite(client, nomsa, thabo, j), "partner")
    assert p["status"] == "invited" and p["stage_names"] == ["Final"] and p["offer"] == OFFER and p["builder"]["phone"] is None

    # Thabo sees the offer, pay first -- never the client or the stage's money.
    invites = data(client.get(f"{API}/me/partner-invites", headers=thabo.headers), "invites")
    assert len(invites) == 1
    inv = invites[0]
    assert inv["job_title"] == "Room extension" and inv["suburb"] == "Tembisa" and inv["stage_names"] == ["Final"]
    assert inv["offer"] == OFFER and inv["owner"]["name"] == "Nomsa Dlamini" and inv["owner"]["phone"] is None
    text = json.dumps(invites)
    assert "Mokoena" not in text and "0821234567" not in text and "900000" not in text and "3800000" not in text

    error(client.post(f"{API}/me/job-partners/{p['id']}/payments", headers=nomsa.headers, json={"amount_cents": 450_000}), 409)

    inv = data(client.post(f"{API}/me/partner-invites/{inv['id']}/answer", headers=thabo.headers, json={"accept": True}), "invite")
    assert inv["status"] == "accepted" and inv["owner"]["phone"] == "0821111111"
    error(client.post(f"{API}/me/partner-invites/{inv['id']}/answer", headers=thabo.headers, json={"accept": False}), 409)
    on_job = data(client.get(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers), "partners")
    assert on_job[0]["status"] == "accepted" and on_job[0]["builder"]["phone"] == "0761234501" and on_job[0]["builder"]["relation"] == "partner"

    p = data(client.post(f"{API}/me/job-partners/{p['id']}/payments", headers=nomsa.headers, json={"amount_cents": 450_000}), "partner")
    pay = p["payments"][0]
    assert pay["status"] == "waiting" and pay["owner_amount_cents"] == 450_000 and pay["partner_amount_cents"] is None
    inv = data(client.post(f"{API}/me/partner-invites/{inv['id']}/payments/{pay['id']}/confirm", headers=thabo.headers, json={"amount_cents": 450_000}), "invite")
    assert inv["payments"][0]["status"] == "confirmed"
    error(client.post(f"{API}/me/partner-invites/{inv['id']}/payments/{pay['id']}/confirm", headers=thabo.headers, json={"amount_cents": 1}), 409)


def test_different_amounts_are_both_kept(client, nomsa, thabo):
    j = job(client, nomsa)
    p = data(invite(client, nomsa, thabo, j), "partner")
    data(client.post(f"{API}/me/partner-invites/{p['id']}/answer", headers=thabo.headers, json={"accept": True}))
    pay = data(client.post(f"{API}/me/job-partners/{p['id']}/payments", headers=nomsa.headers, json={"amount_cents": 450_000}), "partner")["payments"][0]
    inv = data(client.post(f"{API}/me/partner-invites/{p['id']}/payments/{pay['id']}/confirm", headers=thabo.headers, json={"amount_cents": 400_000}), "invite")
    assert inv["payments"][0] == {**inv["payments"][0], "status": "amounts_dont_match", "owner_amount_cents": 450_000, "partner_amount_cents": 400_000}


def test_a_declined_invite_can_be_sent_again(client, nomsa, thabo):
    j = job(client, nomsa)
    p = data(invite(client, nomsa, thabo, j), "partner")
    error(invite(client, nomsa, thabo, j), 409)  # already on the job
    data(client.post(f"{API}/me/partner-invites/{p['id']}/answer", headers=thabo.headers, json={"accept": False}))
    assert data(client.get(f"{API}/me/partner-invites", headers=thabo.headers), "invites") == []
    assert data(invite(client, nomsa, thabo, j), "partner")["status"] == "invited"


def test_inviting_needs_you_to_be_shown(client, outbox, thabo):
    quiet = builder(client, outbox, "quiet@example.com", "Quiet Builder", visible=False)
    j = job(client, quiet)
    assert error(invite(client, quiet, thabo, j), 409)["code"] == "PROFILE_HIDDEN"


@pytest.mark.parametrize(
    "kw,message",
    [
        ({"offer": {**OFFER, "kind": "per_day", "amount_cents": 1_000_001}}, "A day rate up to R10,000."),
        ({"offer": {**OFFER, "kind": "per_day", "amount_cents": 1_000_000, "days": 21}}, "Pay up to R200,000."),
        ({"offer": {**OFFER, "amount_cents": 20_000_001}}, "Type the pay."),
        ({"offer": {**OFFER, "amount_cents": 0}}, "Type the pay."),
        ({"offer": {**OFFER, "days": 61}}, "1 to 60 days."),
        ({"offer": {**OFFER, "paid_when": "someday"}}, "Pick when it's paid."),
        ({"starts_in": -1}, "Pick a start day in the next 60 days."),
        ({"starts_in": 61}, "Pick a start day in the next 60 days."),
        ({"trade": "electrician"}, "Thabo doesn't do that trade."),
    ],
)
def test_offer_rules(client, nomsa, thabo, kw, message):
    j = job(client, nomsa)
    assert error(invite(client, nomsa, thabo, j, **kw), 422)["message"] == message


def test_only_open_stages_of_that_job(client, app, nomsa, thabo):
    j = job(client, nomsa)
    other = job(client, nomsa, title="Boundary wall")
    confirm_stage(app, j["id"], 0)
    body = {"builder_id": thabo.id, **deal(j, "Deposit")}
    r = client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json=body)
    assert error(r, 422)["message"] == "That stage is already confirmed by the client."
    body = {"builder_id": thabo.id, **deal(j), "stage_ids": [stage_id(other, "Final")]}
    assert error(client.post(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers, json=body), 422)["message"] == "Pick stages of this job."


def test_five_partners_per_job(client, outbox, nomsa):
    j = job(client, nomsa)
    for i in range(5):
        b = builder(client, outbox, f"p{i}@example.com", f"Plumber Number{chr(65 + i)}", trade="plumber")
        data(invite(client, nomsa, b, j))
    sixth = builder(client, outbox, "p6@example.com", "Plumber Sixth", trade="plumber")
    assert error(invite(client, nomsa, sixth, j), 409)["code"] == "TOO_MANY_PARTNERS"


def test_invites_a_day(client, monkeypatch, nomsa, thabo, outbox):
    from src.domains.informal_trader.builder_network.services import partners_service

    monkeypatch.setattr(partners_service, "INVITES_PER_DAY", 1)
    data(invite(client, nomsa, thabo, job(client, nomsa)))
    other = builder(client, outbox, "sipho@example.com", "Sipho Dube", trade="plumber")
    assert error(invite(client, nomsa, other, job(client, nomsa)), 429)["code"] == "RATE_LIMITED"


def test_candidates_for_a_trade_within_their_travel(client, outbox, nomsa, thabo):
    builder(client, outbox, "far@example.com", "Far Plumber", trade="plumber", pin=CAPE_TOWN, suburb="Cape Town")
    builder(client, outbox, "sparky@example.com", "Palesa Mahlangu", trade="electrician")
    j = job(client, nomsa)
    c = data(client.get(f"{API}/me/jobs/{j['id']}/candidates?trade=plumber", headers=nomsa.headers))
    assert [b["name"] for b in c["nearby"]] == ["Thabo Nkosi"] and c["partners"] == [] and c["saved"] == []
    error(client.get(f"{API}/me/jobs/{j['id']}/candidates", headers=nomsa.headers), 422)

    # Once partners, Thabo is listed as your partner, not "nearby".
    other = job(client, nomsa, title="Boundary wall")
    p = data(invite(client, nomsa, thabo, other), "partner")
    data(client.post(f"{API}/me/partner-invites/{p['id']}/answer", headers=thabo.headers, json={"accept": True}))
    c = data(client.get(f"{API}/me/jobs/{j['id']}/candidates?trade=plumber", headers=nomsa.headers))
    assert [b["name"] for b in c["partners"]] == ["Thabo Nkosi"] and c["nearby"] == []
    home = data(client.get(f"{API}/builders", headers=nomsa.headers))
    assert [b["name"] for b in home["partners"]] == ["Thabo Nkosi"] and home["partners"][0]["phone"] == "0761234501"


# ------------------------------------------------------------------ help posts


def post(client, owner, job_json, **kw):
    return client.post(f"{API}/me/jobs/{job_json['id']}/help-posts", headers=owner.headers, json={**deal(job_json, **kw), "suburb": "Tembisa"})


def test_help_post_interested_pick(client, outbox, nomsa, thabo):
    builder(client, outbox, "sparky@example.com", "Palesa Mahlangu", trade="electrician")
    j = job(client, nomsa)
    hp = data(post(client, nomsa, j, offer={"kind": "per_day", "amount_cents": 60_000, "days": 2, "paid_when": "daily"}), "post")
    assert hp["mine"] and hp["what"] == "Final" and hp["job_title"] == "Room extension" and hp["status"] == "open" and hp["responses"] == []
    assert "latitude" not in json.dumps(hp)

    # A plumber near the job sees it, with the pay; the electrician doesn't.
    wanted = data(client.get(f"{API}/builders", headers=thabo.headers))["help_wanted"]
    assert [w["id"] for w in wanted] == [hp["id"]] and wanted[0]["offer"]["amount_cents"] == 60_000 and wanted[0]["job_id"] is None
    assert wanted[0]["owner"]["phone"] is None and 2.5 < wanted[0]["distance_km"] < 4

    seen = data(client.post(f"{API}/help-posts/{hp['id']}/interested", headers=thabo.headers), "post")
    assert seen["my_response"] == "interested" and seen["responses"] == [] and seen["job_title"] is None

    mine = data(client.get(f"{API}/help-posts/{hp['id']}", headers=nomsa.headers), "post")
    assert [r["builder"]["name"] for r in mine["responses"]] == ["Thabo Nkosi"] and mine["responses"][0]["builder"]["phone"] is None

    picked = data(client.post(f"{API}/me/help-posts/{hp['id']}/pick", headers=nomsa.headers, json={"builder_id": thabo.id}), "post")
    assert picked["status"] == "filled" and picked["responses"][0]["status"] == "picked" and picked["responses"][0]["builder"]["phone"] == "0761234501"
    on_job = data(client.get(f"{API}/me/jobs/{j['id']}/partners", headers=nomsa.headers), "partners")
    assert on_job[0]["status"] == "accepted" and on_job[0]["offer"] == {"kind": "per_day", "amount_cents": 60_000, "days": 2, "paid_when": "daily"}
    error(client.post(f"{API}/me/help-posts/{hp['id']}/pick", headers=nomsa.headers, json={"builder_id": thabo.id}), 409)


def test_help_post_rules(client, outbox, nomsa, thabo):
    sparky = builder(client, outbox, "sparky@example.com", "Palesa Mahlangu", trade="electrician")
    j = job(client, nomsa)
    hp = data(post(client, nomsa, j), "post")
    assert error(client.post(f"{API}/help-posts/{hp['id']}/interested", headers=sparky.headers), 422)["message"] == "This post is for another trade."
    error(client.post(f"{API}/help-posts/{hp['id']}/interested", headers=nomsa.headers), 422)
    error(client.post(f"{API}/me/help-posts/{hp['id']}/pick", headers=nomsa.headers, json={"builder_id": thabo.id}), 404)  # not interested
    error(client.post(f"{API}/me/help-posts/{hp['id']}/close", headers=thabo.headers), 404)
    closed = data(client.post(f"{API}/me/help-posts/{hp['id']}/close", headers=nomsa.headers), "post")
    assert closed["status"] == "closed"
    assert error(client.post(f"{API}/help-posts/{hp['id']}/interested", headers=thabo.headers), 409)["code"] == "POST_CLOSED"
    error(client.get(f"{API}/help-posts/{hp['id']}", headers=thabo.headers), 404)  # closed, and he never answered


def test_five_open_posts(client, nomsa):
    j = job(client, nomsa)
    for _ in range(5):
        data(post(client, nomsa, j))
    assert error(post(client, nomsa, j), 409)["code"] == "TOO_MANY_POSTS"


def test_posting_needs_you_to_be_shown(client, outbox):
    quiet = builder(client, outbox, "quiet@example.com", "Quiet Builder", visible=False)
    assert error(post(client, quiet, job(client, quiet)), 409)["code"] == "PROFILE_HIDDEN"


# ------------------------------------------------------------------ partners' builds count on both profiles


def test_partner_build_counts_on_the_partners_profile(client, app, nomsa, thabo):
    j = job(client, nomsa)
    p = data(invite(client, nomsa, thabo, j), "partner")
    data(client.post(f"{API}/me/partner-invites/{p['id']}/answer", headers=thabo.headers, json={"accept": True}))
    finish(app, j["id"])
    b = data(client.get(f"{API}/builders/{thabo.id}", headers=nomsa.headers), "builder")
    assert b["confirmed_stages"] == 1 and b["builds_confirmed"] == 1 and b["worked_with"] == ["you"]
    assert [(x["title"], x["built_with"], [ph["stage_name"] for ph in x["photos"]]) for x in b["builds"]] == [("Room extension", ["Nomsa"], ["Final"])]
    me = data(client.get(f"{API}/builders/{nomsa.id}", headers=thabo.headers), "builder")
    assert me["builds"][0]["built_with"] == ["Thabo"]
