# Raw SQL Inventory & Database Access Classification

> **Project:** Resend (Node.js/Express + MariaDB)<br>
> **Phase:** P6 — Full Regression, Rollout & Cleanup<br>
> **Branch:** `phase/P6-regression-rollout`<br>
> **Base Branch:** `integration/prisma-migration`<br>
> **Date:** 2026-10-21<br>
> **Database:** MariaDB `13.0.2-MariaDB` (`whatscrm`)<br>
> **Prisma Version:** `7.10.1`

---

## 1. Executive Summary

This inventory documents all database access patterns across the Resend Node.js backend. Following the incremental migration strategy established in Phase P0, database access is divided between:
1. **Fully Migrated to Prisma ORM:** Isolated CRUD (`routes/templet.js`), Core Billing, Payments, Subscriptions, Coupons, Multi-Currency pricing, and Webhook Reconciliation (`routes/billing.js`, `helper/pricing.js`, `helper/razorpay.js`, `functions/function.js:updateUserPlan`).
2. **Intentionally Retained Raw SQL:** High-throughput async message engines, raw Baileys WhatsApp sockets, and cron pollers where ORM abstraction overhead is undesirable.
3. **Not Yet Migrated (Future Phases):** General administration and user profile CRUD (`routes/admin.js`, `routes/user.js`, auth middlewares).
4. **Test & Tooling Fixtures:** Standalone verification scripts using direct queries for test setup, teardown, and assertion checks.

---

## 2. Quantitative Summary

| Category | File Count | Query Call Count (Approx.) | Primary Tables Accessed | Status / Plan |
|---|---|---|---|---|
| **Fully Migrated to Prisma** | 5 | 0 raw SQL (Typed Prisma / `$transaction`) | `templets`, `orders`, `plan`, `plan_prices`, `coupon`, `web_public`, `web_private`, `processed_webhook_events`, `user` | **MIGRATED (Phase P2 & P5)** |
| **1. Intentionally Retained Raw SQL** | 22 | ~115 | `instance`, `chats`, `broadcast`, `broadcast_log`, `meta_api`, `warmers`, `rooms` | Retain on `dbpromise.js` for I/O performance |
| **2. Not Yet Migrated (Future Phases)** | 18 | ~220 | `user`, `admin`, `contact`, `phonebook`, `support_tickets`, `api_keys` | Scheduled for future target phases |
| **3. Test & Tooling Code** | 14 | ~90 | All test fixtures (`user`, `orders`, `templets`, etc.) | Retain for direct test assertions |
| **4. Dead / Obsolete Code Cleaned** | 3 | 0 (Unused imports removed) | N/A | **CLEANED** (`billing.js`, `pricing.js`, `razorpay.js`) |

---

## 3. Detailed File-by-File Inventory

### 3.1 Fully Migrated Modules (Zero Raw SQL Remaining)

| File Path | Phase Migrated | Operations Converted to Prisma | Transaction Model |
|---|---|---|---|
| `backend/routes/templet.js` | Phase P2 | `prisma.templets.create`, `findMany`, `deleteMany` | Single-statement typed ORM |
| `backend/routes/billing.js` | Phase P5 | `prisma.plan.findMany`, `plan_prices.findMany`, `orders.create`, `orders.findFirst`, `orders.update`, `user.findFirst`, `user.updateMany`, `processed_webhook_events.findUnique`, `upsert` | Multi-statement atomic `prisma.$transaction(async (tx) => { ... })` |
| `backend/helper/pricing.js` | Phase P5 | `prisma.coupon.findFirst`, `web_public.findFirst`, `plan_prices.findMany`, `plan.findFirst` | Typed ORM reads with smart SaaS rounding |
| `backend/helper/razorpay.js` | Phase P5 | `prisma.web_private.findFirst` | Typed ORM read |
| `backend/functions/function.js` (`updateUserPlan`) | Phase P5 | `prisma.user.findFirst`, `prisma.user.updateMany` | Accepts optional `tx` for atomic integration |

---

### 3.2 Category 1: Intentionally Retained Raw SQL (High-Throughput Engines & Workers)

