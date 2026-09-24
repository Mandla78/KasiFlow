"""identity: two-factor sign-in (trusted phones, sign-in codes)

Revision ID: 0006_two_factor
Revises: 0005_google_identities
Create Date: 2026-09-25 10:00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0006_two_factor'
down_revision = '0005_google_identities'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('trusted_phones',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('platform', sa.String(length=20), nullable=True),
    sa.Column('label', sa.String(length=80), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('revoked_reason', sa.String(length=30), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['identity.users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash'),
    schema='identity'
    )
    op.create_index('ix_identity_trusted_phones_user_id', 'trusted_phones', ['user_id'], unique=False, schema='identity')

    op.add_column('sessions', sa.Column('trusted_phone_id', sa.UUID(), nullable=True), schema='identity')
    op.create_foreign_key(
        'fk_sessions_trusted_phone_id', 'sessions', 'trusted_phones', ['trusted_phone_id'], ['id'],
        source_schema='identity', referent_schema='identity', ondelete='SET NULL',
    )

    op.add_column('email_codes', sa.Column('challenge_hash', sa.String(length=64), nullable=True), schema='identity')
    op.create_index('ix_identity_email_codes_challenge_hash', 'email_codes', ['challenge_hash'], unique=False, schema='identity')
    op.drop_constraint('ck_email_codes_purpose', 'email_codes', schema='identity', type_='check')
    op.create_check_constraint('ck_email_codes_purpose', 'email_codes', "purpose IN ('verify_email', 'sign_in')", schema='identity')


def downgrade():
    op.execute("DELETE FROM identity.email_codes WHERE purpose = 'sign_in'")
    op.drop_constraint('ck_email_codes_purpose', 'email_codes', schema='identity', type_='check')
    op.create_check_constraint('ck_email_codes_purpose', 'email_codes', "purpose IN ('verify_email')", schema='identity')
    op.drop_index('ix_identity_email_codes_challenge_hash', table_name='email_codes', schema='identity')
    op.drop_column('email_codes', 'challenge_hash', schema='identity')
    op.drop_constraint('fk_sessions_trusted_phone_id', 'sessions', schema='identity', type_='foreignkey')
    op.drop_column('sessions', 'trusted_phone_id', schema='identity')
    op.drop_index('ix_identity_trusted_phones_user_id', table_name='trusted_phones', schema='identity')
    op.drop_table('trusted_phones', schema='identity')
