"""Bring the database schema up to date on startup."""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy import text

from database.connection import engine


logger = logging.getLogger("nova.migrate")

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _config(connection) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.attributes["connection"] = connection
    config.attributes["configure_logger"] = False
    return config


def run_migrations() -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        tables = set(inspector.get_table_names())
        config = _config(connection)

        if "alembic_version" not in tables and "users" in tables:
            # A database created before migrations existed (via create_all).
            logger.info("Existing database found; marking it as revision 0001.")

            columns = {c["name"] for c in inspector.get_columns("conversations")}

            if "user_id" not in columns:
                connection.execute(
                    text(
                        "ALTER TABLE conversations "
                        "ADD COLUMN user_id VARCHAR REFERENCES users(id)"
                    )
                )

            command.stamp(config, "0001")

        command.upgrade(config, "head")
