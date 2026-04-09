#!/bin/sh
set -eu

export APP_SETTINGS_FILE="/app/backend/.env.haos"

mkdir -p /data/backups

python3 - <<'PY'
import json
import os
from pathlib import Path

options = json.loads(Path("/data/options.json").read_text(encoding="utf-8"))

public_hostname = options["public_hostname"].strip().lower()
allowed_hosts = options.get("allowed_hosts", public_hostname).strip()

env = {
    "APP_ENV": "production",
    "APP_SECRET_KEY": options["app_secret_key"].strip(),
    "DATABASE_URL": "sqlite:////data/immo3d.db",
    "FRONTEND_ORIGIN": f"https://{public_hostname}",
    "FRONTEND_ORIGINS": f"https://{public_hostname}",
    "SESSION_COOKIE_NAME": "immo3d_session",
    "SESSION_MAX_AGE_SECONDS": str(options.get("session_max_age_seconds", 604800)),
    "COOKIE_SECURE": "true",
    "COOKIE_SAMESITE": "lax",
    "CSRF_HEADER_NAME": "X-CSRF-Token",
    "ALLOWED_HOSTS": allowed_hosts,
    "BILLING_REQUIRED": "false",
    "DATA_ENCRYPTION_KEY": options["data_encryption_key"].strip(),
    "BACKUP_DIR": "/data/backups",
    "BACKUP_RETENTION_COUNT": "14",
    "BACKUP_ENCRYPTION_KEY": options["backup_encryption_key"].strip(),
}

env_path = Path(os.environ["APP_SETTINGS_FILE"])
env_path.write_text(
    "".join(f"{key}={value}\n" for key, value in env.items()),
    encoding="utf-8",
)
PY

cd /app/backend
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 10000
