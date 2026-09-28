# WACRM SaaS — Technical Architecture

## 0. Architecture goal

Create a maintainable SaaS platform around the existing WACRM Node.js backend while building a new Next.js TypeScript frontend.

The architecture must:
- minimize unnecessary rewrites
- isolate SaaS/billing logic
- enforce tenant boundaries
- keep frontend strongly typed
- make plan/limit changes cheap
- make Razorpay replaceable later
- support mobile and desktop
- allow gradual backend modernization

---

# 1. High-level architecture

```text
                         INTERNET
                            |
             +--------------+--------------+
             |                             |
       Marketing / Auth              Application
             |                             |
             v                             v
      Next.js Frontend              Next.js Dashboard
             |                             |
             +-------------+---------------+
                           |
                     Typed API Client
                           |
                           v
                Node.js Application API
                           |
        +------------------+------------------+
        |                  |                  |
        v                  v                  v
   Auth/Tenant        Product Services    Billing Domain
        |                  |                  |
        |                  |                  v
        |                  |              Razorpay
        |                  |
        v                  v
     Database        WhatsApp / Automation
                           |
                           v
                    WebSocket/Socket
```

---

# 2. Repository strategy

Prefer separate applications during the migration:

```text
/home/sdev/Projects/
├── wacrm/
│   └── existing backend
│
└── wacrm-frontend/
    └── new Next.js frontend
```

Do not initially mix the new frontend into the old compiled frontend.

---

# 3. Frontend architecture

Stack:
- Next.js
- TypeScript
- App Router
- Tailwind CSS
- Official shadcn/ui
- shadcn CLI
- Zod where runtime validation is useful

The official shadcn documentation provides the CLI setup flow and supports Next.js templates. https://ui.shadcn.com/docs/installation

---

# 4. Frontend layers

```text
app/
  route/layout/page composition

components/
  reusable UI and product components

features/
  domain-specific UI and logic

lib/
  API, auth, utilities, validation

types/
  shared frontend types

hooks/
  reusable client behavior

config/
  application configuration
```

Recommended domain structure:

```text
features/
├── auth/
├── onboarding/
├── inbox/
├── contacts/
├── campaigns/
├── templates/
├── automation/
├── analytics/
├── billing/
├── team/
├── integrations/
└── admin/
```

---

# 5. UI architecture

Use official shadcn primitives as the base.

```text
shadcn primitive
      |
      v
product component
      |
      v
feature component
      |
      v
page
```

Example:

```text
Button
  -> SubmitButton
  -> PaymentButton
  -> UpgradeButton
```

Do not create separate primitive libraries.

---

# 6. API architecture

Create a centralized API client.

```text
lib/api/
├── client.ts
├── auth.ts
├── users.ts
├── workspace.ts
├── inbox.ts
├── contacts.ts
├── campaigns.ts
├── templates.ts
├── automation.ts
├── billing.ts
├── plans.ts
└── admin.ts
```

Components should not know raw API URLs.

Bad:

```ts
fetch("/api/something")
```

inside arbitrary UI components.

Preferred:

```ts
campaignsApi.create(...)
```

---

# 7. API boundary

The API boundary is where untyped legacy backend behavior becomes typed frontend behavior.

```text
Existing Node backend
        |
        v
HTTP/Socket API
        |
        v
API client
        |
        v
runtime validation where needed
        |
        v
TypeScript domain types
        |
        v
React UI
```

Do not pretend an API is strongly typed merely because the frontend has an interface. Validate uncertain external data when necessary.

---

# 8. Backend strategy

The existing WACRM backend is the initial business-logic source.

Do not rewrite it wholesale.

First analyze:
- routes
- controllers/functions
- database
- auth
- WhatsApp integration
- automation
- sessions
- socket events
- background loops
- media
- emails

New backend code may use TypeScript.

Existing stable JavaScript should be migrated only when there is a concrete benefit.

---

# 9. Backend modularization target

Gradually move toward:

```text
server/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── workspaces/
│   ├── whatsapp/
│   ├── inbox/
│   ├── contacts/
│   ├── campaigns/
│   ├── templates/
│   ├── automation/
│   ├── billing/
│   └── admin/
│
├── middleware/
├── infrastructure/
│   ├── database/
│   ├── queue/
│   ├── sockets/
│   └── storage/
│
└── shared/
```

This is a target architecture, not a requirement to rewrite everything immediately.

---

# 10. Multi-tenancy

Every tenant-owned resource must be scoped.

Conceptual model:

```text
Platform
  |
  +-- Workspace A
  |      |
  |      +-- Members
  |      +-- WhatsApp accounts
  |      +-- Contacts
  |      +-- Conversations
  |      +-- Campaigns
  |      +-- Templates
  |      +-- Automations
  |      +-- Subscription
  |
  +-- Workspace B
```

