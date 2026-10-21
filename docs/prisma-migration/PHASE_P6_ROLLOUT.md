# Phase P6: Deployment & Rollout Plan

> **Project:** Resend (Node.js/Express + Next.js + MariaDB)<br>
> **Document:** Phase P6 Rollout & Rollback Specification<br>
> **Target Environment:** Staging & Production<br>
> **Date:** 2026-10-21<br>
> **Branch:** `phase/P6-regression-rollout`<br>
> **Base Branch:** `integration/prisma-migration`

---

## 1. Executive Overview

This document details the exact operational deployment sequence, configuration requirements, smoke tests, telemetry signals, and zero-downtime rollback procedures for deploying the Prisma ORM migration to staging and production environments.

The migration uses an **incremental, dual-driver architecture**:
- **Prisma Client (`@prisma/client` + `@prisma/adapter-mariadb`):** Governs migrated domains (`templets`, `orders`, `plan`, `plan_prices`, `coupon`, `web_public`, `web_private`, `processed_webhook_events`, and billing-related `user` plan mutations).
- **Legacy Driver (`mysql2/promise` via `dbpromise.js`):** Intentionally preserved for unmigrated domains and high-throughput real-time streaming engines (WhatsApp Baileys, Inbox, Socket.IO, Broadcast cron).

No destructive schema alterations, table drop statements, or column renames are permitted or introduced in this phase.

---

## 2. Environment Variable Configuration

The backend requires the following environment variables. **Under no circumstances must secrets or credentials be hardcoded or committed to git.**

### 2.1 Prisma & Database Connection Variables

| Variable Name | Purpose | Scope / Consumer | Notes |
|---|---|---|---|
| `DATABASE_URL` | MariaDB connection string for Prisma ORM (`mariadb://user:pass@host:port/dbname?connection_limit=...`) | Backend (`prisma.js`, `schema.prisma`) | Used by `@prisma/adapter-mariadb` and Prisma CLI |
| `DBHOST` | Database server hostname / IP | Legacy driver (`dbpromise.js`) | Dual-driver configuration |
| `DBPORT` | Database server port (default: 3306) | Legacy driver (`dbpromise.js`) | Co-exists with `DATABASE_URL` |
| `DBUSER` | Database username | Legacy driver (`dbpromise.js`) | Must have identical database permissions as Prisma |
| `DBPASS` | Database user password | Legacy driver (`dbpromise.js`) | Never log or expose |
| `DBNAME` | Target database name (`whatscrm`) | Legacy driver (`dbpromise.js`) | Target database must be identical |
| `NODE_ENV` | Application runtime environment (`development`, `staging`, `production`) | Backend & Frontend | Controls Prisma logging level (`info`/`warn` vs `debug`) |

### 2.2 Payment & Webhook Configuration (Phase P5 Dependencies)

| Variable Name | Purpose | Consumer | Required Values / Format |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | Razorpay API key identifier | `backend/helper/razorpay.js` | Configured per environment |
| `RAZORPAY_KEY_SECRET` | Razorpay secret for signature validation | `backend/helper/razorpay.js` | Used for HMAC SHA256 verification |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature secret | `backend/routes/billing.js` | Validates inbound webhook integrity |
| `DODO_PAYMENTS_API_KEY` | Dodo Payments API key | `backend/helper/dodo.js` | Configured if Dodo provider enabled |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Dodo Payments webhook secret | `backend/routes/billing.js` | Validates webhook authenticity |

---

## 3. Build & Deployment Requirements

### 3.1 Node & Tooling Prerequisites
- **Node.js:** `>= 18.17.0` (Recommended: Node.js 20 LTS)
- **MariaDB:** `>= 10.6` (Verified on `13.0.2-MariaDB`)
- **Prisma CLI:** `^7.10.1`

### 3.2 Build-Time Steps (CI / CD Pipeline)
Every deployment pipeline must execute client generation prior to application launch:

