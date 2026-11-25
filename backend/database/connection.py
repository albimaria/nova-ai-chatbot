from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

from config.settings import settings


def normalize_database_url(url: str) -> str:
    """Render/Heroku-style URLs start with postgres://; SQLAlchemy needs a driver."""

    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]

    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]

    return url


DATABASE_URL = normalize_database_url(settings.DATABASE_URL)

IS_SQLITE = DATABASE_URL.startswith("sqlite")


if IS_SQLITE:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(
        DATABASE_URL,
        # Server-side prepared statements break behind poolers such as Neon's
        # pooled endpoint / PgBouncer, so psycopg must not create them.
        connect_args={"prepare_threshold": None},
        # Hosted free tiers close idle connections; check and recycle them.
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,
        max_overflow=5,
    )


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()
