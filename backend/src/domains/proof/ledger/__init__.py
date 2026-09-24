"""ledger -- "the record".

An append-only list of events (credit sale, repayment, delivery, cash
received...). Each event stores the SHA-256 hash of the one before it,
so changing any old event breaks the chain and is detectable. Events
are signed with the phone's key (identity/devices) and countersigned by
the server.

Never updated, never deleted.
"""
