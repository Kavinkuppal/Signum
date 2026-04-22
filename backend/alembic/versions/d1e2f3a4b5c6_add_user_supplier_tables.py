"""add user_id to products and custom_suppliers table

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6
Create Date: 2026-04-22 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add user_id to products — safe with IF NOT EXISTS
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id VARCHAR")
    op.execute("CREATE INDEX IF NOT EXISTS ix_products_user_id ON products (user_id)")

    op.create_table(
        'custom_suppliers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('domain', sa.String(200), nullable=False),
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('scrape_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('scrape_error', sa.Text(), nullable=True),
        sa.Column('scrape_strategy', sa.String(30), nullable=True),
        sa.Column('products_found', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_scraped_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_custom_suppliers_user_id ON custom_suppliers (user_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_custom_suppliers_user_id")
    op.drop_table('custom_suppliers')
    op.execute("DROP INDEX IF EXISTS ix_products_user_id")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS user_id")