Tenant isolation must be enforced server-side.

Never trust:
- workspace ID from arbitrary client input
- user role from client state
- plan name from client state

Resolve identity and permissions from authenticated server context.

---

# 11. SaaS domain architecture

Treat billing, plans and entitlements as a domain rather than UI conditions.

Core entities:

```text
Plan
Entitlement
Workspace
Subscription
Payment
UsageRecord
PaymentEvent
```

Relationship:

```text
Workspace
   |
   +---- Subscription ---- Plan
   |
   +---- Usage
   |
   +---- Entitlements
```

---

# 12. Plan architecture

Do not use:

```ts
if (plan === "business")
```

throughout the application.

Use:

```ts
entitlements.can("campaigns")
limits.get("messages.monthly")
usage.get("messages.monthly")
```

The exact API names can differ, but the principle is mandatory.

This allows:
- new plans
- custom plans
- promotional plans
- future add-ons
- plan changes
without rewriting feature logic.

---

# 13. Usage architecture

Usage should be authoritative on the backend.

Conceptual:

```text
UsageService
├── getUsage()
├── getLimit()
├── getRemaining()
├── checkLimit()
└── consume()
```

For important metered operations:

```text
request
  -> authenticate
  -> authorize
  -> resolve tenant
  -> check entitlement
  -> check usage
  -> execute operation
  -> record usage
```

The exact atomicity strategy depends on the existing database and operation.

Avoid race conditions for high-volume quotas.

---

# 14. Feature gating

Feature access should use capability checks.

Example:

```text
campaigns.enabled
automation.enabled
api_access.enabled
advanced_analytics.enabled
team_members.limit
messages.monthly.limit
```

Frontend:
- explains restriction
- displays upgrade path

Backend:
- actually enforces restriction

---

# 15. Billing architecture

Create a payment-provider abstraction.

```text
BillingService
      |
      v
PaymentGateway interface
      |
      +---- RazorpayGateway
      |
      +---- future gateway
```

Initial implementation:

```text
RazorpayGateway
```

Only Razorpay is required initially.

Do not implement Stripe/PayPal/etc. now.

---

# 16. Payment lifecycle

```text
User selects plan
       |
       v
Frontend requests checkout/order
       |
       v
Backend creates Razorpay order
       |
       v
Razorpay checkout
       |
       +---- failed/cancelled
       |
       v
Client receives payment response
       |
       v
Backend verifies payment
       |
       v
Razorpay webhook
       |
       v
Backend reconciles state
       |
       v
Subscription activated/updated
       |
       v
Frontend fetches authoritative state
```

Browser callback alone must never be the final source of truth.

---

# 17. Payment idempotency

Payment/webhook handling must be idempotent.

Store appropriate identifiers:
- provider order ID
- payment ID
- event ID where available
- subscription ID where applicable

Repeated webhook delivery must not:
- create duplicate subscriptions
- double-credit usage
- duplicate invoices
- corrupt state

---

# 18. Billing state machine

Use explicit states rather than boolean flags.

Payment:

```text
created
pending
processing
succeeded
failed
cancelled
verification_pending
verification_failed
refunded
```

Subscription:

```text
trialing
active
past_due
cancelled
expired
paused
pending_activation
```

Only implement states that are actually needed by the business rules/backend.

---

# 19. Checkout architecture

Checkout should be a domain workflow, not just a button.

```text
Plan
  -> CheckoutSession
  -> PaymentOrder
  -> Payment
  -> Verification
  -> Subscription
```

Keep the user-facing checkout state separate from provider-specific implementation details.

---

# 20. Webhook architecture

Webhook endpoint:

```text
POST /webhooks/razorpay
```

Flow:

```text
receive
 -> verify signature
 -> parse event
 -> check idempotency
 -> update payment/subscription
 -> record event
 -> return success
```

Webhook processing should be safe to retry.

---

# 21. Authentication architecture

The exact mechanism must follow the existing backend.

Conceptual:

```text
Browser
  |
  v
Next.js
  |
  v
Backend authentication
  |
  v
Authenticated identity
  |
  v
Workspace/role resolution
```

Do not create a parallel authentication system unless required.

---

# 22. Authorization architecture

Authorization should be server-side.

Conceptual:

```text
Identity
   |
Workspace membership
   |
Role
   |
Permission
   |
Entitlement
   |
Resource ownership
```

All relevant layers should be considered for protected operations.

---

# 23. WebSocket architecture

Use the existing socket implementation if it already provides real-time events.

Frontend:

```text
SocketProvider
   |
   +-- connection state
   +-- reconnect
   +-- authentication
   +-- event subscriptions
```

Feature hooks consume domain events rather than manually opening sockets in random components.

Example:

```text
useInboxSocket()
useNotificationSocket()
```

---

# 24. Inbox real-time model

