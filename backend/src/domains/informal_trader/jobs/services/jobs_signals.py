"""
What a builder's jobs say about what they'll buy -- for the supplier
engine's suggestions (docs/teammate/14_ROUND_2_BRIEF.txt §4,
feedback/SIGNALS_jobs.txt). Read-only.

  demand_signals(user) -> {
      "categories": {"building_materials": 0.6, "plumbing": 0.4},  # shares of the work still to do
      "active_sites": [{"lat": -26.0, "lng": 28.23}],               # where to deliver, ~1 km
      "next_stages": ["walls", "roof"],                             # what's coming up
  }

PRIVACY (non-negotiable): the builder's own data, for the builder's own
suggestions. Aggregated shares only: no client names or phones, no job
titles, no amounts, never sent to a supplier. A pin is rounded to 0.01
degrees (about 1 km).

How categories are worked out: each stage NOT yet confirmed counts with
its amount (the work still to buy for). Its name picks the categories
("Bathroom pipes" -> plumbing, "Roof" -> building materials and tools);
a name we don't recognise falls back to the builder's trade. With no open
stages at all, the trade alone decides.
"""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Optional

from src.domains.informal_trader.business_profile.services import business_profile_service

from ..repositories import jobs_repository as repo

#: What each sign-up trade usually buys (the app's constants/businessTypes.ts TRADES).
TRADE_CATEGORIES = {
    "general_builder": ("building_materials", "tools_hardware", "paint_finishes", "plumbing", "electrical"),
    "bricklayer": ("building_materials", "tools_hardware"),
    "plumber": ("plumbing", "tools_hardware", "building_materials"),
    "electrician": ("electrical", "tools_hardware"),
    "carpenter": ("building_materials", "tools_hardware", "paint_finishes"),
    "roofer": ("building_materials", "tools_hardware"),
    "tiler": ("paint_finishes", "building_materials"),
    "painter": ("paint_finishes", "building_materials"),
    "welder": ("tools_hardware", "building_materials"),
    "glazier": ("building_materials", "tools_hardware"),
    "other_trade": ("tools_hardware", "building_materials"),
}

#: Words in a stage's name -> what that stage needs. First match wins per word; a stage can match several.
STAGE_WORDS = (
    (("foundation", "footing", "slab", "concrete", "wall", "brick", "block", "plaster", "screed", "paving", "pillar", "extension", "room"), ("building_materials",)),
    (("roof", "truss", "sheeting", "ceiling", "gutter"), ("building_materials", "tools_hardware")),
    (("plumb", "pipe", "drain", "bathroom", "toilet", "shower", "geyser", "tap", "water", "sink", "kitchen"), ("plumbing",)),
    (("electric", "wiring", "wire", "plug", "light", "db board", "conduit", "power"), ("electrical",)),
    (("paint", "tile", "tiling", "floor", "finish", "splashback"), ("paint_finishes",)),
    (("door", "window", "frame", "cupboard", "gate", "burglar", "steel", "carport", "fence"), ("tools_hardware", "building_materials")),
)

MAX_NEXT_STAGES = 5


def _stage_categories(name: str) -> tuple[str, ...]:
    text = name.lower()
    found: list[str] = []
    for words, cats in STAGE_WORDS:
        if any(re.search(rf"\b{re.escape(w)}", text) for w in words):
            found += [c for c in cats if c not in found]
    return tuple(found)


def _trade_categories(trade: Optional[str]) -> tuple[str, ...]:
    return TRADE_CATEGORIES.get(trade or "", TRADE_CATEGORIES["general_builder"])


def demand_signals(user) -> dict:
    profile = business_profile_service.get(user)
    trade_cats = _trade_categories(profile.trade if profile else None)
    active = [j for j in repo.jobs(user.id) if j.status == "active"]

    weights: dict[str, float] = defaultdict(float)
    next_stages: list[str] = []
    for job in active:
        open_stages = [s for s in sorted(job.stages, key=lambda s: s.position) if s.status != "confirmed"]
        if open_stages:
            name = open_stages[0].name.strip().lower()
            if name and name not in next_stages:
                next_stages.append(name)
        for s in open_stages:
            cats = _stage_categories(s.name) or trade_cats
            for c in cats:
                weights[c] += s.amount_cents / len(cats)
    if not weights:
        for c in trade_cats:
            weights[c] += 1.0

    total = sum(weights.values())
    shares = {c: round(w / total, 2) for c, w in sorted(weights.items(), key=lambda kv: (-kv[1], kv[0]))}

    sites = []
    if active and profile is not None and profile.latitude is not None:
        sites.append({"lat": round(float(profile.latitude), 2), "lng": round(float(profile.longitude), 2)})

    return {"categories": shares, "active_sites": sites, "next_stages": next_stages[:MAX_NEXT_STAGES]}
