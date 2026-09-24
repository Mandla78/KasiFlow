"""proof -- "the trust layer". What makes Akayza a record, not a notebook.

    ledger/       the tamper-evident record (hash chain)       CORE
    handshake/    cash confirmed by BOTH sides                 CORE
    integrity/    spotting mismatches and disputes             later
    reputation/   a score built from the record                later
    share/        a link to show your record to someone        later

Other domains WRITE EVENTS INTO the ledger; proof never reaches into
them. Hackathon priority: ledger + handshake first. The other three
stay empty until those work.

Tables live in the "proof" database schema.
"""
