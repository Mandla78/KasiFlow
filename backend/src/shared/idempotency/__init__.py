"""idempotency -- "a retried request lands exactly once".

When a phone comes back online, or a supplier's ERP times out, the
same request is sent again. The client sends an Idempotency-Key header;
we store the first answer and return it for any retry.

    models.py      the idempotency_keys table (schema: platform)
    service.py     claim / complete / replay a key
    jobs/          the sweep that deletes expired keys (after 24 hours)
    schedulers/    registers that sweep with the master scheduler
"""
