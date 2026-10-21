# Phase P5 — Billing, Payments & Transactions Migration Report

> **Project:** Resend (Node.js/Express + MariaDB)<br>
> **Phase:** P5 — Billing, Payments & Transactions<br>
> **Branch:** `phase/P5-billing`<br>
> **Base Branch:** `integration/prisma-migration`<br>
> **Date:** 2026-10-21<br>
> **Database:** MariaDB `13.0.2-MariaDB` (`whatscrm`)<br>
> **Prisma Version:** `7.10.1`<br>
> **Status:** COMPLETED & VERIFIED (Zero regressions, zero financial invariants broken)

---

## 1. Executive Summary

Phase P5 migrates core billing, payment orders, recurring subscriptions, coupon application, currency pricing, and webhook reconciliation from legacy raw SQL queries to Prisma ORM using MariaDB connection pooling and atomic transactions (`prisma.$transaction`).

### Key Achievements:
1. **Financial & Cryptographic Invariants Preserved:**
   - Kept exact minor-unit (`amountMinor` in paise/cents) and major-unit formatting (`finalAmount.toFixed(2)`).
   - Preserved server-side HMAC-SHA256 signature verification for one-time orders, recurring autopay subscriptions, and webhook deliveries.
   - Enforced tenant boundary checks (`where: { s_token, uid }`) preventing cross-tenant verification or order hijacking.
2. **Atomic Database Transactions:**
   - Multi-statement mutations in `activate_trial`, `verify_payment`, and `webhook` (updating user subscription status, inserting/updating orders, incrementing coupon usage) are wrapped in atomic `prisma.$transaction(async (tx) => { ... })` blocks.
   - External provider network calls (Razorpay order/subscription creation) execute strictly **outside** database transactions to avoid holding connection pool locks during network latency.
3. **Idempotency Guarantees:**
   - Webhook processing deduplication is enforced via `prisma.processed_webhook_events.findUnique` and `upsert`, ensuring duplicate event deliveries return `{ duplicate: true }` without redundant activations or renewal orders.
   - Verified payment callbacks return `{ alreadyProcessed: true }` when the order is already in `"paid"` status.
4. **Zero Regressions:**
   - Both the new 18-assertion dedicated P5 billing acceptance test suite (`npm run test:p5`) and the existing 11-case onboarding/billing test suite (`test-onboarding-billing-acceptance.mjs`) pass at 100%.
   - Legacy query helper (`backend/database/dbpromise.js`) remains completely intact and operational for unmigrated modules.

---

## 2. Files Changed & Added

| File | Status | Description |
|---|---|---|
| `backend/routes/billing.js` | Modified | Migrated all billing endpoints (`/detect_currency`, `/plans`, `/activate_trial`, `/create_order`, `/verify_payment`, `/cancel_autopay`, `/orders`, `/subscription`, `/webhook`) to Prisma |
| `backend/helper/pricing.js` | Modified | Migrated `validateCoupon`, `getCurrencySettings`, `getPlanPrice`, and `calculateCheckoutPrice` to Prisma models (`coupon`, `web_public`, `plan_prices`, `plan`) |
| `backend/helper/razorpay.js` | Modified | Migrated `getRazorpayConfig` to `prisma.web_private.findFirst` |
| `backend/functions/function.js` | Modified | Migrated `updateUserPlan` to Prisma with support for optional transaction client (`tx`) |
| `backend/package.json` | Modified | Added `"test:p5": "node test-prisma-billing.mjs"` test script |
| `backend/test-prisma-billing.mjs` | Added | 18-assertion comprehensive test suite covering all billing and payment lifecycle flows |
| `backend/test-onboarding-billing-acceptance.mjs` | Modified | Added explicit `process.exit(0)` on success to ensure clean exit |
| `docs/prisma-migration/PHASE_P5_BILLING.md` | Added | This deliverable verification report |

---

## 3. Flows Migrated & Invariants Preserved

### Flow 1: Plan & Multi-Currency Discovery (`GET /api/billing/plans`, `GET /api/billing/detect_currency`)
- **Operations:**
  - `prisma.plan.findMany({ orderBy: [{ is_trial: 'desc' }, { price: 'asc' }] })`
  - `prisma.plan_prices.findMany({ where: { is_active: true } })`
  - `prisma.web_public.findFirst(...)` for site currency settings
