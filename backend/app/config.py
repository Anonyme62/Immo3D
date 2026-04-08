from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
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

    @field_validator("app_secret_key")
    @classmethod
    def validate_app_secret_key(cls, value: str) -> str:
        secret = value.strip()
        if len(secret) < 32:
            raise ValueError("APP_SECRET_KEY doit contenir au moins 32 caracteres.")
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
        return r"^https?://((localhost|127\.0\.0\.1)|(10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}))(:\d+)?$"

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.app_env.lower() == "production" and not self.cookie_secure:
            raise ValueError("COOKIE_SECURE doit etre active en production.")
        return self


settings = Settings()
