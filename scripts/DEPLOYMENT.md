# Production deployment

Production runs directly from the existing checkout at `/var/www/Resend` on
branch `main`. No `/etc/resend/deploy.env`, `current` symlink, release directory,
or generated PM2 ecosystem file is required.

GitHub Actions validates frontend types and linting, then streams the tracked
deployment script over the already verified SSH connection. The server fetches
the exact GitHub commit, fast-forwards `main`, installs dependencies only when a
relevant lockfile changes (or `node_modules` is absent), builds Next.js once on
the server, reloads only changed PM2 processes, and runs local health checks.
The server build is intentional because its production build-time environment
remains on the server.

## Required GitHub secrets

- `DEPLOY_HOST`
- `DEPLOY_PORT`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `SSH_KNOWN_HOSTS`

SSH key parsing, public-key fingerprint checking, known-host fingerprint
checking, and `StrictHostKeyChecking=yes` are enforced in the workflow.

## One-time read-only verification

Before enabling a supervised deployment, inspect the actual PM2 process working
directories and ports. The script discovers process names dynamically and
requires exactly one process at each expected directory:

```bash
pm2 jlist > /tmp/resend-pm2.json
node -e 'for (const p of require("/tmp/resend-pm2.json")) console.log(p.name, p.pm2_env.pm_cwd, p.pm2_env.env?.PORT || p.pm2_env.env?.BACKEND_PORT || "")'
test -d /var/www/Resend/.git
test -f /var/www/Resend/frontend/package-lock.json
test -f /var/www/Resend/backend/package-lock.json
git -C /var/www/Resend branch --show-current
git -C /var/www/Resend status --short
```

Expected PM2 working directories are exactly `/var/www/Resend/frontend` and
`/var/www/Resend/backend`. If the server reports different directories, stop
and correct the existing PM2 setup before deploying; the script deliberately
refuses to guess process names.

## First supervised deployment

Push the reviewed workflow and script to `main`, then use **Actions → Deploy
production → Run workflow**. Observe that the log reports the target SHA,
changed applications, dependency-install decisions, PM2 process resolution, and
health checks. It never runs database migrations, `pm2 restart all`, or Nginx
commands.

## Safety properties and limitation

The script refuses tracked local changes, a non-`main` checkout, non-main
commits, and non-fast-forward updates. It preserves ignored production files,
including `backend/.env` and `backend/sessions`, because it does not clean,
reset, copy, or delete them.

This deliberately simple direct-checkout model cannot be fully atomic: if a
server-side install or frontend build fails after the fast-forward merge, PM2 is
not reloaded, but the checkout remains at the target commit. Introducing atomic
rollback would require the release/symlink architecture intentionally removed
by this simplification.