- **Invariants:**
  - Safely normalizes `BigInt` plan prices (`Number(p.price)`) preventing JSON serialization errors.
  - Maintains dual-tier currency lookup (Tier 1: explicit from `plan_prices`, Tier 2: USD fallback with exchange rate and smart SaaS psychological rounding).

### Flow 2: Free Trial Activation (`POST /api/billing/activate_trial`)
- **Operations:**
  - `prisma.user.findFirst` to verify user existence and check if active paid subscription exists.
  - `prisma.orders.findFirst` to check if a `FREE_TRIAL` order already exists.
  - `prisma.$transaction`: atomically updates user plan/trial status (`trial = 1, subscription_status = 'trialing'`) and records audit order in `orders` (`payment_mode: 'FREE_TRIAL', status: 'paid', amount: '0.00'`).
- **Invariants:**
  - Replay prevention: rejects with HTTP 400 if user has already consumed their trial.
  - Active paid protection: blocks trial activation if user already has an active paid subscription.

### Flow 3: Order Creation (`POST /api/billing/create_order`)
- **Operations:**
  - Server-authoritative calculation via `calculateCheckoutPrice`.
  - Provider network calls (`createRazorpayOrder` / `createRazorpaySubscription`) run outside the database transaction.
  - `prisma.orders.create` records pending order with status `"created"`.
- **Invariants:**
  - Order creation does **not** activate the plan prematurely. The user remains in their current state until authoritative verification.
  - Minor-unit amounts (`amountMinor`) and major-unit strings (`finalAmount.toFixed(2)`) are strictly preserved.

### Flow 4: Authoritative Payment Verification (`POST /api/billing/verify_payment`)
- **Operations:**
  - Tenant isolation check: `prisma.orders.findFirst({ where: { s_token: referenceToken, uid } })`.
  - Idempotency check: returns `{ alreadyProcessed: true }` if `order.status === 'paid'`.
  - Cryptographic HMAC-SHA256 signature verification (`verifyRazorpaySignature` / `verifySubscriptionSignature`).
  - If signature invalid: marks `order.status = 'failed'` and returns HTTP 400.
  - If valid: `prisma.$transaction` atomically:
    1. Updates user plan and expiration via `updateUserPlan(plan, uid, totalDays, true, tx)`.
    2. Binds `subscription_id` and sets `subscription_status = 'active', trial = 0`.
    3. Increments coupon `used_count` via `tx.coupon.updateMany({ data: { used_count: { increment: 1 } } })`.
    4. Updates order `status = 'paid'` and records payment metadata.
- **Invariants:**
  - Rejects cross-tenant verification attempts with HTTP 403 Forbidden.
  - Never marks order paid without valid HMAC cryptographic signature.

### Flow 5: Autopay Cancellation (`POST /api/billing/cancel_autopay`)
- **Operations:**
  - Looks up user `subscription_id`.
  - Cancels subscription on provider via `cancelRazorpaySubscription`.
  - Updates `prisma.user.updateMany({ where: { uid }, data: { subscription_status: 'cancelled' } })`.

### Flow 6: Orders History & Subscription State (`GET /orders`, `GET /subscription`)
- **Operations:**
  - `prisma.orders.findMany({ where: { uid }, orderBy: { createdAt: 'desc' }, take: 50 })`.
  - `prisma.user.findFirst({ where: { uid } })`.
- **Invariants:**
  - Strict workspace isolation by `uid`.
  - Parses stored order metadata safely with fallback for unparseable records.

### Flow 7: Webhook Processing & Reconciliation (`POST /api/billing/webhook`)
- **Operations:**
  - Verifies webhook HMAC signature (`x-razorpay-signature`).
  - Idempotency check via `prisma.processed_webhook_events.findUnique({ where: { event_id: eventId } })`.
  - For `order.paid` / `payment.captured`: reconciles pending order and activates plan inside atomic `prisma.$transaction`.
  - For `subscription.charged`: extends user plan and creates renewal order record inside atomic `prisma.$transaction`.
  - For `subscription.cancelled`: marks user `subscription_status = 'cancelled'`.
  - Records processed event via `prisma.processed_webhook_events.upsert`.