These components handle streaming data, continuous connection handshakes, or high-volume socket message dispatch. Raw parameterized SQL is intentionally retained to avoid query-builder overhead, object hydration delays, and memory pressure during large broadcasts.

| File Path | Domain / Component | Queries & Tables | Reason for Retention | Parameterization / Safety |
|---|---|---|---|---|
| `backend/helper/addon/qr/index.js` | Baileys WhatsApp Engine | `instance`, `auth`, `user` | Socket lifecycle, pairing state machines, reconnection loops | Parameterized (`?` placeholders) |
| `backend/helper/addon/qr/processThings.js` | Baileys Inbound Worker | `chats`, `contact`, `instance`, `user` | Inbound message auto-discovery and streaming contact upserts | Parameterized (`?` placeholders) |
| `backend/helper/addon/qr/warmer/index.js` | Phone Number Warmer | `warmers`, `warmer_script`, `instance` | Scheduled background warmup dispatch | Parameterized (`?` placeholders) |
| `backend/helper/inbox/inbox.js` | Unified Inbox Engine | `chats`, `contact`, `rooms`, `agents` | High-frequency chat message dispatch and unread counter increments | Parameterized (`?` placeholders) |
| `backend/helper/inbox/meta/index.js` | Meta Cloud API Inbound | `chats`, `contact`, `meta_api` | Real-time webhook message ingestion | Parameterized (`?` placeholders) |
| `backend/helper/inbox/messenger/index.js` | Messenger Inbound | `chats`, `contact`, `user` | Real-time messenger webhook processing | Parameterized (`?` placeholders) |
| `backend/helper/addon/telegram/tele.js` | Telegram Inbound | `chats`, `contact`, `user` | Real-time telegram bot message routing | Parameterized (`?` placeholders) |
| `backend/helper/addon/insta/insta.js` | Instagram Inbound | `chats`, `contact`, `user` | Real-time instagram bot message routing | Parameterized (`?` placeholders) |
| `backend/helper/addon/wacall/wacall.js` | Voice / Call Engine | `wa_call_broadcasts`, `wa_call_bot` | Voice broadcast execution and DTMF flow steps | Parameterized (`?` placeholders) |
| `backend/socket.js` | Socket.IO Server | `instance`, `rooms`, `agents`, `auth`, `user` | Real-time socket authentication and room subscription | Parameterized (`?` placeholders) |
| `backend/loops/loop.js` | Broadcast Cron Loop | `broadcast`, `broadcast_log`, `meta_api` | High-frequency background poller for pending WhatsApp campaigns | Parameterized (`?` placeholders) |
| `backend/loops/campaignBeta.js` | QR Campaign Cron Loop | `qr_campaigns`, `qr_campaign_logs` | Scheduled queue worker for Baileys broadcasts | Parameterized (`?` placeholders) |
| `backend/routes/broadcast.js` | Broadcast Engine | `broadcast`, `broadcast_log`, `contact`, `phonebook` | Contains campaign queue management and legacy pooled transaction | Parameterized; see Section 4 below |

---

### 3.3 Category 2: Not Yet Migrated (Future Planned Phases)

These files contain standard REST controllers and middlewares that were deferred in accordance with the Phase P0 incremental roadmap.

