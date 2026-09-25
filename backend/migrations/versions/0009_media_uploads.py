"""media: Akayza's own upload table (replaces the copied intents/ledger tables)

Revision ID: 0009_media_uploads
Revises: 0008_media
Create Date: 2026-09-25 08:00:00

The media module was rewritten (TruConnect is a reference only). Its two
tables become one, platform.media_uploads, and the profile-photo table
gets the new column names. Both old tables were hours old and held only
development data, so they are dropped and recreated rather than migrated.
"""
from alembic import op
import sqlalchemy as sa


revision = '0009_media_uploads'
down_revision = '0008_media'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table('media_upload_records', schema='platform')
    op.drop_table('media_upload_intents', schema='platform')
    op.drop_table('business_profile_images', schema='trader')

    op.create_table('media_uploads',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('purpose', sa.String(length=40), nullable=False),
    sa.Column('public_id', sa.String(length=300), nullable=False),
    sa.Column('state', sa.String(length=12), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('bytes', sa.Integer(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('is_deleted', sa.Boolean(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("state IN ('started', 'finished', 'abandoned', 'cancelled')", name='ck_media_uploads_state'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('public_id'),
    schema='platform'
    )
    op.create_index('ix_media_uploads_state_expires_at', 'media_uploads', ['state', 'expires_at'], unique=False, schema='platform')
    op.create_index('ix_media_uploads_user_id_finished_at', 'media_uploads', ['user_id', 'finished_at'], unique=False, schema='platform')

    op.create_table('business_profile_images',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('is_deleted', sa.Boolean(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('public_id', sa.String(length=300), nullable=False),
    sa.Column('url', sa.String(length=1000), nullable=False),
    sa.Column('format', sa.String(length=10), nullable=True),
    sa.Column('width', sa.Integer(), nullable=True),
    sa.Column('height', sa.Integer(), nullable=True),
    sa.Column('bytes', sa.Integer(), nullable=False),
    sa.Column('scan_status', sa.String(length=10), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['identity.users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('public_id'),
    schema='trader'
    )
    op.create_index('ix_business_profile_images_user_id', 'business_profile_images', ['user_id'], unique=False, schema='trader')
    # Photos recorded under the old table are no longer tracked.
    op.execute("UPDATE trader.business_profiles SET profile_image_url = NULL")


def downgrade():
    raise NotImplementedError("One-way: the copied media tables are not coming back.")
