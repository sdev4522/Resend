# Production deployment

This deployment uses immutable Git worktrees in `/var/www/Resend/releases` and
the `/var/www/Resend/current` symlink as the PM2 working directory. A candidate
release is dependency-installed and frontend-built before `current` changes.
The script never runs migrations, `git reset --hard`, `pm2 restart all`, or
changes Nginx. Backend environment and Baileys session data live outside Git.

## Required GitHub secrets

- `DEPLOY_HOST` — server hostname or IP.
- `DEPLOY_PORT` — SSH port, normally `22`.
- `DEPLOY_USER` — restricted Unix deployment user.
- `DEPLOY_SSH_PRIVATE_KEY` — private half of a dedicated Ed25519 deploy key.
- `DEPLOY_KNOWN_HOSTS` — output of `ssh-keyscan -H -p PORT HOST`, verified
  out-of-band before storing.

Add these under **Repository Settings → Secrets and variables → Actions**. Put
the `production` environment behind required reviewers if human approval is
desired; the workflow targets that environment.

## One-time, reviewed server migration

Run the following as the deployment user after backing up `/var/www/Resend`.
It intentionally does not run during CI. First inspect the real PM2 names and
working directories, without printing environment values:

```bash
pm2 jlist > /tmp/resend-pm2.json
node -e 'for (const p of require("/tmp/resend-pm2.json")) console.log(p.name, p.pm2_env.pm_cwd)'
```

Choose the two discovered names (one frontend, one backend), then create the
server-only config with restrictive permissions:

```bash
sudo install -d -m 750 /etc/resend
sudo install -m 640 /dev/null /etc/resend/deploy.env
sudoedit /etc/resend/deploy.env
```

Set only these non-secret deployment settings in that file (replace the two
PM2 names with the output above):

```bash
RESEND_FRONTEND_PM2_NAME='DISCOVERED_FRONTEND_NAME'
RESEND_BACKEND_PM2_NAME='DISCOVERED_BACKEND_NAME'
RESEND_FRONTEND_PORT=3000
RESEND_BACKEND_PORT=3010
```

Prepare the release repository and durable data. Copy (do not move or delete)
the existing production environment and sessions after verifying their current
locations. The config values must match the current listening ports and Nginx;
the checked-in Nginx template is not changed.

```bash
sudo install -d -o "$USER" -g "$USER" -m 750 /var/www/Resend/{repository,releases,shared}
git clone --origin origin https://github.com/sdev4522/Resend.git /var/www/Resend/repository
mkdir -p /var/www/Resend/shared/sessions
cp -p /path/to/current/backend/.env /var/www/Resend/shared/backend.env
cp -a /path/to/current/backend/sessions/. /var/www/Resend/shared/sessions/
cp -p /path/to/current/frontend/.env.local /var/www/Resend/shared/frontend.env
chmod 640 /var/www/Resend/shared/backend.env /var/www/Resend/shared/frontend.env
```

For the first release, run `DEPLOY_SHA=$(git -C /var/www/Resend/repository
rev-parse origin/main) /var/www/Resend/repository/scripts/deploy-production.sh`
in a maintenance window and review its output. It makes the `current` symlink
and starts/reloads only the explicitly named PM2 apps. Confirm both local health
URLs and the public URLs before removing the old checkout. Do **not** delete the
old checkout until this has been verified.

## Rollback

List available immutable releases with `ls /var/www/Resend/releases`. To roll
back, atomically repoint `current` to a previously known-good SHA and reload
only the two configured processes using that release's ecosystem file:

```bash
SHA=known-good-commit-sha
ln -sfn "/var/www/Resend/releases/$SHA" /var/www/Resend/current
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