| File Path | Planned Scope | Key Operations & Tables | Safety / Parameterization | Follow-Up Recommendation |
|---|---|---|---|---|
| `backend/middlewares/user.js` | Phase P3 (Auth) | JWT validation, email verification, suspended user checks (`user`, `contact`) | Parameterized | Migrate in Auth/Middleware phase |
| `backend/middlewares/admin.js` | Phase P3 (Auth) | Super-admin privilege check (`admin`) | Parameterized | Migrate in Auth/Middleware phase |
| `backend/middlewares/plan.js` | Phase P3 (Entitlements) | Plan quota checks (`plan`, `instance`, `contact`, `chatbot`, `flow`) | Parameterized | Migrate alongside Quota Engine |
| `backend/middlewares/rateLimiter.js` | Phase P3 (Security) | Sliding-window atomic counter increments (`api_rate_limits`) | Parameterized | Keep atomic SQL or Redis |
| `backend/middlewares/publicApiAuth.js` | Public API | API key hash lookup (`api_keys`, `user`) | Parameterized | Migrate in Public API phase |
| `backend/routes/admin.js` | Phase P3 / P4 | User administration, plan configuration, audit logs, settings | Parameterized | Break into targeted CRUD submodules |
| `backend/routes/user.js` | Phase P3 / P4 | User lifecycle, password recovery, profile settings, and legacy gateways (Stripe, PayPal, MercadoPago) | Parameterized | Separate legacy gateways from user core |
| `backend/routes/phonebook.js` | Core CRM | Phonebook contact grouping (`phonebook`, `contact`) | Parameterized | Standard CRUD candidate |
| `backend/routes/support.js` | Support Module | Support tickets and messages (`support_tickets`, `support_messages`) | Parameterized | Standard CRUD candidate |
| `backend/routes/kaban.js` | Kanban Pipeline | Lead stages and board cards (`kanban_boards`, `kanban_cards`) | Parameterized | Standard CRUD candidate |
| `backend/services/analytics/analyticsService.js` | Phase P4 (Analytics) | Aggregations, daily time-series, rollups | Parameterized | Ready on `phase/P4-analytics` |

---

### 3.4 Category 3: Test & Tooling Code

These files are integration and regression test scripts that interact with the test database directly.

| File Path | Description | Classification | Safety |
|---|---|---|---|
| `backend/test-onboarding-billing-acceptance.mjs` | Onboarding & Billing acceptance tests | Test Code | Safe; uses test fixtures with cleanup |
| `backend/test-prisma-billing.mjs` | Dedicated Phase P5 test suite | Test Code | Safe; uses test fixtures with cleanup |
| `backend/test-prisma-dal-templets.mjs` | Dedicated Phase P2 test suite | Test Code | Safe; uses test fixtures with cleanup |
| `backend/test-signup-audit-acceptance.mjs` | Signup & Turnstile acceptance tests | Test Code | Safe; uses test fixtures with cleanup |
| `backend/test-google-auth-acceptance.mjs` | Google OAuth acceptance tests | Test Code | Safe; uses test fixtures with cleanup |
| `backend/test-turnstile-acceptance.mjs` | Cloudflare Turnstile verification tests | Test Code | Safe; uses test fixtures with cleanup |
| `backend/test-public-api.mjs` | Public REST API v1 regression suite | Test Code | Safe; uses test fixtures with cleanup |
| `backend/test-qr-lifecycle.mjs` | Baileys QR handshake verification | Test Code | Safe; uses test fixtures with cleanup |

---

## 4. Analysis of Legacy Database Transactions (`routes/broadcast.js`)

Phase P0 highlighted a pooled-connection transaction risk in `backend/routes/broadcast.js`:
- **Current Behavior:** The broadcast controller executes `await query('START TRANSACTION')` and subsequent queries using `query(...)`.
- **Known Risk:** In a pooled MySQL connection architecture (`mysql2/promise`), calling `START TRANSACTION` without reserving a dedicated connection (`pool.getConnection()`) can result in subsequent queries executing on different pool connections, causing transactions to remain uncommitted or fail silently under concurrency.
- **Scope Isolation:** Per P0 and P5 mandates, `broadcast.js` was strictly isolated from P5 and P6 migration scope.
- **Follow-Up Recommendation:** When migrating `routes/broadcast.js`, convert the entire message batch submission and campaign creation sequence to `prisma.$transaction(async (tx) => { ... })` using the singleton Prisma client.

---

## 5. Justification for Retaining `backend/database/dbpromise.js`

`backend/database/dbpromise.js` provides the MySQL connection pool used by unmigrated routes and engine workers.
- **Zero Production Churn:** The migration strategy is explicitly incremental. Retaining `dbpromise.js` guarantees that all unmigrated modules continue operating without modification or downtime.
- **Connection Co-Existence:** MariaDB handles connection pooling from both `mysql2/promise` (`dbpromise.js`) and `@prisma/adapter-mariadb` (`prisma.js`) concurrently without conflicts or resource exhaustion, verified under full regression test load.
- **Decommissioning Plan:** `dbpromise.js` should only be decommissioned once all 18 remaining route files and background workers have been systematically migrated in future phases.
