#!/usr/bin/env bash
# Build a detached release before changing the live symlink. This script is
# intentionally server-only: it reads deployment values from /etc/resend.
set -Eeuo pipefail
IFS=$'\n\t'

DEPLOY_ROOT="${DEPLOY_ROOT:-/var/www/Resend}"
DEPLOY_CONFIG="${DEPLOY_CONFIG:-/etc/resend/deploy.env}"
LOCK_FILE="${DEPLOY_ROOT}/deploy.lock"

log() { printf '[deploy] %s\n' "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }
require_single_line_value() {
  local variable_name="$1"
  local value="${!variable_name:-}"
  [[ -n "$value" ]] || die "required deployment setting is missing: ${variable_name}"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || die "deployment setting must be a single line: ${variable_name}"
}
validate_port() {
  local variable_name="$1"
  local value="${!variable_name}"
  [[ "$value" =~ ^[0-9]{1,5}$ ]] && (( 10#$value >= 1 && 10#$value <= 65535 )) || die "${variable_name} must be a TCP port between 1 and 65535"
}
validate_absolute_path() {
  local variable_name="$1"
  [[ "${!variable_name}" == /* ]] || die "${variable_name} must be an absolute path"
}

[[ -r "$DEPLOY_CONFIG" ]] || die "server deployment config is missing: $DEPLOY_CONFIG"
# shellcheck disable=SC1090
source "$DEPLOY_CONFIG"

# The existing production checkout is the Git source. `current` is created only
# after the one-time release migration; do not use it to launch this script.
: "${RESEND_REPOSITORY_DIR:=${DEPLOY_ROOT}}"
: "${RESEND_RELEASES_DIR:=${DEPLOY_ROOT}/.releases}"
: "${RESEND_CURRENT_DIR:=${DEPLOY_ROOT}/current}"
: "${RESEND_SHARED_DIR:=${DEPLOY_ROOT}/.deploy-shared}"
: "${RESEND_FRONTEND_ENV_FILE:=${RESEND_SHARED_DIR}/frontend.env}"
: "${RESEND_BACKEND_ENV_FILE:=${RESEND_SHARED_DIR}/backend.env}"
: "${RESEND_SESSIONS_DIR:=${RESEND_SHARED_DIR}/sessions}"
: "${RESEND_FRONTEND_PORT:=3000}"
: "${RESEND_BACKEND_PORT:=3010}"
require_single_line_value RESEND_FRONTEND_PM2_NAME
require_single_line_value RESEND_BACKEND_PM2_NAME
validate_port RESEND_FRONTEND_PORT
validate_port RESEND_BACKEND_PORT
for path_variable in RESEND_REPOSITORY_DIR RESEND_RELEASES_DIR RESEND_CURRENT_DIR RESEND_SHARED_DIR RESEND_FRONTEND_ENV_FILE RESEND_BACKEND_ENV_FILE RESEND_SESSIONS_DIR; do
  validate_absolute_path "$path_variable"
done

for command in git npm pm2 curl flock; do command -v "$command" >/dev/null || die "required command not found: $command"; done
[[ -d "$DEPLOY_ROOT" ]] || die "unexpected deployment root: $DEPLOY_ROOT"
[[ -d "$RESEND_REPOSITORY_DIR/.git" ]] || die "repository is not initialized: $RESEND_REPOSITORY_DIR"
[[ -f "$RESEND_REPOSITORY_DIR/frontend/package-lock.json" ]] || die "frontend lockfile is missing"
[[ -f "$RESEND_REPOSITORY_DIR/backend/package-lock.json" ]] || die "backend lockfile is missing"
[[ -f "$RESEND_FRONTEND_ENV_FILE" ]] || die "frontend production environment file is missing"
[[ -f "$RESEND_BACKEND_ENV_FILE" ]] || die "backend production environment file is missing"
[[ -d "$RESEND_SESSIONS_DIR" ]] || die "persistent sessions directory is missing"
[[ ! -e "$RESEND_CURRENT_DIR" || -L "$RESEND_CURRENT_DIR" ]] || die "current exists but is not a symbolic link"

exec 9>"$LOCK_FILE"
flock -n 9 || { log "another deployment is already running"; exit 75; }

git -C "$RESEND_REPOSITORY_DIR" diff --quiet || die "repository has tracked local changes; refusing to overwrite them"
git -C "$RESEND_REPOSITORY_DIR" diff --cached --quiet || die "repository has staged local changes; refusing to overwrite them"
git -C "$RESEND_REPOSITORY_DIR" fetch --prune origin main

TARGET_SHA="${DEPLOY_SHA:-$(git -C "$RESEND_REPOSITORY_DIR" rev-parse origin/main)}"
git -C "$RESEND_REPOSITORY_DIR" rev-parse --verify --quiet "${TARGET_SHA}^{commit}" >/dev/null || die "invalid target commit"
git -C "$RESEND_REPOSITORY_DIR" merge-base --is-ancestor "$TARGET_SHA" origin/main || die "target commit is not on origin/main"

CURRENT_RELEASE=""
CURRENT_SHA=""
if [[ -L "$RESEND_CURRENT_DIR" ]]; then
  CURRENT_RELEASE="$(readlink -f "$RESEND_CURRENT_DIR")"
  [[ "$CURRENT_RELEASE" == "$RESEND_RELEASES_DIR"/* ]] || die "current link points outside the releases directory"
  CURRENT_SHA="$(git -C "$CURRENT_RELEASE" rev-parse HEAD)"
fi

NEW_RELEASE="${RESEND_RELEASES_DIR}/${TARGET_SHA}"
mkdir -p "$RESEND_RELEASES_DIR"
if [[ ! -d "$NEW_RELEASE" ]]; then
  log "preparing release ${TARGET_SHA}"
  git -C "$RESEND_REPOSITORY_DIR" worktree add --detach "$NEW_RELEASE" "$TARGET_SHA"
fi

[[ "$(git -C "$NEW_RELEASE" rev-parse HEAD)" == "$TARGET_SHA" ]] || die "release SHA verification failed"
ln -sfn "$RESEND_FRONTEND_ENV_FILE" "$NEW_RELEASE/frontend/.env.production.local"
ln -sfn "$RESEND_BACKEND_ENV_FILE" "$NEW_RELEASE/backend/.env"
ln -sfn "$RESEND_SESSIONS_DIR" "$NEW_RELEASE/backend/sessions"

FRONTEND_CHANGED=1
BACKEND_CHANGED=1
FRONTEND_DEPS_CHANGED=1
BACKEND_DEPS_CHANGED=1
if [[ -n "$CURRENT_RELEASE" ]]; then
  CHANGED_FILES="$(git -C "$RESEND_REPOSITORY_DIR" diff --name-only "$CURRENT_SHA" "$TARGET_SHA")"
  FRONTEND_CHANGED=0; BACKEND_CHANGED=0
  grep -qE '^(frontend/|ecosystem\.production\.config\.cjs$)' <<<"$CHANGED_FILES" && FRONTEND_CHANGED=1 || true
  grep -qE '^(backend/|ecosystem\.production\.config\.cjs$)' <<<"$CHANGED_FILES" && BACKEND_CHANGED=1 || true
  FRONTEND_DEPS_CHANGED=0; BACKEND_DEPS_CHANGED=0
  grep -qE '^frontend/(package\.json|package-lock\.json)$' <<<"$CHANGED_FILES" && FRONTEND_DEPS_CHANGED=1 || true
  grep -qE '^backend/(package\.json|package-lock\.json)$' <<<"$CHANGED_FILES" && BACKEND_DEPS_CHANGED=1 || true
fi

log "deployment scope: frontend=${FRONTEND_CHANGED} backend=${BACKEND_CHANGED} frontend-deps=${FRONTEND_DEPS_CHANGED} backend-deps=${BACKEND_DEPS_CHANGED}"
if (( FRONTEND_CHANGED )); then
  if (( FRONTEND_DEPS_CHANGED )); then
    log "installing frontend dependencies from package-lock.json"
    ( cd "$NEW_RELEASE/frontend" && npm ci )
  else
    [[ -d "$CURRENT_RELEASE/frontend/node_modules" ]] || die "previous frontend dependencies are unavailable"
    ln -sfn "$CURRENT_RELEASE/frontend/node_modules" "$NEW_RELEASE/frontend/node_modules"
    log "reusing frontend dependencies; package lock is unchanged"
  fi
  log "building frontend with server-only production environment"
  ( cd "$NEW_RELEASE/frontend" && npm run build )
elif [[ -n "$CURRENT_RELEASE" ]]; then
  [[ -d "$CURRENT_RELEASE/frontend/node_modules" && -d "$CURRENT_RELEASE/frontend/.next" ]] || die "previous frontend runtime is unavailable"
  ln -sfn "$CURRENT_RELEASE/frontend/node_modules" "$NEW_RELEASE/frontend/node_modules"
  ln -sfn "$CURRENT_RELEASE/frontend/.next" "$NEW_RELEASE/frontend/.next"
  log "preserving existing frontend runtime; no frontend files changed"
fi
if (( BACKEND_CHANGED )); then
  if (( BACKEND_DEPS_CHANGED )); then
    log "installing backend production dependencies from package-lock.json"
    ( cd "$NEW_RELEASE/backend" && npm ci --omit=dev )
  else
    [[ -d "$CURRENT_RELEASE/backend/node_modules" ]] || die "previous backend dependencies are unavailable"
    ln -sfn "$CURRENT_RELEASE/backend/node_modules" "$NEW_RELEASE/backend/node_modules"
    log "reusing backend dependencies; package lock is unchanged"
  fi
elif [[ -n "$CURRENT_RELEASE" ]]; then
  [[ -d "$CURRENT_RELEASE/backend/node_modules" ]] || die "previous backend dependencies are unavailable"
  ln -sfn "$CURRENT_RELEASE/backend/node_modules" "$NEW_RELEASE/backend/node_modules"
  log "preserving existing backend runtime; no backend files changed"
fi

ROLLED_BACK=0
rollback() {
  local status=$?
  if (( ROLLED_BACK == 0 )) && [[ -n "$CURRENT_RELEASE" ]]; then
    ROLLED_BACK=1
    log "deployment failed; restoring previous release"
    ln -sfn "$CURRENT_RELEASE" "$RESEND_CURRENT_DIR"
    export RESEND_CURRENT_DIR RESEND_FRONTEND_PM2_NAME RESEND_BACKEND_PM2_NAME RESEND_FRONTEND_PORT RESEND_BACKEND_PORT
    if (( FRONTEND_CHANGED )); then pm2 startOrReload "$CURRENT_RELEASE/ecosystem.production.config.cjs" --only "$RESEND_FRONTEND_PM2_NAME" --update-env || true; fi
    if (( BACKEND_CHANGED )); then pm2 startOrReload "$CURRENT_RELEASE/ecosystem.production.config.cjs" --only "$RESEND_BACKEND_PM2_NAME" --update-env || true; fi
  fi
  exit "$status"
}
trap rollback ERR

log "switching to ${TARGET_SHA}"
ln -sfn "$NEW_RELEASE" "$RESEND_CURRENT_DIR"
export RESEND_CURRENT_DIR RESEND_FRONTEND_PM2_NAME RESEND_BACKEND_PM2_NAME RESEND_FRONTEND_PORT RESEND_BACKEND_PORT

if (( FRONTEND_CHANGED )); then
  pm2 startOrReload "$NEW_RELEASE/ecosystem.production.config.cjs" --only "$RESEND_FRONTEND_PM2_NAME" --update-env
fi
if (( BACKEND_CHANGED )); then
  pm2 startOrReload "$NEW_RELEASE/ecosystem.production.config.cjs" --only "$RESEND_BACKEND_PM2_NAME" --update-env
fi

if (( FRONTEND_CHANGED )); then
  curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:${RESEND_FRONTEND_PORT}/" >/dev/null
fi
if (( BACKEND_CHANGED )); then
  curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:${RESEND_BACKEND_PORT}/v1/health" >/dev/null
fi

trap - ERR
log "SUCCESS: deployed ${TARGET_SHA} (frontend=${FRONTEND_CHANGED}, backend=${BACKEND_CHANGED})"
