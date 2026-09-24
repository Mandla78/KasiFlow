"""
audit -- "who did what, when, and from where", kept forever.

Subscribes to src/shared/audit at start-up (services/audit_service.register)
and writes each event on its OWN database connection, so:
  * a failed request still leaves its audit row (the row isn't rolled
    back with the request's transaction), and
  * writing the audit row never commits half of someone else's work.

The table is append-only: a trigger rejects every UPDATE and DELETE.
"""
