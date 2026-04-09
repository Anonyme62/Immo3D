from pathlib import Path


def _coerce_bool(value, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _coerce_int(value, default: int) -> int:
    if value in (None, ""):
        return default
    return int(value)


def _set_if_present(env: dict[str, str], key: str, value) -> None:
    if value is None:
        return

    normalized = str(value).strip()
    if normalized:
        env[key] = normalized


def build_haos_env(options: dict) -> dict[str, str]:
    public_hostname = str(options["public_hostname"]).strip().lower()
    allowed_hosts = str(options.get("allowed_hosts", public_hostname)).strip()

    env = {
        "APP_ENV": "production",
        "APP_SECRET_KEY": str(options["app_secret_key"]).strip(),
        "DATABASE_URL": "sqlite:////data/immo3d.db",
        "FRONTEND_ORIGIN": f"https://{public_hostname}",
        "FRONTEND_ORIGINS": f"https://{public_hostname}",
        "SESSION_COOKIE_NAME": "immo3d_session",
        "SESSION_MAX_AGE_SECONDS": str(_coerce_int(options.get("session_max_age_seconds"), 604800)),
        "COOKIE_SECURE": "true",
        "COOKIE_SAMESITE": "lax",
        "CSRF_HEADER_NAME": "X-CSRF-Token",
        "ALLOWED_HOSTS": allowed_hosts,
        "BILLING_REQUIRED": "true" if _coerce_bool(options.get("billing_required")) else "false",
        "DATA_ENCRYPTION_KEY": str(options["data_encryption_key"]).strip(),
        "BACKUP_DIR": "/data/backups",
        "BACKUP_RETENTION_COUNT": str(_coerce_int(options.get("backup_retention_count"), 14)),
        "BACKUP_INTERVAL_MINUTES": str(_coerce_int(options.get("backup_interval_minutes"), 0)),
        "BACKUP_VERIFY_AFTER_CREATE": (
            "true" if _coerce_bool(options.get("backup_verify_after_create"), True) else "false"
        ),
        "BACKUP_ENCRYPTION_KEY": str(options["backup_encryption_key"]).strip(),
    }

    _set_if_present(env, "STRIPE_SECRET_KEY", options.get("stripe_secret_key"))
    _set_if_present(env, "STRIPE_PRICE_ID", options.get("stripe_price_id"))
    _set_if_present(env, "STRIPE_WEBHOOK_SECRET", options.get("stripe_webhook_secret"))
    _set_if_present(env, "STRIPE_API_VERSION", options.get("stripe_api_version"))

    return env


def write_env_file(path: Path, env: dict[str, str]) -> None:
    path.write_text(
        "".join(f"{key}={value}\n" for key, value in env.items()),
        encoding="utf-8",
    )
