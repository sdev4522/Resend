# Production deployment

This deployment uses the existing Git checkout at `/var/www/Resend`, immutable
Git worktrees in `/var/www/Resend/.releases`, and
the `/var/www/Resend/current` symlink as the PM2 working directory. A candidate
release is dependency-installed and frontend-built before `current` changes.
The script never runs migrations, `git reset --hard`, `pm2 restart all`, or
changes Nginx. Backend environment and Baileys session data live outside Git.

## Required GitHub secrets

- `DEPLOY_HOST` — server hostname or IP.
- `DEPLOY_PORT` — SSH port, normally `22`.
- `DEPLOY_USER` — restricted Unix deployment user.
- `DEPLOY_SSH_KEY` — private half of a dedicated Ed25519 deploy key.
- `SSH_KNOWN_HOSTS` — output of `ssh-keyscan -H -p PORT HOST`, verified
  out-of-band before storing.

Add these under **Repository Settings → Secrets and variables → Actions**. Put
the `production` environment behind required reviewers if human approval is
desired; the workflow targets that environment.

The workflow rejects missing SSH settings before writing files. It requires the
known-hosts secret to include `DEPLOY_HOST` (or `[DEPLOY_HOST]:DEPLOY_PORT` for
a non-22 port) and connects with `StrictHostKeyChecking=yes`. Capture and
verify the host fingerprint out-of-band before storing it.

## Build and dependency policy

Actions performs a clean frontend validation build. The server rebuilds only a
frontend-changing release because Next.js rewrites embed production public
environment values, which deliberately remain unavailable to GitHub Actions.
Shipping an artifact would require a standalone-output migration plus copying
static/public runtime files and exposing build-time configuration to CI.

For source-only changes, the server reuses the previous release's dependencies.
`npm ci` runs only for a first release or when the relevant package manifest or
lockfile changes; backend installs use `--omit=dev`.

## One-time, reviewed server migration

Run the following as the deployment user after backing up `/var/www/Resend`.
It intentionally does not run during CI. First inspect the real PM2 names and
working directories, without printing environment values:

```bash
pm2 jlist > /tmp/resend-pm2.json
node -e 'for (const p of require("/tmp/resend-pm2.json")) console.log(p.name, p.pm2_env.pm_cwd)'
```

Choose the two discovered names (one frontend, one backend), then create the
server-only config with restrictive permissions. Replace `DEPLOY_USER` with the
same Unix account named by the GitHub `DEPLOY_USER` secret; it needs read access
to this deployment-only file:

```bash
sudo install -d -o root -g DEPLOY_USER -m 750 /etc/resend
sudo install -o root -g DEPLOY_USER -m 640 /dev/null /etc/resend/deploy.env
sudoedit /etc/resend/deploy.env
```

The only required values are the exact PM2 names from the command above. These
are deployment controls, not application configuration; do **not** place
database credentials, JWT keys, API tokens, or `backend/.env` values here.

```bash
RESEND_FRONTEND_PM2_NAME='DISCOVERED_FRONTEND_NAME'
RESEND_BACKEND_PM2_NAME='DISCOVERED_BACKEND_NAME'
```

`RESEND_FRONTEND_PORT` and `RESEND_BACKEND_PORT` are optional and default to
`3000` and `3010`; set them only after checking the actual PM2/Nginx listener
ports. The repository, release, shared-data, current-symlink, environment-file,
and sessions paths are also optional overrides. Their defaults are documented in
[`deploy.env.example`](deploy.env.example). The deployment branch is always
`origin/main` and is not configurable through this file.

Validate the configuration and paths without deploying or restarting anything:

```bash
sudo -u DEPLOY_USER bash -n /etc/resend/deploy.env
sudo -u DEPLOY_USER bash -c 'set -a; . /etc/resend/deploy.env; set +a; test -n "$RESEND_FRONTEND_PM2_NAME"; test -n "$RESEND_BACKEND_PM2_NAME"'
sudo -u DEPLOY_USER test -d /var/www/Resend/.git
sudo -u DEPLOY_USER test -x /var/www/Resend/scripts/deploy-production.sh
sudo -u DEPLOY_USER git -C /var/www/Resend remote get-url origin
pm2 jlist > /tmp/resend-pm2.json
node -e 'for (const p of require("/tmp/resend-pm2.json")) console.log(p.name, p.pm2_env.pm_cwd, p.pm2_env.env?.PORT || p.pm2_env.env?.BACKEND_PORT || "")'
```

Prepare durable data. Copy (do not move or delete)
the existing production environment and sessions after verifying their current
locations. The config values must match the current listening ports and Nginx;
the checked-in Nginx template is not changed.

```bash
sudo install -d -o "$USER" -g "$USER" -m 750 /var/www/Resend/.releases /var/www/Resend/.deploy-shared
mkdir -p /var/www/Resend/.deploy-shared/sessions
cp -p /var/www/Resend/backend/.env /var/www/Resend/.deploy-shared/backend.env
cp -a /var/www/Resend/backend/sessions/. /var/www/Resend/.deploy-shared/sessions/
cp -p /var/www/Resend/frontend/.env.local /var/www/Resend/.deploy-shared/frontend.env
chmod 640 /var/www/Resend/.deploy-shared/backend.env /var/www/Resend/.deploy-shared/frontend.env
```

For the first release, run `DEPLOY_SHA=$(git -C /var/www/Resend
rev-parse origin/main) /var/www/Resend/scripts/deploy-production.sh`
in a maintenance window and review its output. It makes the `current` symlink
and starts/reloads only the explicitly named PM2 apps. Confirm both local health
URLs and the public URLs before removing the old checkout. Do **not** delete the
old checkout until this has been verified.

## Rollback

List available immutable releases with `ls /var/www/Resend/.releases`. To roll
back, atomically repoint `current` to a previously known-good SHA and reload
only the two configured processes using that release's ecosystem file:

```bash
SHA=known-good-commit-sha
ln -sfn "/var/www/Resend/.releases/$SHA" /var/www/Resend/current
set -a; . /etc/resend/deploy.env; set +a
export RESEND_CURRENT_DIR=/var/www/Resend/current
pm2 startOrReload "/var/www/Resend/current/ecosystem.production.config.cjs" --only "$RESEND_FRONTEND_PM2_NAME" --update-env
pm2 startOrReload "/var/www/Resend/current/ecosystem.production.config.cjs" --only "$RESEND_BACKEND_PM2_NAME" --update-env
```

The deployment script automatically performs that rollback if an affected
process fails to restart or its local health check fails. It cannot guarantee
zero connection loss for the stateful Baileys backend: PM2 reload behavior and
connection draining depend on the existing process configuration. Releases are
kept for manual rollback; cleanup must be an explicit, separately reviewed task.

## Verification matrix

In a staging clone or maintenance window, make separate commits touching only
`frontend/`, only `backend/`, and both. Confirm the log reports the expected
`frontend`/`backend` flags and that only that PM2 process reloads. Introduce a
temporary frontend build failure and a temporary blocked health endpoint to
confirm the current symlink rolls back. Start a second script invocation while
the first is building; it must exit 75 due to `flock`.