Potential events:

```text
message.created
message.updated
message.status
conversation.updated
conversation.assigned
notification.created
```

Actual event names must be discovered from the existing backend.

Do not invent event contracts.

---

# 25. Mobile architecture

Mobile is not a separate app.

Use the same Next.js application with responsive layouts.

However, some workflows should have different composition on mobile.

Example:

Desktop inbox:
```text
conversation list | conversation | contact panel
```

Mobile:
```text
conversation list
      ->
conversation screen
      ->
contact details sheet
```

---

# 26. Admin architecture

Admin must be isolated from normal workspace UI.

Routes:

```text
/admin
/admin/users
/admin/workspaces
/admin/plans
/admin/subscriptions
/admin/payments
/admin/settings
```

Admin authorization must be enforced server-side.

---

# 27. Database strategy

First inspect the existing schema.

Do not:
- rename tables blindly
- drop production tables
- change columns without migration
- assume the existing schema from frontend code

Any schema change must have:
- reason
- migration
- rollback consideration
- affected code list

---

# 28. Caching and data freshness

Do not cache billing/subscription state aggressively.

For:
- subscription
- payment status
- usage limits
- permissions

prefer authoritative/fresh backend data.

For low-risk marketing/static data, normal Next.js caching is acceptable.

---

# 29. Error architecture

Centralize API errors.

Conceptual:

```text
ApiError
├── ValidationError
├── AuthError
├── PermissionError
├── NotFoundError
├── ConflictError
├── LimitExceededError
├── PaymentError
└── NetworkError
```

Map errors to user-facing messages without exposing internal details.

---

# 30. Environment configuration

Separate:

Public client variables:
```text
NEXT_PUBLIC_*
```

Server-only variables:
```text
DATABASE_*
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
API_SECRET
```

Never put server secrets in client-exposed variables.

---

# 31. Testing strategy

Minimum:
- TypeScript checks
- ESLint
- Production build

Critical domain tests:
- entitlement checks
- limit checks
- tenant isolation
- payment verification
- webhook idempotency
- subscription state changes
- authentication/authorization

Do not spend large effort testing trivial presentational components before business-critical paths.

---

# 32. Development sequence

Phase 1:
Backend analysis

Phase 2:
Documentation:
- requirements.md
- design.md
- architecture.md

Phase 3:
New Next.js project
- TypeScript
- Tailwind
- official shadcn/ui
- theme
- base layout

Phase 4:
API client/auth

Phase 5:
Workspace/onboarding

Phase 6:
Core dashboard

Phase 7:
Inbox

Phase 8:
Contacts/campaigns/templates

Phase 9:
Automation

Phase 10:
Billing/plans/usage

Phase 11:
Razorpay checkout/webhooks

Phase 12:
Admin panel

Phase 13:
Mobile refinement

Phase 14:
Security, testing and production hardening

---

# 33. AI-agent operating rules

The AI agent must read these three documents before coding.

Before implementing a feature:
1. Find the relevant requirement.
2. Find the architecture boundary.
3. Reuse existing components.
4. Inspect existing backend behavior.
5. Implement the smallest complete change.
6. Run typecheck/lint/build.
7. Fix errors.
8. Update documentation only when architecture/requirements actually changed.

Do not repeatedly rediscover the same information.

Do not generate speculative code.

Do not create mock backend behavior when the real backend can be inspected.

Do not rewrite unrelated files.

Do not install a package when an existing dependency or shadcn component solves the problem.

---

# 34. Architecture decision rules

When choosing between two implementations:

1. Prefer the simpler implementation.
2. Prefer existing backend behavior.
3. Prefer official shadcn primitives.
4. Prefer typed boundaries.
5. Prefer centralized domain logic.
6. Prefer server-side enforcement for security.
7. Prefer configuration over hardcoded plan logic.
8. Prefer reversible changes.
9. Prefer incremental migration over rewrites.
10. Prefer mobile-compatible components.

---

# 35. Performance priorities

Optimize the expensive parts first:
- Inbox rendering
- Message lists
- Real-time updates
- Large contact lists
- Campaign tables
- Admin tables
- Dashboard data fetching

Use:
- pagination
- virtualization where actually necessary
- server-side filtering where available
- debounced search
- selective data fetching

Do not prematurely optimize ordinary pages.

---

# 36. Final architectural principle

The product should be replaceable at the UI level without destroying the business layer.

```text
                 PRODUCT UI
                     |
              typed API boundary
                     |
              BUSINESS DOMAIN
                     |
       +-------------+-------------+
       |             |             |
    Database      WhatsApp      Billing
                                  |
                               Razorpay
```

UI changes should not require rewriting billing, WhatsApp integration, or entitlement logic.

Payment-provider changes should not require rewriting the entire application.

Plan/limit changes should not require editing dozens of feature components.
