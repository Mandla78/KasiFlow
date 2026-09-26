"""trader: a "food" business type (food sellers, for the order book)

Only the allowed values of business_profiles.business_type change. The
order book tool itself is a key in the profile's tools JSON (no column).

Revision ID: 0020_food_seller
Revises: 0019_builder_network
Create Date: 2026-09-26 12:00:00

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '0020_food_seller'
down_revision = '0019_builder_network'
branch_labels = None
depends_on = None

NAME = 'ck_business_profiles_business_type'


def upgrade():
    op.drop_constraint(NAME, 'business_profiles', schema='trader', type_='check')
    op.create_check_constraint(
        NAME, 'business_profiles',
        "business_type IS NULL OR business_type IN ('builder', 'spaza', 'food', 'other')",
        schema='trader',
    )


def downgrade():
    # A food seller becomes "other" (the nearest type) before the value goes.
    op.execute("UPDATE trader.business_profiles SET business_type = 'other' WHERE business_type = 'food'")
    op.drop_constraint(NAME, 'business_profiles', schema='trader', type_='check')
    op.create_check_constraint(
        NAME, 'business_profiles',
        "business_type IS NULL OR business_type IN ('builder', 'spaza', 'other')",
        schema='trader',
    )
