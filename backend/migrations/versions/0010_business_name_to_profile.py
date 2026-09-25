"""business name moves from the account to the business profile

Revision ID: 0010_business_name_to_profile
Revises: 0009_media_uploads
Create Date: 2026-09-25 12:00:00

Sign-up is now email + password only; the business name is asked in the
first onboarding step and belongs to the business profile. Every existing
account's name is copied across first (a profile row is created where
none exists yet), so no name is lost.
"""
from alembic import op
import sqlalchemy as sa


revision = '0010_business_name_to_profile'
down_revision = '0009_media_uploads'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('business_profiles', sa.Column('business_name', sa.String(length=80), nullable=True), schema='trader')
    op.execute("""
        UPDATE trader.business_profiles p SET business_name = u.business_name
        FROM identity.users u WHERE u.id = p.user_id
    """)
    op.execute("""
        INSERT INTO trader.business_profiles
            (id, user_id, business_name, sole_trader, categories, tools, created_at, updated_at, is_deleted)
        SELECT gen_random_uuid(), u.id, u.business_name, false, '{}', '{}'::jsonb, now(), now(), false
        FROM identity.users u
        WHERE NOT EXISTS (SELECT 1 FROM trader.business_profiles p WHERE p.user_id = u.id)
    """)
    op.drop_column('users', 'business_name', schema='identity')


def downgrade():
    op.add_column('users', sa.Column('business_name', sa.String(length=80), nullable=True), schema='identity')
    op.execute("""
        UPDATE identity.users u SET business_name = p.business_name
        FROM trader.business_profiles p WHERE p.user_id = u.id
    """)
    op.drop_column('business_profiles', 'business_name', schema='trader')
