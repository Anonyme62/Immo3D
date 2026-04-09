from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings
from app.security import build_lookup_hash, decrypt_sensitive_value, encrypt_sensitive_value


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

    with engine.begin() as connection:
        if "app_sessions" in existing_tables:
            app_session_columns = {
                column["name"] for column in inspector.get_columns("app_sessions")
            }
            if "csrf_token" not in app_session_columns:
                connection.execute(
                    text(
                        "ALTER TABLE app_sessions "
                        "ADD COLUMN csrf_token VARCHAR(128) NOT NULL DEFAULT ''"
                    )
                )

        if "users" in existing_tables:
            user_columns = {
                column["name"] for column in inspector.get_columns("users")
            }

            if "stripe_customer_id" not in user_columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255)")
                )
            if "stripe_subscription_id" not in user_columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255)")
                )
            if "subscription_price_id" not in user_columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN subscription_price_id VARCHAR(255)")
                )
            if "subscription_status" not in user_columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN subscription_status VARCHAR(64)")
                )
            if "subscription_current_period_end" not in user_columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN subscription_current_period_end DATETIME")
                )
            if "subscription_cancel_at_period_end" not in user_columns:
                connection.execute(
                    text(
                        "ALTER TABLE users "
                        "ADD COLUMN subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT 0"
                    )
                )
            if "subscription_updated_at" not in user_columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN subscription_updated_at DATETIME")
                )
            if "yanport_username_hash" not in user_columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN yanport_username_hash VARCHAR(64)")
                )
            if "yanport_email_hash" not in user_columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN yanport_email_hash VARCHAR(64)")
                )

            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_yanport_username_hash "
                    "ON users (yanport_username_hash)"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_users_yanport_email_hash "
                    "ON users (yanport_email_hash)"
                )
            )

            user_rows = connection.execute(
                text(
                    "SELECT id, yanport_username, yanport_email, yanport_username_hash, yanport_email_hash "
                    "FROM users"
                )
            ).mappings()

            for row in user_rows:
                updates = {}

                if row["yanport_username"]:
                    plain_username = decrypt_sensitive_value(row["yanport_username"])
                    expected_username_hash = build_lookup_hash(plain_username)
                    if (
                        row["yanport_username_hash"] != expected_username_hash
                        or plain_username == row["yanport_username"]
                    ):
                        updates["yanport_username"] = encrypt_sensitive_value(plain_username)
                        updates["yanport_username_hash"] = expected_username_hash

                if row["yanport_email"]:
                    plain_email = decrypt_sensitive_value(row["yanport_email"])
                    expected_email_hash = build_lookup_hash(plain_email)
                    if (
                        row["yanport_email_hash"] != expected_email_hash
                        or plain_email == row["yanport_email"]
                    ):
                        updates["yanport_email"] = encrypt_sensitive_value(plain_email)
                        updates["yanport_email_hash"] = expected_email_hash
                elif row["yanport_email_hash"] is not None:
                    updates["yanport_email_hash"] = None

                if updates:
                    updates["user_id"] = row["id"]
                    set_clauses = []
                    parameters = {"user_id": updates["user_id"]}

                    for field_name in (
                        "yanport_username",
                        "yanport_username_hash",
                        "yanport_email",
                        "yanport_email_hash",
                    ):
                        if field_name in updates:
                            set_clauses.append(f"{field_name} = :{field_name}")
                            parameters[field_name] = updates[field_name]

                    connection.execute(
                        text(
                            f"UPDATE users SET {', '.join(set_clauses)} WHERE id = :user_id"
                        ),
                        parameters,
                    )

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
