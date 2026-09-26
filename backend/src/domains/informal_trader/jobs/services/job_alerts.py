"""
The builder's alerts about their own jobs (CONTRACT_notifications.txt
section 3): what the client answered on the sign-off page, and "job done"
when that answer confirmed the last stage. Called AFTER db.session
.commit(); publish never raises, so the client's answer can't fail
because of an alert.

The builder's own job title and stage name, yes (Mandla, Q7); never the
client's name or phone.
"""
from __future__ import annotations

from src.shared.notifications.notification_types import NotificationEvent
from src.shared.notifications.notifications import publish_notification, safely

_ANSWER = {"confirmed": "job.stage_confirmed", "amounts_dont_match": "job.amounts_dont_match", "not_yet": "job.not_yet"}


def _publish(job, template: str, dedupe_key: str, **params) -> None:
    publish_notification(
        NotificationEvent(
            recipient_user_id=job.user_id,
            template=template,
            dedupe_key=dedupe_key,
            params={"job": job.title, **params},
            link_type="job",
            link_id=str(job.id),
        )
    )


@safely
def answered(job, stage, sign_off, done: bool) -> None:
    template = _ANSWER.get(sign_off.outcome)
    if template:
        extra = {"amount_cents": sign_off.client_amount_cents} if template == "job.stage_confirmed" else {}
        _publish(job, template, f"job:{stage.id}:{sign_off.id}", stage=stage.name, **extra)
    if done:
        _publish(job, "job.done", f"job:{job.id}:done")
