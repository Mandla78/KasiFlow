"""
Demo data for jobs (`flask tools seed --me EMAIL`, development only): a
builder's jobs at every step, made through the real services -- stage
photos go through the signed upload and keep() (hashed on the server),
sign-off links are really sent and really answered, so the house record,
the proof numbers and the audit trail are what the app would make.

  Bathroom renovation   Dube family      done: 3 stages, photos, confirmed
  Room extension        Mokoena family   Deposit confirmed; Walls photo
                                         taken, link sent, waiting
  Boundary wall         Nkosi family     new
  Garage door           Molefe family    in the bin

Photos: the free Pexels ones the app's samples use (assets/sample-work,
SOURCES.txt there). Clients are made up. Run twice, nothing changes.
"""
from __future__ import annotations

import uuid
from pathlib import Path

import requests

from .services import job_photo_service, jobs_service, sign_off_service

SAMPLE_WORK = Path(__file__).resolve().parents[5] / "frontend" / "mobile" / "assets" / "sample-work"
MARKER = ("Room extension", "Mokoena family")


def _send(form, path: Path) -> None:
    """What the phone does with the signed form (a test swaps this out)."""
    with path.open("rb") as f:
        r = requests.post(form.url, data=form.fields, files={"file": f}, timeout=60)
    if r.status_code >= 300:
        raise RuntimeError(f"Couldn't upload {path.name} ({r.status_code}): check the Cloudinary keys in .env.")


def _photo(user, job: dict, stage: str, file: str) -> None:
    stage_id = _stage(job, stage)
    form = job_photo_service.upload_form(user, _id(job), stage_id)
    _send(form, SAMPLE_WORK / file)
    job_photo_service.keep(user, _id(job), stage_id, form.fields["public_id"])


def _id(job: dict) -> uuid.UUID:
    return uuid.UUID(job["id"])


def _stage(job: dict, name: str) -> uuid.UUID:
    return uuid.UUID(next(s["id"] for s in job["stages"] if s["name"] == name))


def _link(user, job: dict, stage: str) -> str:
    """Send the sign-off link; the ticket is what the client's page gets."""
    cents = next(s["amount_cents"] for s in job["stages"] if s["name"] == stage)
    _, link, _ = sign_off_service.send(user, _id(job), _stage(job, stage), cents)
    return link.split("ticket=", 1)[1]


def _confirmed(user, job: dict, stage: str) -> None:
    cents = next(s["amount_cents"] for s in job["stages"] if s["name"] == stage)
    sign_off_service.answer(_link(user, job, stage), "done", cents, "")


def _job(user, title, client, phone, place, stages) -> dict:
    return jobs_service.create_job(
        user,
        {"title": title, "client_name": client, "client_phone": phone, "place": place, "total_cents": sum(c for _, c in stages), "stages": [{"name": n, "amount_cents": c} for n, c in stages]},
    )


def seed(user) -> str:
    if any((j["title"], j["client_name"]) == MARKER for j in jobs_service.list_jobs(user)):
        return "jobs: already there"

    bathroom = _job(user, "Bathroom renovation", "Dube family", "0721234511", "Ivory Park, Ext 2", [("Pipes", 900_000), ("Tiles", 1_000_000), ("Final", 500_000)])
    for stage, file in (("Pipes", "pipes-under-sink.jpg"), ("Tiles", "floor-tiles.jpg"), ("Final", "bathroom-pipes.jpg")):
        _photo(user, bathroom, stage, file)
        _confirmed(user, bathroom, stage)

    extension = _job(user, "Room extension", "Mokoena family", "0821234567", "Tembisa, Ext 5", [("Deposit", 500_000), ("Walls", 1_200_000), ("Roof", 1_200_000), ("Final", 900_000)])
    _confirmed(user, extension, "Deposit")
    _photo(user, extension, "Walls", "brick-wall.jpg")
    _link(user, extension, "Walls")  # sent, not answered: waiting on the client

    _job(user, "Boundary wall", "Nkosi family", "0831234512", "Rabie Ridge", [("Foundation", 500_000), ("Blocks", 700_000), ("Plaster", 300_000)])

    garage = _job(user, "Garage door", "Molefe family", "0841234513", "Kaalfontein", [("Door and fitting", 800_000)])
    jobs_service.move_to_bin(user, _id(garage))
    return "jobs: 4 (1 done with photos, 1 waiting on the client, 1 new, 1 in the bin)"
