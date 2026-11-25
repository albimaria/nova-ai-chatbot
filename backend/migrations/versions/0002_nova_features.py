"""Profiles, custom instructions, pinned/shared chats, message feedback

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-24
"""
from alembic import op
import sqlalchemy as sa


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("name", sa.String(), nullable=True))
        batch.add_column(sa.Column("custom_instructions", sa.Text(), nullable=True))

    with op.batch_alter_table("conversations") as batch:
        batch.add_column(
            sa.Column(
                "pinned", sa.Boolean(), nullable=False, server_default=sa.false()
            )
        )
        batch.add_column(sa.Column("share_token", sa.String(), nullable=True))
        batch.create_index(
            "ix_conversations_share_token", ["share_token"], unique=True
        )

    with op.batch_alter_table("messages") as batch:
        batch.add_column(sa.Column("feedback", sa.String(), nullable=True))
        batch.add_column(sa.Column("sources", sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table("messages") as batch:
        batch.drop_column("sources")
        batch.drop_column("feedback")

    with op.batch_alter_table("conversations") as batch:
        batch.drop_index("ix_conversations_share_token")
        batch.drop_column("share_token")
        batch.drop_column("pinned")

    with op.batch_alter_table("users") as batch:
        batch.drop_column("custom_instructions")
        batch.drop_column("name")
