"""Usage tracking: one row per AI provider call

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-25
"""
from alembic import op
import sqlalchemy as sa


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "usage_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("conversation_id", sa.String(), nullable=True),
        sa.Column("kind", sa.String(), nullable=False, server_default="chat"),
        sa.Column("nova_model", sa.String(), nullable=True),
        sa.Column("gemini_model", sa.String(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("thinking_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("first_token_ms", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="ok"),
        sa.Column("error_code", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_usage_events_user_id", "usage_events", ["user_id"])
    op.create_index("ix_usage_events_gemini_model", "usage_events", ["gemini_model"])
    op.create_index("ix_usage_events_created_at", "usage_events", ["created_at"])


def downgrade():
    op.drop_table("usage_events")
