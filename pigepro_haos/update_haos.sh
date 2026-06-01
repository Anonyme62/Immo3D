#!/usr/bin/env sh
set -eu

REPO_URL="${REPO_URL:-https://github.com/Anonyme62/Immo3D}"
REF="${REF:-main}"
TMP_DIR="${TMP_DIR:-/tmp/immo3d-pigepro}"
ADDON_SLUG="${ADDON_SLUG:-local_pigepro_haos}"
ADDON_DIR="${ADDON_DIR:-/addons/local/pigepro_haos}"
RETRY_MAX="${RETRY_MAX:-4}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-3}"
START_WAIT_SECONDS="${START_WAIT_SECONDS:-30}"

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
  while [ "${attempts}" -lt "${START_WAIT_SECONDS}" ]; do
    state="$(get_running_state || true)"
    if [ "${state}" = "started" ]; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  return 1
}

run_update() {
  if out="$(ha addons update "${ADDON_SLUG}" 2>&1)"; then
    log "update: OK"
    echo "${out}"
    return 0
  fi
  log "update: ECHEC"
  echo "${out}"
  if echo "${out}" | grep -qi "No update available"; then
    log "update: aucune mise a jour disponible -> rebuild requis."
    return 3
  fi
  return 1
}

run_rebuild() {
  if out="$(ha addons rebuild "${ADDON_SLUG}" 2>&1)"; then
    log "rebuild: OK"
    echo "${out}"
    return 0
  fi
  log "rebuild: ECHEC"
  echo "${out}"
  if echo "${out}" | grep -qi "Version changed, use Update instead Rebuild"; then
    log "rebuild demande update -> fallback auto."
    return 2
  fi
  return 1
}

start_and_verify() {
  if ! start_out="$(ha addons start "${ADDON_SLUG}" 2>&1)"; then
    log "start: ECHEC"
    echo "${start_out}"
    return 1
  fi
  log "start: OK"
  echo "${start_out}"
  if ! wait_until_started; then
    log "start: timeout, add-on non demarre."
    return 1
  fi
  running_state="$(get_running_state || true)"
  running_version="$(get_running_version || true)"
  if [ "${running_state}" != "started" ]; then
    log "etat runtime inattendu: ${running_state}"
    return 1
  fi
  if [ "${running_version}" != "${target_version}" ]; then
    log "version runtime ${running_version} != cible ${target_version}"
    return 1
  fi
  return 0
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
  log "Tentative deploy ${attempt}/${RETRY_MAX}"

  rebuild_rc=1
  if run_rebuild; then
    rebuild_rc=0
  else
    rebuild_rc=$?
  fi

  if [ "${rebuild_rc}" -eq 2 ]; then
    if run_update && start_and_verify; then
      log "Deploy valide via fallback update apres rebuild."
      break
    fi
  elif [ "${rebuild_rc}" -eq 0 ]; then
    if start_and_verify; then
      log "Deploy valide via rebuild."
      break
    fi
  else
    log "rebuild non exploitable sur cette tentative."
  fi

  update_rc=1
  if run_update; then
    update_rc=0
  else
    update_rc=$?
  fi

  if [ "${update_rc}" -eq 0 ]; then
    if start_and_verify; then
      log "Deploy valide via update."
      break
    fi
  elif [ "${update_rc}" -eq 3 ]; then
    log "update indisponible; on retentera rebuild apres reload."
    ha supervisor reload
    ha addons reload
  else
    log "update non exploitable sur cette tentative."
  fi

  if [ "${attempt}" -ge "${RETRY_MAX}" ]; then
    log "ERREUR: add-on non demarre apres update/rebuild."
    ha addons logs "${ADDON_SLUG}" --lines 120 || true
    ha supervisor logs --lines 120 || true
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep "${RETRY_DELAY_SECONDS}"
done

log "Etat final:"
ha addons info "${ADDON_SLUG}" | grep -E 'slug|state|version|version_latest'
log "Version verifiee: ${target_version}"

log "OK"
