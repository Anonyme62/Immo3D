from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
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


def ensure_sqlite_compatibility_migrations():
    if not settings.database_url.startswith("sqlite"):
        return

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    if "custom_markers" not in existing_tables:
        return

    custom_marker_columns = {
        column["name"] for column in inspector.get_columns("custom_markers")
    }

    with engine.begin() as connection:
        if "search_zone" not in custom_marker_columns:
            connection.execute(
                text(
                    "ALTER TABLE custom_markers "
                    "ADD COLUMN search_zone VARCHAR(64) NOT NULL DEFAULT ''"
                )
            )
