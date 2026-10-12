#!/usr/bin/env bash
# Deploy a verified main commit in the existing production checkout. Persistent
# files are ignored by Git and are never removed or copied by this script.
set -Eeuo pipefail
IFS=$'\n\t'

DEPLOY_ROOT="${DEPLOY_ROOT:-/var/www/Resend}"
LOCK_FILE="${DEPLOY_ROOT}/deploy.lock"

log() { printf '[deploy] %s\n' "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

resolve_pm2_process() {
  local application="$1"
  node - "$application" "$DEPLOY_ROOT" <<'NODE'
const { execFileSync } = require("child_process");
const path = require("path");
const [application, root] = process.argv.slice(2);
const expectedCwd = path.resolve(root, application);
const processes = JSON.parse(execFileSync("pm2", ["jlist"], { encoding: "utf8" }));
const matches = processes.filter((process) => path.resolve(process.pm2_env?.pm_cwd || "") === expectedCwd);
if (matches.length !== 1) {
  const discovered = processes.map((process) => `${process.name || "<unnamed>"} (${process.pm2_env?.pm_cwd || "no cwd"})`).join(", ");
  throw new Error(`expected exactly one PM2 process with cwd ${expectedCwd}; found ${matches.length}. Discovered: ${discovered}`);
}
const pm2Process = matches[0];
const env = pm2Process.pm2_env?.env || {};
const port = application === "frontend" ? (env.PORT || 3000) : (env.BACKEND_PORT || env.PORT || 3001);
if (!/^\d{1,5}$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error(`invalid ${application} port in PM2 environment: ${port}`);
}
global.process.stdout.write(`${pm2Process.name}\t${port}`);
NODE
}

verify_pm2_process_online() {
  local application="$1"
  local process_name="$2"
  node - "$application" "$process_name" <<'NODE'
const { execFileSync } = require("child_process");
const [application, name] = process.argv.slice(2);
const processes = JSON.parse(execFileSync("pm2", ["jlist"], { encoding: "utf8" }));
const match = processes.find((p) => p.name === name);
if (!match) throw new Error(`expected PM2 process ${name} not found`);
const status = match.pm2_env?.status;
if (status !== "online") {
  throw new Error(`PM2 process ${name} (${application}) is not online; status="${status}"`);
}
NODE
}

for command in git npm node pm2 curl flock; do command -v "$command" >/dev/null || die "required command not found: $command"; done
[[ "$DEPLOY_ROOT" == /var/www/Resend ]] || die "unexpected deployment root: $DEPLOY_ROOT"
[[ -d "$DEPLOY_ROOT/.git" ]] || die "production repository is not initialized: $DEPLOY_ROOT"
[[ -f "$DEPLOY_ROOT/frontend/package-lock.json" ]] || die "frontend lockfile is missing"
[[ -f "$DEPLOY_ROOT/backend/package-lock.json" ]] || die "backend lockfile is missing"

exec 9>"$LOCK_FILE"
flock -n 9 || { log "another deployment is already running"; exit 75; }

# Refuse tracked local edits. Ignored production-only files such as backend/.env
# and backend/sessions are deliberately not touched by fetch, merge, or npm.
git -C "$DEPLOY_ROOT" diff --quiet || die "repository has tracked local changes; refusing to update"
git -C "$DEPLOY_ROOT" diff --cached --quiet || die "repository has staged local changes; refusing to update"
[[ "$(git -C "$DEPLOY_ROOT" branch --show-current)" == "main" ]] || die "production checkout must be on branch main"

git -C "$DEPLOY_ROOT" fetch --prune origin main
TARGET_SHA="${DEPLOY_SHA:-$(git -C "$DEPLOY_ROOT" rev-parse origin/main)}"
git -C "$DEPLOY_ROOT" rev-parse --verify --quiet "${TARGET_SHA}^{commit}" >/dev/null || die "invalid target commit"
git -C "$DEPLOY_ROOT" merge-base --is-ancestor "$TARGET_SHA" origin/main || die "target commit is not on origin/main"

PREVIOUS_SHA="$(git -C "$DEPLOY_ROOT" rev-parse HEAD)"
git -C "$DEPLOY_ROOT" merge-base --is-ancestor "$PREVIOUS_SHA" "$TARGET_SHA" || die "target is not a fast-forward update from the deployed commit"

FRONTEND_CHANGED=0
BACKEND_CHANGED=0
if [[ "$PREVIOUS_SHA" == "$TARGET_SHA" ]]; then
  # A prior attempt can have fast-forwarded Git but failed before PM2 reload.
  # Retry both applications so a rerun completes that interrupted deployment.
  log "target commit is already checked out; resuming application deployment"
  FRONTEND_CHANGED=1
  BACKEND_CHANGED=1
  CHANGED_FILES=""
else
  CHANGED_FILES="$(git -C "$DEPLOY_ROOT" diff --name-only "$PREVIOUS_SHA" "$TARGET_SHA")"
  grep -qE '^(frontend/|scripts/deploy-production\.sh$|\.github/workflows/deploy-production\.yml$)' <<<"$CHANGED_FILES" && FRONTEND_CHANGED=1 || true
  grep -qE '^(backend/|scripts/deploy-production\.sh$|\.github/workflows/deploy-production\.yml$)' <<<"$CHANGED_FILES" && BACKEND_CHANGED=1 || true
fi

if (( FRONTEND_CHANGED == 0 && BACKEND_CHANGED == 0 )); then
  git -C "$DEPLOY_ROOT" merge --ff-only "$TARGET_SHA"
  log "SUCCESS: deployed ${TARGET_SHA}; no application reload was required"
  exit 0
fi

FRONTEND_DEPS_CHANGED=0
BACKEND_DEPS_CHANGED=0
grep -qE '^frontend/(package\.json|package-lock\.json)$' <<<"$CHANGED_FILES" && FRONTEND_DEPS_CHANGED=1 || true
grep -qE '^backend/(package\.json|package-lock\.json)$' <<<"$CHANGED_FILES" && BACKEND_DEPS_CHANGED=1 || true

FRONTEND_PROCESS=""
BACKEND_PROCESS=""
FRONTEND_PORT=""
BACKEND_PORT=""
if (( FRONTEND_CHANGED )); then
  IFS=$'\t' read -r FRONTEND_PROCESS FRONTEND_PORT <<<"$(resolve_pm2_process frontend)"
fi
if (( BACKEND_CHANGED )); then
  IFS=$'\t' read -r BACKEND_PROCESS BACKEND_PORT <<<"$(resolve_pm2_process backend)"
fi

log "updating main to ${TARGET_SHA}; frontend=${FRONTEND_CHANGED} backend=${BACKEND_CHANGED}"
git -C "$DEPLOY_ROOT" merge --ff-only "$TARGET_SHA"

if (( FRONTEND_CHANGED )); then
  if (( FRONTEND_DEPS_CHANGED )) || [[ ! -d "$DEPLOY_ROOT/frontend/node_modules" ]]; then
    log "installing frontend dependencies from package-lock.json"
    ( cd "$DEPLOY_ROOT/frontend" && npm ci )
  fi
fi
if (( BACKEND_CHANGED )); then
  if (( BACKEND_DEPS_CHANGED )) || [[ ! -d "$DEPLOY_ROOT/backend/node_modules" ]]; then
    log "installing backend production dependencies from package-lock.json"
    ( cd "$DEPLOY_ROOT/backend" && npm ci --omit=dev )
  fi
fi

# A failed install or build never reloads PM2. The direct-checkout layout cannot
# atomically restore files without introducing a separate release architecture.
if (( FRONTEND_CHANGED )); then
  log "building frontend"
  ( cd "$DEPLOY_ROOT/frontend" && npm run build )
fi

if (( FRONTEND_CHANGED )); then
  pm2 reload "$FRONTEND_PROCESS" --update-env
  verify_pm2_process_online frontend "$FRONTEND_PROCESS"
  log "frontend health check passed (PM2 online: ${FRONTEND_PROCESS})"
fi
if (( BACKEND_CHANGED )); then
  pm2 reload "$BACKEND_PROCESS" --update-env
  verify_pm2_process_online backend "$BACKEND_PROCESS"
  curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:${BACKEND_PORT}/v1/health" >/dev/null
  verify_pm2_process_online backend "$BACKEND_PROCESS"
  log "backend health check passed on port ${BACKEND_PORT} (PM2 online, /v1/health responding)"
fi

log "SUCCESS: deployed ${TARGET_SHA}"