```bash
# 1. Install dependencies
cd backend && npm ci

# 2. Validate Prisma Schema against target schema definition
npm run prisma:validate

# 3. Generate Prisma Client bindings for the deployment platform
npm run prisma:generate

# 4. In frontend directory (if deploying full-stack):
cd ../frontend && npm ci && npm run build
```

> [!IMPORTANT]
> `npm run prisma:generate` MUST run on the deployment machine/container during build or container image creation so that native engine artifacts match the host OS architecture (`linux-glibc`, `darwin-arm64`, etc.).

---

## 4. Staging Deployment Sequence

Execute the following sequential steps when deploying to the staging environment:

### Step 1: Pre-Deployment Sanity Check
1. Verify target database connection from host:
   ```bash
   mariadb -h $DBHOST -P $DBPORT -u $DBUSER -p$DBPASS $DBNAME -e "SELECT 1;"
   ```
2. Verify existing tables are intact (`templets`, `orders`, `plan`, `plan_prices`, `coupon`, `web_public`, `web_private`, `processed_webhook_events`, `user`).
3. Ensure PM2 process manager is healthy:
   ```bash
   pm2 status
   ```

### Step 2: Code Checkout & Build
1. Pull target release commit:
   ```bash
   git fetch origin
   git checkout <RELEASE_COMMIT_SHA>
   ```
2. Run backend build & generation:
   ```bash
   cd backend
   npm ci --omit=dev
   npx prisma generate
   ```

### Step 3: Service Reload (Zero-Downtime Cluster Reload)
1. Gracefully reload the backend PM2 cluster:
   ```bash
   pm2 reload resend-api --update-env
   ```
2. Check initial logs for clean startup:
   ```bash
   pm2 logs resend-api --lines 50 --nostream
   ```
   *Verify:* Output contains `DB connected`, `Server running on port ...`, and no Prisma initialization or connection pool errors.

---

## 5. Post-Deployment Smoke Tests & Verification

Run these verification tests immediately following staging deployment:

### 5.1 Template CRUD Verification (Phase P2)
- **Action:** Create, list, and delete a message template via `POST /api/templet/add`, `GET /api/templet/all`, `POST /api/templet/delete`.
- **Expected Result:** HTTP 200, row inserted into `templets` table, retrieved successfully, deleted cleanly.

### 5.2 Plan & Pricing Fetch (Phase P5)
- **Action:** Fetch live public plans:
  ```bash
  curl -s http://localhost:3001/api/billing/plans | jq .
  ```
- **Expected Result:** HTTP 200, JSON list of active plans with converted `BigInt` prices (serialized as standard numbers, not string or BigInt syntax).

### 5.3 Order Creation & Razorpay Order Init (Phase P5)
- **Action:** Send authenticated `POST /api/billing/create-order` for a test plan.
- **Expected Result:** HTTP 200, row created in `orders` with `status: 'created'`, Razorpay order ID generated and returned.

### 5.4 Razorpay Webhook Idempotency (Phase P5)
- **Action:** Send simulated `payment.captured` webhook payload to `POST /api/billing/webhook/razorpay` twice with the same event ID.
- **Expected Result:**
  - 1st call: Order transitioned to `completed`, user plan updated in atomic transaction, event ID recorded in `processed_webhook_events`.
  - 2nd call: Event detected as duplicate, returns HTTP 200 `{ message: 'Event already processed' }` without double-crediting user.

### 5.5 Unmigrated Services Continuity
- **Action:** Test QR code socket lifecycle (`GET /api/addon/qr/status`) and broadcast listing.
- **Expected Result:** Unmigrated services continue running smoothly on `dbpromise.js` without connection pool leaks.

---

## 6. Database Schema Compatibility

1. **Zero DDL Changes:** No schema migrations (`prisma migrate deploy` or `prisma db push`) are executed during this deployment. The Prisma schema was constructed as a reverse-engineered map of the production database.
2. **Column Mapping Fidelity:**
   - Snake_case column names (`plan_id`, `created_at`, `expired_at`) match database columns exactly using `@map` annotations.
   - Enums (`order_status`, `payment_status`) are validated against MySQL enum definitions.
