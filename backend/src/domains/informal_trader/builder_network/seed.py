"""
`flask builders seed [--me EMAIL]` -- sample builders for trying the
builder network on the REAL backend (development only; refused anywhere
else). The same people as the app's mock (Thabo, Sipho, Palesa...), each
with finished jobs whose stages a "client" confirmed, and the free Pexels
photos from frontend/mobile/assets/sample-work uploaded once to
<MEDIA_ROOT_FOLDER>/dev-seed/builders on your own Cloudinary.

With --me, the sample builders sit around YOUR business pin, Sipho is
already your partner (a finished wall you built together), Sipho invites
you onto a new job with the pay stated, and help posts near you ask for
your trade. Safe to run twice: people and jobs that exist are kept.

Accounts, profiles and jobs go through the real services; only the
"client confirmed this stage" step is set directly (there is no client).
Sample builders can't sign in: they have no password.
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from pathlib import Path
from typing import Optional

import click
import requests
from flask import Flask
from flask.cli import AppGroup

from src.core.base_model import utcnow
from src.domains.identity.accounts.services import account_service
from src.domains.informal_trader.business_profile.services import business_profile_service
from src.domains.informal_trader.jobs.models import Job
from src.domains.informal_trader.jobs.services import jobs_service
from src.extensions import db
from src.shared.media import folders
from src.shared.media.provider import get_provider

from .models import HelpPost, JobPartner
from .services import profile_service
from .services.common import today

SAMPLE_WORK = Path(__file__).resolve().parents[5] / "frontend" / "mobile" / "assets" / "sample-work"
TEMBISA = (-25.9964, 28.2268)
CLIENT = {"client_name": "Sample client", "client_phone": "0820000000"}

# (key, name, sign-up trade, network trades, suburb, (dlat, dlng) from the centre, travel km, about, phone,
#  builds: (title, place, days ago, [(stage, photo file or None)], partner keys))
BUILDERS = [
    ("thabo", "Thabo Nkosi", "plumber", ["plumber"], "Ivory Park", (-0.0026, -0.0308), 20, "Bathrooms, kitchens and geysers. Neat work, on time.", "0761234501",
     [("Bathroom extension", "Ivory Park", 12, [("Drains", None), ("Bathroom pipes", "bathroom-pipes"), ("Water line", "water-pipe-fitting"), ("Taps and geyser", None)], ["sipho"]),
      ("Kitchen redo", "Tembisa", 40, [("Old pipes out", None), ("Sink and pipes", "pipes-under-sink"), ("Final", None)], ["kagiso"])]),
    ("sipho", "Sipho Dube", "general_builder", ["general_builder", "bricklayer"], "Tembisa", (0.0094, 0.0032), 20, "Rooms, boundary walls and extensions.", "0831234502",
     [("Two-room extension", "Tembisa", 20, [("Foundation", None), ("Walls", "brick-wall"), ("Roof", None), ("Plaster and paint", None), ("Final", None)], ["palesa"])]),
    ("palesa", "Palesa Mahlangu", "electrician", ["electrician"], "Kempton Park", (-0.0946, 0.0042), 40, "House wiring, plugs and DB boards. Certificate of compliance.", "0721234503",
     [("Room extension wiring", "Birch Acres", 18, [("Conduits", None), ("Plug points", "plug-boxes"), ("DB board", None)], [])]),
    ("kagiso", "Kagiso Molefe", "tiler", ["tiler"], "Rabie Ridge", (-0.0046, -0.0568), 20, "Floor and wall tiles, straight lines.", "0791234504",
     [("Lounge floor", "Rabie Ridge", 9, [("Screed", None), ("Floor tiles", "floor-tiles")], []),
      ("Kitchen floor", "Tembisa", 38, [("Kitchen floor", "tile-levelling"), ("Splashback", None)], [])]),
    ("musa", "Musa Zulu", "carpenter", ["roofer", "carpenter"], "Olifantsfontein", (0.0324, 0.0082), 40, "Roof trusses, sheeting and tiles.", "0741234505",
     [("Four-room house roof", "Olifantsfontein", 15, [("Wall plates", None), ("Roof trusses", "roof-trusses"), ("Sheeting", None)], [])]),
    ("bongani", "Bongani Ndlovu", "other_trade", ["welder"], "Midrand", (-0.0026, -0.0998), 40, "Gates, burglar bars and steel carports.", "0781234506",
     [("Carport", "Midrand", 25, [("Posts", None), ("Steel frame and roof", "steel-roof")], [])]),
    ("neo", "Neo Sithole", "general_builder", ["bricklayer"], "Ebony Park", (-0.0126, -0.0438), 20, "Brick paving and walls.", "0711234507",
     [("Driveway", "Ebony Park", 6, [("Levelling", None), ("Paving", "paving")], [])]),
    ("zanele", "Zanele Khumalo", "painter", ["painter"], "Clayville", (0.0164, 0.0152), 20, "Inside and outside painting.", "0631234508", []),
    ("refilwe", "Refilwe Mthembu", "general_builder", ["general_builder"], "Kempton Park", (-0.0986, -0.0018), 40, "Houses from foundation to roof.", "0821234509", []),
    ("andile", "Andile Khoza", "electrician", ["electrician"], "Tembisa", (0.0064, -0.0058), 20, "Wiring for new rooms and repairs.", "0601234511", []),
]

# Open help posts: (owner key, trade needed, job title, stage, starts in days, (kind, rand, days, paid when))
POSTS = [
    ("musa", "general_builder", "Four-room house", "Walls up before the roof", 3, ("fixed", 6000, 4, "end")),
    ("kagiso", "plumber", "Bathroom tiles", "Move a shower drain", 1, ("per_day", 700, 1, "daily")),
    ("refilwe", "electrician", "New room", "Wire a new room", 2, ("fixed", 2800, 2, "stage_confirmed")),
    ("bongani", "bricklayer", "Gate", "Brick pillars for a gate", 5, ("per_day", 550, 2, "daily")),
]


def register(app: Flask) -> None:
    builders = AppGroup("builders", help="The builder network.")

    @builders.command("seed")
    @click.option("--me", "me_email", default=None, help="Your own builder account: seed around your pin and link you in.")
    def seed(me_email: Optional[str]) -> None:
        """Sample builders with client-confirmed builds (development only). Safe to run twice."""
        # Sample people must never reach a production database.
        if app.config.get("ENV_NAME") not in ("development", "testing"):
            raise click.ClickException("Sample builders load only in development.")
        me = account_service.find_by_email(me_email) if me_email else None
        if me_email and me is None:
            raise click.ClickException(f"No account for {me_email}. Sign up in the app first.")
        centre = TEMBISA
        if me is not None:
            mine = business_profile_service.get(me)
            if mine is None or mine.latitude is None:
                raise click.ClickException("Your business profile has no pin yet: finish onboarding in the app first.")
            centre = (float(mine.latitude), float(mine.longitude))
        photos = _Photos()
        users = {}
        for spec in BUILDERS:
            users[spec[0]] = _builder(spec, centre, photos)
            click.echo(f"  {spec[1]}: ready")
        for spec in BUILDERS:
            _partners(spec, users)
        for post in POSTS:
            _post(post, users)
        if me is not None:
            _link_me(me, users, photos)
            click.echo(f"  {me_email}: Sipho is your partner and has invited you onto a job.")
        click.echo(f"Done. {photos.uploaded} photo(s) uploaded, {photos.reused} already there.")

    app.cli.add_command(builders)


class _Photos:
    """Each sample photo uploaded once to <root>/dev-seed/builders, like a phone would (signed form)."""

    def __init__(self):
        self.urls: dict[str, str] = {}
        self.uploaded = 0
        self.reused = 0
        self.folder = f"{folders.root()}/dev-seed/builders"

    def url(self, stem: str) -> tuple[str, str]:
        public_id = f"{self.folder}/{stem}"
        if stem not in self.urls:
            provider = get_provider()
            found = provider.find(public_id)
            if found is None:
                form = provider.upload_form(public_id, self.folder, 1600)
                with open(SAMPLE_WORK / f"{stem}.jpg", "rb") as f:
                    r = requests.post(form.url, data=form.fields, files={"file": f}, timeout=60)
                if r.status_code >= 300:
                    raise click.ClickException(f"Couldn't upload {stem}.jpg ({r.status_code}): check the Cloudinary keys in .env.")
                found = provider.find(public_id)
                self.uploaded += 1
            else:
                self.reused += 1
            self.urls[stem] = found.url if found else r.json()["secure_url"]
        return self.urls[stem], public_id


def _account(key: str):
    email = f"seed.{key}@akayza.test"
    user = account_service.find_by_email(email)
    if user is None:
        user = account_service.create_unverified(email)
        account_service.mark_verified(user)
        db.session.commit()
    return user


def _builder(spec, centre, photos: _Photos):
    key, name, trade, trades, suburb, (dlat, dlng), travel, about, phone, builds = spec
    user = _account(key)
    business_profile_service.save(
        user,
        {
            "business": {"business_name": f"{name.split()[0]} Builds", "business_type": "builder", "trade": trade, "owner_name": name, "years_trading": "3_plus", "cellphone": phone},
            "location": {"building": "", "street": "", "suburb": suburb, "city": "Ekurhuleni", "province": "Gauteng", "postal_code": "", "latitude": round(centre[0] + dlat, 6), "longitude": round(centre[1] + dlng, 6)},
        },
    )
    p = profile_service.ensure(user)
    p.trades, p.about, p.travel_km, p.visible = trades, about, travel, True
    p.visible_changed_at = p.visible_changed_at or utcnow()
    db.session.commit()
    if not Job.query.filter_by(user_id=user.id).first():
        for title, place, days_ago, stages, _with in builds:
            _finished_job(user, title, place, days_ago, stages, photos)
    return user


def _finished_job(user, title, place, days_ago, stages, photos: _Photos) -> Job:
    job = jobs_service.create_job(user, {**CLIENT, "title": title, "place": place, "total_cents": 500_000 * len(stages), "stages": [{"name": s, "amount_cents": 500_000} for s, _ in stages]})
    row = db.session.get(Job, uuid.UUID(job["id"]))
    at = utcnow() - timedelta(days=days_ago)
    for stage, (_, stem) in zip(row.stages, stages):
        # The client's "yes, and I paid the same": there is no client in a seed.
        stage.status, stage.confirmed_at = "confirmed", at
        stage.builder_amount_cents = stage.client_amount_cents = stage.amount_cents
        if stem:
            stage.photo_url, stage.photo_public_id = photos.url(stem)
            stage.photo_taken_at = at
    row.status = "done"
    db.session.commit()
    return row


def _live(job_id, builder_id) -> bool:
    return JobPartner.query.filter(JobPartner.job_id == job_id, JobPartner.builder_id == builder_id, JobPartner.status != "declined").first() is not None


def _partner(job: Job, owner, builder, stage_ids, *, status="accepted", trade="general_builder", starts_on=None, offer=("fixed", 3500, 3, "stage_confirmed")) -> None:
    if _live(job.id, builder.id):
        return
    kind, rand, days, paid_when = offer
    db.session.add(
        JobPartner(
            job_id=job.id, owner_id=owner.id, builder_id=builder.id, stage_ids=list(stage_ids), trade=trade, starts_on=starts_on or today(),
            pay_kind=kind, pay_cents=rand * 100, days=days, paid_when=paid_when, status=status, answered_at=utcnow() if status == "accepted" else None,
        )
    )
    db.session.commit()


def _partners(spec, users) -> None:
    """Who built with whom: the partner did the stages that have photos."""
    key, builds = spec[0], spec[9]
    owner = users[key]
    for title, _place, _days, stages, with_keys in builds:
        job = Job.query.filter_by(user_id=owner.id, title=title).first()
        if job is None:
            continue
        with_photos = [s.id for s, (_, stem) in zip(job.stages, stages) if stem] or [job.stages[-1].id]
        for other in with_keys:
            _partner(job, owner, users[other], with_photos, trade=BUILDERS_BY_KEY[other][3][0])


def _post(post, users) -> None:
    key, trade, title, stage, starts_in, (kind, rand, days, paid_when) = post
    owner = users[key]
    if HelpPost.query.filter_by(owner_id=owner.id, status="open").first():
        return
    job = jobs_service.create_job(owner, {**CLIENT, "title": title, "place": BUILDERS_BY_KEY[key][4], "total_cents": 1_000_000, "stages": [{"name": stage, "amount_cents": 1_000_000}]})
    mine = business_profile_service.get(owner)
    db.session.add(
        HelpPost(
            job_id=uuid.UUID(job["id"]), owner_id=owner.id, trade=trade, stage_ids=[uuid.UUID(job["stages"][0]["id"])], what=stage,
            starts_on=today() + timedelta(days=starts_in), suburb=BUILDERS_BY_KEY[key][4],
            latitude=round(mine.latitude, 2), longitude=round(mine.longitude, 2),
            pay_kind=kind, pay_cents=rand * 100, days=days, paid_when=paid_when, status="open", expires_at=utcnow() + timedelta(days=7),
        )
    )
    db.session.commit()


def _link_me(me, users, photos: _Photos) -> None:
    sipho = users["sipho"]
    profile_service.ensure(me)
    wall = Job.query.filter_by(user_id=sipho.id, title="Wall and gate").first()
    if wall is None:
        wall = _finished_job(sipho, "Wall and gate", "Tembisa", 45, [("Footings", None), ("Boundary wall", "block-wall"), ("Gate posts", None)], photos)
    _partner(wall, sipho, me, [wall.stages[1].id])
    new = Job.query.filter_by(user_id=sipho.id, title="Boundary wall and gate").first()
    if new is None:
        created = jobs_service.create_job(
            sipho,
            {**CLIENT, "title": "Boundary wall and gate", "place": "Clayville", "total_cents": 1_500_000, "stages": [{"name": n, "amount_cents": 500_000} for n in ("Foundation", "Walls", "Gate")]},
        )
        new = db.session.get(Job, uuid.UUID(created["id"]))
    _partner(new, sipho, me, [new.stages[0].id, new.stages[1].id], status="invited", starts_on=today() + timedelta(days=2), offer=("fixed", 3500, 4, "stage_confirmed"))


BUILDERS_BY_KEY = {b[0]: b for b in BUILDERS}
