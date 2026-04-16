#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root (sudo)." >&2
  exit 1
fi

REPO_URL="${1:-}"
TARGET_DIR="${2:-/opt/immo3d}"
TARGET_BRANCH="${3:-main}"

if [[ -z "${REPO_URL}" ]]; then
  cat <<'EOF' >&2
Usage:
  sudo ./deploy/v2/bootstrap_vps.sh <repo-url> [target-dir] [branch]

Example:
  sudo ./deploy/v2/bootstrap_vps.sh git@github.com:you/immo3d.git /opt/immo3d main
EOF
  exit 1
fi

echo "[1/6] Installing base packages"
apt-get update -y
apt-get install -y ca-certificates curl git

echo "[2/6] Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "[3/6] Ensuring docker compose plugin"
docker compose version >/dev/null

echo "[4/6] Cloning or refreshing repo"
if [[ ! -d "${TARGET_DIR}/.git" ]]; then
  mkdir -p "$(dirname "${TARGET_DIR}")"
  git clone --branch "${TARGET_BRANCH}" "${REPO_URL}" "${TARGET_DIR}"
else
  git -C "${TARGET_DIR}" fetch --prune origin
  git -C "${TARGET_DIR}" checkout "${TARGET_BRANCH}"
  git -C "${TARGET_DIR}" pull --ff-only origin "${TARGET_BRANCH}"
fi

echo "[5/6] Preparing deploy files"
if [[ ! -f "${TARGET_DIR}/deploy/v2/backend.env" ]]; then
  cp "${TARGET_DIR}/deploy/v2/backend.env.example" "${TARGET_DIR}/deploy/v2/backend.env"
fi
chmod +x "${TARGET_DIR}/deploy/v2/release.sh"
chmod +x "${TARGET_DIR}/deploy/v2/bootstrap_vps.sh"

echo "[6/6] Final instructions"
cat <<EOF
Bootstrap complete.

Next steps:
1. Edit: ${TARGET_DIR}/deploy/v2/backend.env
2. First deploy:
   cd "${TARGET_DIR}"
   ./deploy/v2/release.sh deploy origin/${TARGET_BRANCH}
3. Rollback (if needed):
   ./deploy/v2/release.sh rollback
EOF