---

## 4. Verification & Test Results

| Check / Test | Command | Target / Scope | Result |
|---|---|---|---|
| **P5 Dedicated Billing Suite** | `npm run test:p5` | 18 assertions: orders, subscriptions, coupons, HMAC verification, webhooks, idempotency, tenant boundaries | **PASS** (18/18 passed) |
| **Onboarding & Billing Acceptance** | `node backend/test-onboarding-billing-acceptance.mjs` | 11 cases: trial activation, pending order protection, signature rejection, webhook reconciliation | **PASS** (11/11 passed) |
| **Prisma Foundation Health** | `npm run test:prisma` | 10 database model assertions | **PASS** (10/10 passed) |
| **P2 Templates DAL Suite** | `npm run test:p2` | 15 tests: CRUD lifecycle and tenant boundaries | **PASS** (15/15 passed) |
| **Signup Audit Acceptance** | `node backend/test-signup-audit-acceptance.mjs` | 16 assertions: auth registration, Turnstile, policies | **PASS** (16/16 passed) |
| **Google Auth Acceptance** | `node backend/test-google-auth-acceptance.mjs` | 24 assertions: OAuth contracts, linking, secrets isolation | **PASS** (24/24 passed) |
| **Prisma Schema Validation** | `npm run prisma:validate` | `backend/prisma/schema.prisma` | **PASS** (Schema is valid) |
| **Prisma Client Generation** | `npm run prisma:generate` | `@prisma/client` artifact generation | **PASS** (Generated in 349ms) |
| **Frontend TypeScript Typecheck** | `npm run typecheck` | Next.js 14 / 16 frontend | **PASS** (0 errors) |
| **Frontend ESLint** | `npm run lint` | Next.js 14 / 16 frontend | **PASS** (0 errors) |
| **Frontend Production Build** | `npm run build` | Next.js 14 static & dynamic routes | **PASS** (65/65 routes compiled) |
| **Git Diff Whitespace Check** | `git diff --check` | Whitespace & conflict markers | **PASS** (0 issues) |
| **Legacy Query Helper Co-Existence** | Visual inspection & runtime tests | `backend/database/dbpromise.js` | **PASS** (Untouched & 100% operational) |

---

## 5. Raw SQL Intentionally Retained

- **`backend/routes/user.js` Legacy Gateways (Stripe, PayPal, MercadoPago):**
  Per the Phase P0 audit and incremental migration mandate, legacy payment endpoints in `routes/user.js` remain on `dbpromise.js`. They are scheduled for separate gateway-specific migration or deprecation.
- **`backend/routes/admin.js` Admin Order Queries:**
  Admin analytics and order listing queries in `admin.js` were audited under Phase P4 and are handled in administrative reporting phases.
- **`backend/database/dbpromise.js`:**
  Unmodified to guarantee zero downtime and zero regressions for unmigrated engine components (`broadcast.js`, `qr.js`, `inbox.js`).

---

## 6. Known Risks & Reviewer Merge Instructions

### Known Risks & Mitigations:
1. **BigInt in Prisma Models:**
   - *Risk:* MariaDB `BIGINT` fields in `plan` (`price`) are mapped to JavaScript `BigInt` by Prisma, which fails `JSON.stringify` serialization.
   - *Mitigation:* Explicitly sanitized via `price: p.price != null ? Number(p.price) : 0` across all billing responses.
2. **Provider Mock Signature Security:**
   - *Risk:* Development mock signatures could accidentally be accepted in production.
   - *Mitigation:* `helper/razorpay.js` explicitly checks `if (process.env.NODE_ENV === "production")` and throws/rejects mock signatures immediately.

### Reviewer Merge Instructions:
```bash
# 1. Fetch remote branches
git fetch origin

# 2. Check out integration base branch
git checkout integration/prisma-migration
git pull origin integration/prisma-migration

# 3. Merge phase/P5-billing with non-fast-forward merge commit
git merge --no-ff phase/P5-billing -m "Merge branch 'phase/P5-billing' into integration/prisma-migration"

# 4. Push updated integration branch
git push origin integration/prisma-migration
```
