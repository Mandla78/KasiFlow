"""
Catalogue audit events: a supplier's products changing in bulk.

An import can change prices, stock and what traders see for hundreds of
products at once, so every run is on the audit trail: who ran it (a
supplier's system, or our CLI for seed data), how many rows were
created, updated and refused.
"""
from __future__ import annotations

import enum


class CatalogueAuditEvent(str, enum.Enum):
    IMPORT_FINISHED = "catalogue.import_finished"
    IMPORT_REFUSED = "catalogue.import_refused"
