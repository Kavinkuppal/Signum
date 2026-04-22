"""add local supplier tables

Revision ID: b4c5d6e7f8a9
Revises: 343454d93d3a
Create Date: 2026-04-21 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b4c5d6e7f8a9'
down_revision: Union[str, None] = '343454d93d3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables may already exist if this migration ran before — skip safely
    from sqlalchemy import inspect
    bind = op.get_bind()
    existing = inspect(bind).get_table_names()
    if 'user_profiles' in existing:
        return

    op.create_table(
        'user_profiles',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('zip_code', sa.String(20), nullable=True),
        sa.Column('city', sa.String(200), nullable=True),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lng', sa.Float(), nullable=True),
        sa.Column('search_radius_km', sa.Float(), nullable=False, server_default='80.0'),
        sa.Column('priority', sa.String(20), nullable=False, server_default='price'),
        sa.Column('material_interests', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )

    op.create_table(
        'local_suppliers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('osm_id', sa.String(50), nullable=True),
        sa.Column('osm_type', sa.String(20), nullable=True),
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('website', sa.Text(), nullable=True),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lng', sa.Float(), nullable=True),
        sa.Column('distance_km', sa.Float(), nullable=True),
        sa.Column('osm_tags', sa.JSON(), nullable=True),
        sa.Column('material_categories', sa.JSON(), nullable=True),
        sa.Column('scrape_status', sa.String(30), nullable=False, server_default='pending'),
        sa.Column('scrape_error', sa.Text(), nullable=True),
        sa.Column('products_found', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_scraped_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rank_score', sa.Float(), nullable=True),
        sa.Column('discovered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_local_suppliers_user_id', 'local_suppliers', ['user_id'])

    op.create_table(
        'scraper_templates',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('domain', sa.String(200), nullable=False),
        sa.Column('strategy', sa.String(30), nullable=False),
        sa.Column('template_data', sa.JSON(), nullable=True),
        sa.Column('success_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('domain'),
    )


def downgrade() -> None:
    op.drop_table('scraper_templates')
    op.drop_index('ix_local_suppliers_user_id', 'local_suppliers')
    op.drop_table('local_suppliers')
    op.drop_table('user_profiles')