3. **Dual-Driver Co-Existence:**
   - Both `mysql2/promise` and `@prisma/adapter-mariadb` connect to the same MariaDB instance.
   - MariaDB handles concurrent pool allocation without row lock contention between the two drivers.

---

## 7. Rollback Procedure (Zero Downtime, Non-Destructive)

Because no destructive DDL or schema alterations were applied, rolling back is entirely a code-level git revert or PM2 switch.

### Immediate Rollback Steps:
1. Revert to the previous stable release commit or branch:
   ```bash
   git checkout <PREVIOUS_STABLE_COMMIT_SHA>
   ```
2. Re-install production dependencies (if package-lock changed):
   ```bash
   cd backend && npm ci --omit=dev
   ```
3. Reload PM2 processes:
   ```bash
   pm2 reload resend-api --update-env
   ```
4. Verify application status:
   ```bash
   pm2 status
   curl -I http://localhost:3001/health
   ```

> [!NOTE]
> Database data created during the migration window (e.g. newly created orders or templates) remains 100% backward-compatible with legacy `dbpromise.js` queries because the physical table schemas were unchanged.

---

## 8. Telemetry, Monitoring & Error Signals

During and after deployment, monitor the following indicators for at least 24 hours:

| Metric / Signal | Warning Threshold | Critical Threshold | Remediation |
|---|---|---|---|
| **MariaDB Active Connections (`Threads_connected`)** | > 80% of `max_connections` | > 95% of `max_connections` | Adjust pool sizes (`connection_limit` in `DATABASE_URL` and `dbpromise.js`) |
| **Unhandled Promise Rejections** | > 0 per hour | > 5 per hour | Check PM2 error logs for Prisma initialization or query failure |
| **Prisma Serialization Errors** | Any `Do not know how to serialize a BigInt` | Any occurrences | Check pricing/plans responses; verify BigInt sanitation |
| **Webhook Duplicate Rejections** | Normal background rate | > 25% failure rate | Inspect webhook secret validity and network latency |
| **HTTP 500 Spike on Billing Routes** | > 1% of billing requests | > 5% of billing requests | Trigger immediate rollback to previous release commit |

---

## 9. Conditions for Production Rollout

Before initiating production deployment, all of the following gates must be satisfied:

1. [x] **Full Regression Matrix Clean:** All automated test suites (`test:prisma`, `test:p2`, `test:p5`, onboarding/billing acceptance, auth acceptance) execute with 100% PASS rate.
2. [x] **Frontend Integrity Confirmed:** Frontend typecheck, lint, and production Next.js build compile with zero errors.
3. [x] **Raw SQL Audit Complete:** All backend database access patterns inventoried, classified, and parameterized.
4. [ ] **Staging Soak Period:** Staging environment deployed and soaked for a minimum of 48 hours without unhandled Prisma errors.
5. [ ] **Staging Smoke Tests Verified:** Manual end-to-end checkout, payment webhook reconciliation, and template creation completed by QA/engineering.
6. [ ] **Approval Gate:** Explicit sign-off from engineering lead and product owner.

---

## 10. Known Risks, Untested Scenarios & Deferred Work

1. **Unmigrated Phase P3 & P4 Modules:**
   - User administration (`routes/admin.js`), general user CRUD (`routes/user.js`), and analytics rollups (`services/analytics/`) remain on raw SQL.
   - *Mitigation:* They are decoupled from the billing and template DAL, running safely on `dbpromise.js`.
2. **Direct Server Test Execution (`test-public-api.mjs`):**
   - Requires a live server daemon on port 3001; validated via unit/acceptance mock fixtures rather than continuous port binding in CI.
3. **High-Concurrency Broadcast Transactions:**
   - Legacy pooled connection transaction in `routes/broadcast.js` remains a known item for the dedicated broadcast refactor phase.
