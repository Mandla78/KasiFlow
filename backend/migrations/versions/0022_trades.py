"""trader: the 11 trades (painter and tiler apart; bricklayer, roofer, welder, glazier)

QUESTION_trades.txt, approved. Only the allowed values of
business_profiles.trade change, and a painter_tiler becomes a painter
(the sign-up trade is one trade; a builder profile already made from it
keeps both painter and tiler in its own list). The builder network's
profiles already use the 11 trades.

Revision ID: 0022_trades
Revises: 0021_order_book
Create Date: 2026-09-26 13:30:00

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '0022_trades'
down_revision = '0021_order_book'
branch_labels = None
depends_on = None

NAME = 'ck_business_profiles_trade'
OLD = ('general_builder', 'plumber', 'electrician', 'carpenter', 'painter_tiler', 'other_trade')
NEW = ('general_builder', 'bricklayer', 'plumber', 'electrician', 'carpenter', 'roofer', 'tiler', 'painter', 'welder', 'glazier', 'other_trade')


def _check(values):
    return "trade IS NULL OR trade IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def upgrade():
    # The old check has to go first: "painter" isn't allowed by it.
    op.drop_constraint(NAME, 'business_profiles', schema='trader', type_='check')
    op.execute("UPDATE trader.business_profiles SET trade = 'painter' WHERE trade = 'painter_tiler'")
    op.create_check_constraint(NAME, 'business_profiles', _check(NEW), schema='trader')


def downgrade():
    op.drop_constraint(NAME, 'business_profiles', schema='trader', type_='check')
    # The nearest old value for each new one.
    op.execute("UPDATE trader.business_profiles SET trade = 'painter_tiler' WHERE trade IN ('painter', 'tiler')")
    op.execute("UPDATE trader.business_profiles SET trade = 'other_trade' WHERE trade IN ('bricklayer', 'roofer', 'welder', 'glazier')")
    op.create_check_constraint(NAME, 'business_profiles', _check(OLD), schema='trader')
