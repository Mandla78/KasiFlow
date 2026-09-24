"""Platform schema + idempotency_keys table.

Revision ID: 0002_platform_idempotency
Revises: 0001_create_schemas
Create Date: 2026-09-24

`platform` holds infrastructure that no business domain owns. The first
table is idempotency_keys (src/shared/idempotency/models.py): the stored
result of a request, so an offline retry or an ERP retry lands once.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_platform_idempotency"
down_revision = "0001_create_schemas"
branch_labels = None
depends_on = None


def upgrade():
    op.execute('CREATE SCHEMA IF NOT EXISTS "platform"')
    op.create_table(
        "idempotency_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("endpoint", sa.String(255), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("response_body", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("key", "user_id", name="uq_idempotency_key_user"),
        schema="platform",
    )
    op.create_index("ix_idempotency_keys_expires_at", "idempotency_keys", ["expires_at"], schema="platform")


def downgrade():
    op.drop_index("ix_idempotency_keys_expires_at", table_name="idempotency_keys", schema="platform")
    op.drop_table("idempotency_keys", schema="platform")
    # RESTRICT: refuses if anything else was added to the schema since.
    op.execute('DROP SCHEMA IF EXISTS "platform" RESTRICT')
