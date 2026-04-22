"""drop local supplier tables

Revision ID: c1d2e3f4a5b6
Revises: b4c5d6e7f8a9
Create Date: 2026-04-21 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b4c5d6e7f8a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('scraper_templates')
    op.drop_index('ix_local_suppliers_user_id', table_name='local_suppliers')
    op.drop_table('local_suppliers')
    op.drop_table('user_profiles')


def downgrade() -> None:
    pass  # Not restoring — feature was removed intentionally
