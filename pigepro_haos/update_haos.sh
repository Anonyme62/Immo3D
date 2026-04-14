#!/usr/bin/env sh
set -eu

REPO_URL="${REPO_URL:-https://github.com/Anonyme62/Immo3D}"
REF="${REF:-main}"
TMP_DIR="${TMP_DIR:-/tmp/immo3d-pigepro}"
ADDON_SLUG="${ADDON_SLUG:-local_pigepro_haos}"
ADDON_DIR="${ADDON_DIR:-/addons/local/pigepro_haos}"
RETRY_MAX="${RETRY_MAX:-4}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-3}"

log() {
  echo "[update_haos] $*"
}

get_target_version() {
  awk -F'"' '/^version:/{if($2!=""){print $2; exit}}' "${ADDON_DIR}/config.yaml"
}

get_running_state() {
  ha addons info "${ADDON_SLUG}" | awk -F': ' '/^state:/{print $2; exit}'
}

get_running_version() {
  ha addons info "${ADDON_SLUG}" | awk -F': ' '/^version:/{print $2; exit}'
}

wait_until_started() {
  attempts=0
  while [ "${attempts}" -lt 20 ]; do
    state="$(get_running_state || true)"
    if [ "${state}" = "started" ]; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  return 1
}

log "Repo: ${REPO_URL}"
log "Ref: ${REF}"
log "Add-on dir: ${ADDON_DIR}"

# Critical: always leave /tmp before deleting TMP_DIR to avoid 'current working directory' failures.
cd /

ha addons stop "${ADDON_SLUG}" >/dev/null 2>&1 || true

attempt=1
while [ "${attempt}" -le "${RETRY_MAX}" ]; do
  log "Clone/checkout tentative ${attempt}/${RETRY_MAX}"
  rm -rf "${TMP_DIR}"
  if git clone "${REPO_URL}" "${TMP_DIR}"; then
    cd "${TMP_DIR}"
    if git checkout "${REF}"; then
      break
    fi
  fi
  if [ "${attempt}" -ge "${RETRY_MAX}" ]; then
    log "ERREUR: impossible de recuperer ${REF} depuis ${REPO_URL}."
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep "${RETRY_DELAY_SECONDS}"
done

test -f "${TMP_DIR}/pigepro_haos/config.yaml"
test -f "${TMP_DIR}/backend/requirements.txt"
test -f "${TMP_DIR}/immo-app/package.json"

cd /
rm -rf "${ADDON_DIR}"
mkdir -p "${ADDON_DIR}/backend" "${ADDON_DIR}/immo-app"
cp -a "${TMP_DIR}/pigepro_haos/." "${ADDON_DIR}/"
cp -a "${TMP_DIR}/backend/." "${ADDON_DIR}/backend/"
cp -a "${TMP_DIR}/immo-app/." "${ADDON_DIR}/immo-app/"

test -f "${ADDON_DIR}/backend/requirements.txt"
test -f "${ADDON_DIR}/immo-app/package.json"
target_version="$(get_target_version)"
if [ -z "${target_version}" ]; then
  log "ERREUR: version introuvable dans ${ADDON_DIR}/config.yaml"
  exit 1
fi
log "Version cible: ${target_version}"

ha supervisor reload
ha addons reload

attempt=1
while [ "${attempt}" -le "${RETRY_MAX}" ]; do
  log "Rebuild/start tentative ${attempt}/${RETRY_MAX}"
  if ha addons rebuild "${ADDON_SLUG}" && ha addons start "${ADDON_SLUG}"; then
    if wait_until_started; then
      break
    fi
  fi
  if [ "${attempt}" -ge "${RETRY_MAX}" ]; then
    log "ERREUR: add-on non demarre apres rebuild."
    ha addons logs "${ADDON_SLUG}" --lines 120 || true
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep "${RETRY_DELAY_SECONDS}"
done

running_version="$(get_running_version || true)"
running_state="$(get_running_state || true)"
log "Etat final:"
ha addons info "${ADDON_SLUG}" | grep -E 'slug|state|version|version_latest'

if [ "${running_state}" != "started" ]; then
  log "ERREUR: etat final inattendu (${running_state})."
  exit 1
fi

if [ "${running_version}" != "${target_version}" ]; then
  log "ATTENTION: version runtime (${running_version}) differente de la cible (${target_version})."
  log "Si besoin, relancer: ha addons rebuild ${ADDON_SLUG} && ha addons restart ${ADDON_SLUG}"
else
  log "Version verifiee: ${running_version}"
fi

log "OK"
