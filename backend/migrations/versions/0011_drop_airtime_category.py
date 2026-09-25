"""remove the Airtime & Electricity category

Revision ID: 0011_drop_airtime_category
Revises: 0010_business_name_to_profile
Create Date: 2026-09-25 15:00:00

Prepaid airtime and electricity are vouchers sold through a vending
service, not stock a trader orders from a supplier, so the category is
gone from the allowed list. Profiles that chose it lose just that one
code; otherwise their next save would be rejected by the stricter list.
"""
from alembic import op


revision = '0011_drop_airtime_category'
down_revision = '0010_business_name_to_profile'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        UPDATE trader.business_profiles
        SET categories = array_remove(categories, 'airtime_electricity')
        WHERE 'airtime_electricity' = ANY(categories)
    """)


def downgrade():
    # Which profiles had it isn't kept; putting it back would be a guess.
    pass
