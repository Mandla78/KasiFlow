"""Create every database schema (no tables yet).

Revision ID: 0001_create_schemas
Revises:
Create Date: 2026-09-24

Tables arrive feature by feature in later migrations. The schema names
come from src/config.py DB_SCHEMAS, copied here on purpose: a migration
must keep meaning the same thing even if the config list changes later.
"""
from alembic import op

revision = "0001_create_schemas"
down_revision = None
branch_labels = None
depends_on = None

SCHEMAS = ("identity", "trader", "supplier", "commerce", "proof", "audit")


def upgrade():
    for name in SCHEMAS:
        op.execute(f'CREATE SCHEMA IF NOT EXISTS "{name}"')


def downgrade():
    # RESTRICT: refuses if a schema still holds tables, so a downgrade
    # can never silently destroy data.
    for name in reversed(SCHEMAS):
        op.execute(f'DROP SCHEMA IF EXISTS "{name}" RESTRICT')
