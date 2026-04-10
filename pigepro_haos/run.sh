#!/bin/sh
set -eu

export APP_SETTINGS_FILE="/app/backend/.env.haos"

mkdir -p /data/backups
cd /app/backend

python3 - <<'PY'
import json
import os
from pathlib import Path

from app.haos_runtime import build_haos_env, write_env_file

options = json.loads(Path("/data/options.json").read_text(encoding="utf-8"))
write_env_file(Path(os.environ["APP_SETTINGS_FILE"]), build_haos_env(options))
runtime_config_path = Path("/app/backend/frontend_dist/runtime-config.js")
runtime_config = {
    "cesiumIonToken": str(options.get("cesium_ion_token", "")).strip(),
}
runtime_config_path.write_text(
    "window.__IMMO3D_RUNTIME_CONFIG__ = "
    + json.dumps(runtime_config, ensure_ascii=False)
    + ";\n",
    encoding="utf-8",
)
PY

scheduler_pid=""
app_pid=""

cleanup() {
  if [ -n "${scheduler_pid:-}" ]; then
    kill "${scheduler_pid}" 2>/dev/null || true
    wait "${scheduler_pid}" 2>/dev/null || true
  fi

  if [ -n "${app_pid:-}" ]; then
    kill "${app_pid}" 2>/dev/null || true
    wait "${app_pid}" 2>/dev/null || true
  fi
}

trap cleanup INT TERM

python -m app.backup_scheduler &
scheduler_pid=$!

python -m uvicorn app.main:app --host 0.0.0.0 --port 10000 &
app_pid=$!

wait "${app_pid}"
app_status=$?
cleanup
exit "${app_status}"
