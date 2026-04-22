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
    # All statements use IF NOT EXISTS — safe to run even if tables already exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_profiles (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL UNIQUE,
            zip_code VARCHAR(20),
            city VARCHAR(200),
            lat FLOAT,
            lng FLOAT,
            search_radius_km FLOAT NOT NULL DEFAULT 80.0,
            priority VARCHAR(20) NOT NULL DEFAULT 'price',
            material_interests JSON,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS local_suppliers (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL,
            osm_id VARCHAR(50),
            osm_type VARCHAR(20),
            name VARCHAR(500) NOT NULL,
            address TEXT,
            phone VARCHAR(50),
            website TEXT,
            lat FLOAT,
            lng FLOAT,
            distance_km FLOAT,
            osm_tags JSON,
            material_categories JSON,
            scrape_status VARCHAR(30) NOT NULL DEFAULT 'pending',
            scrape_error TEXT,
            products_found INTEGER NOT NULL DEFAULT 0,
            last_scraped_at TIMESTAMPTZ,
            rank_score FLOAT,
            discovered_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_local_suppliers_user_id ON local_suppliers (user_id)")
    op.execute("""
        CREATE TABLE IF NOT EXISTS scraper_templates (
            id VARCHAR PRIMARY KEY,
            domain VARCHAR(200) NOT NULL UNIQUE,
            strategy VARCHAR(30) NOT NULL,
            template_data JSON,
            success_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_used_at TIMESTAMPTZ
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS scraper_templates")
    op.execute("DROP INDEX IF EXISTS ix_local_suppliers_user_id")
    op.execute("DROP TABLE IF EXISTS local_suppliers")
    op.execute("DROP TABLE IF EXISTS user_profiles")
