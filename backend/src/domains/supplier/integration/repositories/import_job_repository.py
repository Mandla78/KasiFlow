"""All database access for import jobs. Only this feature's services call this."""
from __future__ import annotations

from src.extensions import db

from ..models import ImportJob


def add(job: ImportJob) -> ImportJob:
    db.session.add(job)
    return job
