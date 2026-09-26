"""trader: delivery addresses (the extra places a trader has stock delivered to)

One new table: a trader's saved places besides the business address,
max 5 (checked in the service), soft-deleted so past orders keep reading
right, one live default per trader (partial unique index), pins inside
South Africa (check constraints). Nothing existing changes.
(docs/plan_v2_integrations/04, section 4c.)

Numbered 0025: 0024 ("I paid the cash", plan v2 02) is planned but not
built yet, so this follows 0023 (notifications). If 0024 lands first,
point this file's down_revision at it, so there's one line of migrations.

Revision ID: 0025_delivery_addresses
Revises: 0023_notifications
Create Date: 2026-09-26 11:59:39.774876

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0025_delivery_addresses'
down_revision = '0023_notifications'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('delivery_addresses',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('label', sa.String(length=30), nullable=False),
    sa.Column('address_text', sa.String(length=300), nullable=False),
    sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=False),
    sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('is_deleted', sa.Boolean(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint('latitude BETWEEN -35.5 AND -21.5', name='ck_delivery_addresses_latitude'),
    sa.CheckConstraint('longitude BETWEEN 16.0 AND 33.5', name='ck_delivery_addresses_longitude'),
    sa.ForeignKeyConstraint(['user_id'], ['identity.users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema='trader'
    )
    with op.batch_alter_table('delivery_addresses', schema='trader') as batch_op:
        batch_op.create_index(batch_op.f('ix_trader_delivery_addresses_user_id'), ['user_id'], unique=False)
        batch_op.create_index('uq_delivery_addresses_one_default', ['user_id'], unique=True, postgresql_where=sa.text('is_default AND NOT is_deleted'))



def downgrade():
    with op.batch_alter_table('delivery_addresses', schema='trader') as batch_op:
        batch_op.drop_index('uq_delivery_addresses_one_default', postgresql_where=sa.text('is_default AND NOT is_deleted'))
        batch_op.drop_index(batch_op.f('ix_trader_delivery_addresses_user_id'))

    op.drop_table('delivery_addresses', schema='trader')
