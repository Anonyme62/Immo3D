import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.config import settings
from app.db import Base
from app.security import build_lookup_hash, decrypt_sensitive_value, encrypt_sensitive_value


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    _yanport_username_encrypted: Mapped[str] = mapped_column("yanport_username", Text, nullable=False)
    yanport_username_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    _yanport_email_encrypted: Mapped[str | None] = mapped_column("yanport_email", Text, nullable=True)
    yanport_email_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    subscription_price_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subscription_status: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    subscription_current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    subscription_cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    subscription_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    @property
    def has_active_subscription(self) -> bool:
        if not settings.billing_required:
            return True
        return (self.subscription_status or "").lower() in {"active", "trialing"}

    @property
    def has_app_access(self) -> bool:
        return self.has_active_subscription

    @property
    def billing_required(self) -> bool:
        return settings.billing_required

    @property
    def yanport_username(self) -> str:
        return decrypt_sensitive_value(self._yanport_username_encrypted)

    @yanport_username.setter
    def yanport_username(self, value: str) -> None:
        normalized_value = (value or "").strip().lower()
        self._yanport_username_encrypted = encrypt_sensitive_value(normalized_value)
        self.yanport_username_hash = build_lookup_hash(normalized_value)

    @property
    def yanport_email(self) -> str | None:
        if not self._yanport_email_encrypted:
            return None
        return decrypt_sensitive_value(self._yanport_email_encrypted)

    @yanport_email.setter
    def yanport_email(self, value: str | None) -> None:
        normalized_value = (value or "").strip().lower()
        if not normalized_value:
            self._yanport_email_encrypted = None
            self.yanport_email_hash = None
            return

        self._yanport_email_encrypted = encrypt_sensitive_value(normalized_value)
        self.yanport_email_hash = build_lookup_hash(normalized_value)


class AppSession(Base):
    __tablename__ = "app_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    csrf_token: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class YanportSession(Base):
    __tablename__ = "yanport_sessions"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_yanport_sessions_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (
        UniqueConstraint("user_id", "bien_id", name="uq_notes_user_bien"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    bien_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class BlacklistItem(Base):
    __tablename__ = "blacklist"
    __table_args__ = (
        UniqueConstraint("user_id", "bien_id", name="uq_blacklist_user_bien"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    bien_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    surface: Mapped[float | None] = mapped_column(Float, nullable=True)
    prix: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CustomMarker(Base):
    __tablename__ = "custom_markers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    search_zone: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class FavoriteBien(Base):
    __tablename__ = "favorite_biens"
    __table_args__ = (
        UniqueConstraint("user_id", "bien_id", name="uq_favorite_biens_user_bien"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bien_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class SetAsideBien(Base):
    __tablename__ = "set_aside_biens"
    __table_args__ = (
        UniqueConstraint("user_id", "bien_id", name="uq_set_aside_biens_user_bien"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bien_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class BienPlacement(Base):
    __tablename__ = "bien_placements"
    __table_args__ = (
        UniqueConstraint("user_id", "bien_id", name="uq_bien_placements_user_bien"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bien_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    manual_address: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
