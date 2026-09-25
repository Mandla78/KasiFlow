"""
SupplierConnection -- a trader connected to a supplier. Only connected
traders can order from that supplier.

Disconnecting soft-deletes the row (BaseModel): the history of who was
connected when is kept, and connecting again makes a new row. At most one
LIVE connection per trader and supplier (partial unique index).
"""
from __future__ import annotations

from sqlalchemy.dialects.postgresql import UUID

from src.core.base_model import BaseModel
from src.extensions import db


class SupplierConnection(BaseModel):
    __tablename__ = "supplier_connections"
    __table_args__ = (
        db.Index(
            "uq_supplier_connections_live",
            "user_id",
            "supplier_id",
            unique=True,
            postgresql_where=db.text("is_deleted = false"),
        ),
        {"schema": "trader"},
    )

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id = db.Column(UUID(as_uuid=True), db.ForeignKey("supplier.suppliers.id", ondelete="CASCADE"), nullable=False)
