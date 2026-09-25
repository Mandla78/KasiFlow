"""
The ranking, with the same cases as the app's lib/__tests__/recommend.test.ts:
the server and the mock must explain builders the same way.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from src.domains.informal_trader.builder_network.services import ranking

NOW = datetime(2026, 9, 25, 12, tzinfo=timezone.utc)
TEMBISA = (-25.9964, 28.2268)
IVORY_PARK = (-25.999, 28.196)
SIPHO = uuid.uuid4()
NAMES = {SIPHO: "Sipho Dube"}
ME = ranking.Viewer(uuid.uuid4(), *TEMBISA, ("general_builder",), 20, frozenset({SIPHO}))


def days_ago(n: int) -> datetime:
    return NOW - timedelta(days=n)


def cand(name: str = "x", *, trades=("plumber",), travel_km=20, partners=(), stages=0, active=2, joined=300, pin=IVORY_PARK) -> ranking.Candidate:
    return ranking.Candidate(uuid.uuid4(), name, *pin, tuple(trades), travel_km, frozenset(partners), stages, days_ago(active), days_ago(joined))


def name_of(i):
    return NAMES.get(i, "")


def test_trade_fit_and_distance():
    assert ranking.trade_fit(["general_builder"], ["plumber"]) == 30
    assert ranking.trade_fit(["plumber"], ["plumber"]) == 15
    assert ranking.trade_fit(["plumber"], ["welder"]) == 5
    km = ranking.distance_km(*TEMBISA, *IVORY_PARK)
    assert 2.8 < km < 3.5 and ranking.km_text(km).startswith("3.") and ranking.km_text(14.6) == "15 km" and ranking.km_text(9.96) == "10 km"
    assert ranking.distance_km(None, 1, 2, 3) is None


def test_closeness_and_log_scaled_proof():
    assert ranking.closeness(0, 20) == 20 and ranking.closeness(10, 20) == 10 and ranking.closeness(25, 20) == 0
    assert ranking.proof(0) == 0 and round(ranking.proof(50), 6) == 20 and ranking.proof(500) == 20
    assert ranking.proof(5) / ranking.proof(50) > 0.4


def test_partners_in_common_come_first_and_are_explained():
    s = ranking.score(ME, cand(partners=[SIPHO], stages=12), name_of, NOW)
    assert s.reason == "Built with Sipho, your partner" and s.reasons[0] == s.reason
    assert "12 stages confirmed by clients" in s.reasons and "Plumbers often work with general builders" in s.reasons
    assert s.in_common == ["Sipho Dube"]


def test_cold_start_is_still_explained():
    assert ranking.score(ME, cand(joined=5), name_of, NOW).reason == "New on Akayza"
    assert ranking.score(ME, cand(), name_of, NOW).reason.startswith("Plumber · 3.")


def test_after_the_top_3_every_third_place_is_a_new_builder():
    strong = [cand(c, stages=40) for c in "abcdef"]
    fresh = [cand(f"n{i}", joined=3) for i in (1, 2)]
    out = [s.id for s in ranking.suggest(ME, strong + fresh, name_of, NOW, 12)]
    new_ids = [c.id for c in fresh]
    assert not set(out[:3]) & set(new_ids) and out[5] == new_ids[0] and new_ids[1] in out and len(out) == 8


def test_rank_for_job_only_that_trade_within_their_travel():
    near, proven = cand("near", stages=2), cand("proven", stages=30)
    others = [cand("tiler", trades=("tiler",)), cand("stays home", travel_km=2)]
    out = ranking.rank_for_job(ME, TEMBISA, "plumber", [near, proven, *others], name_of, NOW)
    assert [s.id for s in out] == [proven.id, near.id] and out[0].reason == "30 stages confirmed by clients"


def test_help_posts_only_your_trade_within_your_travel():
    owner = cand(stages=20)
    far = (-26.4, 28.2)
    posts = [("mine", "general_builder", *IVORY_PARK, owner), ("other trade", "plumber", *IVORY_PARK, owner), ("too far", "general_builder", *far, owner)]
    assert [p for p, _ in ranking.rank_posts(ME, posts, NOW)] == ["mine"]
