import os

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.environ.get("APP_SETTINGS_FILE", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    app_secret_key: str
    database_url: str
    frontend_origin: str = "http://localhost:5173"
    frontend_origins: str | None = None
    session_cookie_name: str = "immo3d_session"
    session_max_age_seconds: int = 60 * 60 * 24 * 7
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    csrf_header_name: str = "X-CSRF-Token"
    allowed_hosts: str | None = None
    billing_required: bool = False
    data_encryption_key: str | None = None
    stripe_secret_key: str | None = None
    stripe_price_id: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_api_version: str | None = None
    backup_dir: str = "backups"
    backup_retention_count: int = 14
    backup_encryption_key: str | None = None

    @field_validator("app_secret_key")
    @classmethod
    def validate_app_secret_key(cls, value: str) -> str:
        secret = value.strip()
        if len(secret) < 32:
            raise ValueError("APP_SECRET_KEY doit contenir au moins 32 caracteres.")
        return secret

    @field_validator("data_encryption_key")
    @classmethod
    def validate_data_encryption_key(cls, value: str | None) -> str | None:
        if value is None:
            return None

        secret = value.strip()
        if len(secret) < 32:
            raise ValueError("DATA_ENCRYPTION_KEY doit contenir au moins 32 caracteres.")
        return secret

    @field_validator("backup_encryption_key")
    @classmethod
    def validate_backup_encryption_key(cls, value: str | None) -> str | None:
        if value is None:
            return None

        secret = value.strip()
        if len(secret) < 32:
            raise ValueError("BACKUP_ENCRYPTION_KEY doit contenir au moins 32 caracteres.")
        return secret

    @field_validator("frontend_origin")
    @classmethod
    def normalize_frontend_origin(cls, value: str) -> str:
        origin = value.strip().rstrip("/")
        if not origin:
            raise ValueError("FRONTEND_ORIGIN est obligatoire.")
        return origin

    @field_validator("frontend_origins")
    @classmethod
    def normalize_frontend_origins(cls, value: str | None) -> str | None:
        if value is None:
            return None

        origins = [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return ",".join(origins) if origins else None

    @property
    def cors_allowed_origins(self) -> list[str]:
        if self.frontend_origins:
            return [origin for origin in self.frontend_origins.split(",") if origin]

        default_origins = {
            self.frontend_origin,
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        }
        return sorted(default_origins)

    @property
    def cors_allowed_origin_regex(self) -> str:
        if self.app_env.lower() == "production":
            return ""
        return r"^https?://((localhost|127\.0\.0\.1)|(10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}))(:\d+)?$"

    @field_validator("allowed_hosts")
    @classmethod
    def normalize_allowed_hosts(cls, value: str | None) -> str | None:
        if value is None:
            return None

        hosts = [host.strip().lower() for host in value.split(",") if host.strip()]
        return ",".join(hosts) if hosts else None

    @property
    def allowed_hosts_list(self) -> list[str]:
        if self.allowed_hosts:
            configured_hosts = [host for host in self.allowed_hosts.split(",") if host]
            if self.app_env.lower() != "production":
                return sorted({*configured_hosts, "127.0.0.1", "localhost", "testserver"})
            return configured_hosts

        if self.app_env.lower() != "production":
            return ["*"]

        return []

    @property
    def stripe_configured(self) -> bool:
        return bool(self.stripe_secret_key and self.stripe_price_id and self.stripe_webhook_secret)

    @property
    def effective_data_encryption_key(self) -> str:
        return self.data_encryption_key or self.app_secret_key

    @property
    def backup_encryption_configured(self) -> bool:
        return bool(self.backup_encryption_key)

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.app_env.lower() == "production" and not self.cookie_secure:
            raise ValueError("COOKIE_SECURE doit etre active en production.")
        if self.app_env.lower() == "production" and not self.allowed_hosts:
            raise ValueError("ALLOWED_HOSTS doit etre configure en production.")
        if self.app_env.lower() == "production" and not self.data_encryption_key:
            raise ValueError("DATA_ENCRYPTION_KEY doit etre configuree en production.")
        if self.billing_required and (
            not self.stripe_secret_key or not self.stripe_price_id or not self.stripe_webhook_secret
        ):
            raise ValueError(
                "STRIPE_SECRET_KEY, STRIPE_PRICE_ID et STRIPE_WEBHOOK_SECRET sont obligatoires "
                "quand BILLING_REQUIRED=true."
            )
        return self

    @field_validator("cookie_samesite")
    @classmethod
    def validate_cookie_samesite(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"lax", "strict", "none"}:
            raise ValueError("COOKIE_SAMESITE doit etre lax, strict ou none.")
        return normalized


settings = Settings()
