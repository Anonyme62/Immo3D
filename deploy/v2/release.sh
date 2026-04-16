#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
ENV_FILE="${SCRIPT_DIR}/backend.env"
STATE_DIR="${SCRIPT_DIR}/.state"
mkdir -p "${STATE_DIR}"

CURRENT_SHA_FILE="${STATE_DIR}/current_sha"
PREVIOUS_SHA_FILE="${STATE_DIR}/previous_sha"
RELEASE_HISTORY_FILE="${STATE_DIR}/release_history.log"

usage() {
  cat <<'EOF'
Usage:
  ./deploy/v2/release.sh deploy [git-ref]
  ./deploy/v2/release.sh rollback [git-ref-or-sha]
  ./deploy/v2/release.sh status

Examples:
  ./deploy/v2/release.sh deploy origin/main
  ./deploy/v2/release.sh deploy 9f2fabc
  ./deploy/v2/release.sh rollback
  ./deploy/v2/release.sh rollback 5d4c3b2
EOF
}

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing required command: ${cmd}" >&2
    exit 1
  fi
}

assert_prereqs() {
  require_cmd git
  require_cmd docker
  require_cmd curl
  docker compose version >/dev/null

  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Missing ${ENV_FILE}. Copy backend.env.example first." >&2
    exit 1
  fi
}

resolve_full_sha() {
  local ref="$1"
  git -C "${PROJECT_ROOT}" rev-parse --verify "${ref}^{commit}"
}

refresh_remote_refs() {
  git -C "${PROJECT_ROOT}" fetch --prune --tags origin
}

checkout_ref() {
  local ref="$1"
  git -C "${PROJECT_ROOT}" checkout --detach "${ref}"
}

healthcheck_url() {
  local value
  value="$(
    awk -F= '$1=="API_HEALTHCHECK_URL"{print substr($0, index($0, "=")+1)}' "${ENV_FILE}" \
      | head -n1 \
      | tr -d '\r'
  )"
  if [[ -n "${value}" ]]; then
    echo "${value}"
  else
    echo "http://127.0.0.1/health"
  fi
}

wait_for_health() {
  local url="$1"
  local attempts=45
  local delay_seconds=2

  for ((index=1; index<=attempts; index+=1)); do
    if curl --fail --silent --show-error "${url}" >/dev/null; then
      echo "Healthcheck passed: ${url}"
      return 0
    fi
    sleep "${delay_seconds}"
  done

  echo "Healthcheck failed after $((attempts * delay_seconds)) seconds: ${url}" >&2
  exit 1
}

record_release_state() {
  local full_sha="$1"
  local short_sha="$2"
  local utc_now
  utc_now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  if [[ -f "${CURRENT_SHA_FILE}" ]]; then
    local previous_sha
    previous_sha="$(cat "${CURRENT_SHA_FILE}")"
    if [[ -n "${previous_sha}" && "${previous_sha}" != "${full_sha}" ]]; then
      echo "${previous_sha}" > "${PREVIOUS_SHA_FILE}"
    fi
  fi

  echo "${full_sha}" > "${CURRENT_SHA_FILE}"
  echo "${utc_now} ${short_sha} ${full_sha}" >> "${RELEASE_HISTORY_FILE}"
}

deploy_ref() {
  local ref="$1"
  refresh_remote_refs
  local full_sha
  full_sha="$(resolve_full_sha "${ref}")"
  checkout_ref "${full_sha}"

  local short_sha
  short_sha="$(git -C "${PROJECT_ROOT}" rev-parse --short=12 HEAD)"

  export BUILD_VERSION
  BUILD_VERSION="$(date -u +"%Y%m%d%H%M%S")"
  export BUILD_REF="${short_sha}"
  export BUILD_TIME
  BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  export IMAGE_TAG="${short_sha}"

  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" build --pull api
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --remove-orphans

  local url
  url="$(healthcheck_url)"
  wait_for_health "${url}"

  record_release_state "${full_sha}" "${short_sha}"
  echo "Deploy OK -> ${short_sha}"
}

rollback_ref() {
  local ref="${1:-}"

  if [[ -z "${ref}" ]]; then
    if [[ ! -f "${PREVIOUS_SHA_FILE}" ]]; then
      echo "No previous SHA found. Specify a SHA manually." >&2
      exit 1
    fi
    ref="$(cat "${PREVIOUS_SHA_FILE}")"
  fi

  echo "Rolling back to: ${ref}"
  deploy_ref "${ref}"
}

status() {
  local current="none"
  local previous="none"

  if [[ -f "${CURRENT_SHA_FILE}" ]]; then
    current="$(cat "${CURRENT_SHA_FILE}")"
  fi
  if [[ -f "${PREVIOUS_SHA_FILE}" ]]; then
    previous="$(cat "${PREVIOUS_SHA_FILE}")"
  fi

  echo "Current SHA:  ${current}"
  echo "Previous SHA: ${previous}"
  echo "Recent releases:"
  if [[ -f "${RELEASE_HISTORY_FILE}" ]]; then
    tail -n 10 "${RELEASE_HISTORY_FILE}"
  else
    echo "(none)"
  fi
}

main() {
  assert_prereqs
  local action="${1:-}"
  local ref="${2:-origin/main}"

  case "${action}" in
    deploy)
      deploy_ref "${ref}"
      ;;
    rollback)
      rollback_ref "${2:-}"
      ;;
    status)
      status
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
