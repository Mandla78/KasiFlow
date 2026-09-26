"""
The jobs' part of a record seal (proof/integrity): stages the client
confirmed (with the stage photo's fingerprint) and every sign-off answer,
as (kind, id, fields). Open stages are left out: they can still change.
"""
from __future__ import annotations

from ..repositories import jobs_repository as repo


def seal_records(user) -> list[tuple[str, str, dict]]:
    stages, answers = repo.all_for_seal(user.id)
    out: list[tuple[str, str, dict]] = []
    for s in stages:
        out.append(("stage_confirmed", str(s.id), {
            "job": str(s.job_id),
            "name": s.name,
            "amount_cents": s.amount_cents,
            "client_amount_cents": s.client_amount_cents,
            "confirmed_at": s.confirmed_at,
            "photo_sha256": s.photo_sha256,
            "photo_taken_at": s.photo_taken_at,
        }))
    for a in answers:
        out.append(("sign_off_answer", str(a.id), {
            "stage": str(a.stage_id),
            "outcome": a.outcome,
            "builder_amount_cents": a.builder_amount_cents,
            "client_amount_cents": a.client_amount_cents,
            "client_note": a.client_note,
            "answered_at": a.used_at,
        }))
    return out
