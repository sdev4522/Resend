# WACRM SaaS — Product Requirements Specification

## 0. Product goal

Build a production-grade WhatsApp SaaS platform around the existing WACRM backend capabilities while replacing the existing frontend with a new maintainable Next.js application.

Primary stack:
- Next.js
- TypeScript
- Tailwind CSS
- Official shadcn/ui
- Node.js backend
- Existing WACRM backend/business logic reused where practical
- Razorpay as the only initial payment gateway

The system must be designed so additional payment gateways can be added later without redesigning the billing domain.

---

# 1. Core product areas

The product consists of:

1. Public marketing website
2. Authentication
3. Onboarding
4. User workspace/dashboard
5. WhatsApp connection
6. Inbox/messaging
7. Contacts
8. Campaigns/broadcasts
9. Templates
10. Automation
11. Flow builder if supported by backend
12. Analytics
13. Team management
14. Billing
15. Checkout
16. User settings
17. Admin panel
18. SaaS plan/entitlement management
19. Usage/limits
20. Payment/webhook handling

---

# 2. SaaS tenancy

The application must be designed as a multi-tenant SaaS.

Concepts:
- User
- Organization/workspace/tenant
- Membership
- Role
- Subscription
- Plan
- Entitlement
- Usage
- WhatsApp account/connection

Do not hardwire business logic directly to a single user.

All tenant-owned resources must have a reliable ownership boundary.

---

# 3. Roles

Minimum role model:

## Platform Admin
Can manage:
- Users
- Organizations
- Plans
- Entitlements
- Subscriptions
- Payments
- System configuration
- Platform-level monitoring

## Workspace Owner
Can manage:
- Workspace
- Subscription
- Team
- WhatsApp accounts
- Billing
- Settings

## Workspace Admin
Can manage operational workspace features according to permissions.

## Agent/Member
Can access only permitted operational features.

The exact existing backend role system must be mapped during backend analysis before implementation.

---

# 4. Authentication

Requirements:
- Login
- Registration if backend supports it
- Logout
- Session persistence
- Protected routes
- Admin route protection
- Session expiration handling
- Unauthorized handling
- Password recovery if backend supports it

Do not invent authentication behavior until the existing backend is analyzed.

---

# 5. Onboarding

New users should have a guided onboarding flow.

Potential steps:
1. Create workspace
2. Workspace information
3. Connect WhatsApp
4. Configure profile
5. Invite team
6. Select/confirm plan
7. Finish setup

Onboarding must be resumable.

Users should not be forced to repeat completed steps.

---

# 6. WhatsApp connection

The backend's actual WhatsApp integration must be analyzed first.

Frontend requirements:
- Connection status
- Connect
- Reconnect
- Disconnect
- QR/auth state if supported
- Connection error
- Last connected state
- Account metadata where available

Never fake a connected state.

---

# 7. Inbox

Required capabilities where supported by backend:
- Conversation list
- Search
- Unread
- Assignment
- Labels
- Contact details
- Message history
- Send message
- Media
- Templates
- Delivery/read states
- Real-time updates
- Notifications

Use existing socket/WebSocket capabilities where available.

---

# 8. Contacts

Required:
- Contact list
- Search
- Filters
- Contact details
- Tags/labels
- Notes if backend supports them
- Import/export if backend supports them
- Pagination
- Bulk actions where supported

---

# 9. Campaigns/Broadcasts

Required:
- Campaign creation
- Audience selection
- Template selection
- Scheduling
- Status
- Progress
- Results
- Failed messages
- Campaign details
- Usage/limit enforcement

Before allowing creation, validate applicable plan entitlements and usage.

---

# 10. Templates

Required:
- List
- Search/filter
- Create
- Edit
- Preview
- Variables
- Status
- Category
- WhatsApp template integration where backend supports it

---

# 11. Automation

Required:
- Automation list
- Create
- Edit
- Activate/deactivate
- Trigger
- Conditions
- Actions
- Execution status
- Errors/logs where backend supports them

Do not build a visual flow builder based on assumptions. First map the backend automation model.

---

# 12. Analytics

Dashboard analytics should include only metrics actually available from the backend.

Possible:
- Messages sent
- Messages received
- Delivery
- Campaign performance
- Contact growth
- Automation activity
- Usage

Never invent metrics.

---

# 13. SaaS plans

Plans must be data-driven.

Do NOT hardcode plan checks throughout the frontend.

A plan should define configurable entitlements such as:

- Monthly message quota
- Contact quota
- Team member quota
- WhatsApp account quota
- Campaign quota
- Automation quota
- Flow quota
- API access
- Webhook access
- Advanced analytics
- Support level
- Other product capabilities

The exact initial limits/prices can be configured later.

---

# 14. Entitlement system

Every restricted feature must resolve through a centralized entitlement/usage system.

Conceptually:

Feature access:
`hasEntitlement(feature)`

Quantity:
`getLimit(resource)`

Current usage:
`getUsage(resource)`

Remaining:
`getRemaining(resource)`

Do not write:

`if (plan === "business")`

throughout the codebase.

Use capability/entitlement checks.

This makes future plans and pricing changes cheap.

---

# 15. Usage enforcement

There must be two layers:

## Frontend
For UX:
- show current usage
- disable unavailable actions
- show upgrade explanation

## Backend
For security:
- enforce actual limits
- reject over-limit operations
- calculate usage from authoritative data

Frontend checks must never be trusted as security controls.

---

# 16. Limit behavior

When a limit is approaching:

- Show usage meter
- Show warning at configurable threshold
- Explain the resource
- Provide upgrade CTA

When limit is reached:

- Prevent the operation
- Explain exact reason
- Show current usage/limit
- Show reset information if applicable
- Show upgrade option

Do not silently fail.

---

# 17. Plan changes

Support architecture for:
- Upgrade
- Downgrade
- Cancellation
- Renewal/reactivation if applicable
- Plan expiration
- Grace period if business rules support it

Do not assume immediate activation/deactivation until payment/subscription state is verified by backend.

---

# 18. Razorpay

Initial gateway: Razorpay only.

Requirements:
- Create checkout/order through backend
- Open Razorpay checkout on client
- Receive payment result
- Send verification data to backend
- Backend verifies payment
- Backend processes webhook events
- Backend updates subscription/payment state
- Frontend refreshes authoritative subscription state

Never trust only client-side success callbacks.

Never expose:
- Razorpay secret key
- webhook secret
- server credentials

Design the billing domain behind a gateway abstraction so another provider can be added manually later.

Example conceptual interface:

`PaymentGateway`
- createOrder()
- verifyPayment()
- handleWebhook()
- refund() if later required

Only Razorpay implementation is required initially.

---

# 19. Checkout

Checkout must support:

- Plan selection
- Billing period
- Price calculation
- Order creation
- Payment
- Verification
- Success
- Failure
- Cancellation
- Pending verification
- Retry
- Duplicate payment protection
- Subscription activation

The UI must never permanently show a subscription as active until backend state confirms it.

---

# 20. Payment states

Model payment/subscription states explicitly.

Example payment states:
- created
- pending
- processing
- succeeded
- failed
- cancelled
- verification_pending
- verification_failed
- refunded

Example subscription states:
- trialing
- active
- past_due
- cancelled
- expired
- paused
- pending_activation

Only use states that match actual business/backend requirements.

---

# 21. Webhooks

Razorpay webhooks must be treated as authoritative asynchronous events where applicable.

Requirements:
- Signature verification
- Idempotency
- Event logging
- Safe retry handling
- Duplicate event protection
- Subscription/payment reconciliation

Webhook processing must not depend on the browser remaining open.

---

# 22. Billing history

Users should see:
- Payments
- Amount
- Currency
- Date
- Status
- Plan
- Payment/order ID
- Invoice/receipt when available

---

# 23. Admin plan management

Admin should be able to configure:
- Plan name
- Description
- Price
- Billing interval
- Active/inactive
- Entitlements
- Limits
- Feature flags if required

Avoid requiring code deployment for normal plan-limit changes.

---

# 24. Admin user management

Admin requirements:
- User list
- Search
- Filters
- User details
- Workspace details
- Subscription state
- Usage
- Account status
- Relevant actions

Do not expose sensitive credentials.

---

# 25. Mobile requirements

Mobile is a first-class target.

Required:
- Authentication screens
- Onboarding
- Dashboard
- Inbox
- Contacts
- Campaigns
- Templates
- Automation
- Billing
- Settings
- Admin critical workflows

Critical workflows must be fully usable on mobile, not merely visible.

---

# 26. Responsive behavior

Desktop:
- sidebar
- multi-column layouts
- dense tables

Tablet:
- collapsible navigation
- adaptive grids
- reduced density

Mobile:
- drawer navigation
- stacked layouts
- mobile-friendly sheets
- card/list alternatives for tables
- touch-friendly actions

---

# 27. API integration

Create a centralized typed API layer.

Do not scatter endpoint strings through components.

All API calls should have:
- request type
- response type
- error handling
- auth handling
- loading state
- retry behavior where appropriate

Use runtime validation where API uncertainty requires it.

---

# 28. Error handling

Handle separately:
- 400 validation
- 401 unauthenticated
- 403 unauthorized
- 404 not found
- 409 conflict
- 422 business validation
- 429 rate/usage limit
- 500 backend error
- network failure
- payment failure
- WhatsApp connection failure

---

# 29. Security requirements

- No secrets in client bundle
- Backend authorization on every protected operation
- Tenant isolation
- Input validation
- Output sanitization where relevant
- Webhook signature verification
- Payment verification
- Rate limiting where applicable
- Secure session handling
- No sensitive data in logs

---

# 30. Product analytics

If analytics are later added, design events around product behavior:
- onboarding completed
- WhatsApp connected
- campaign created
- campaign sent
- automation activated
- plan viewed
- checkout started
- payment succeeded/failed
- upgrade prompt shown
- limit reached

Do not add analytics before defining privacy and data requirements.

---

# 31. Non-goals for initial version

Do not unnecessarily build:
- Multiple payment gateways
- Complex marketplace
- Native mobile apps
- Advanced AI features unless existing backend already provides them
- Unrequested CRM functionality
- Massive plugin ecosystem

Build the core SaaS reliably first.

---

# 32. Definition of done

A feature is complete only when:
- Backend integration works
- Authorization works
- SaaS entitlements are enforced
- Loading state exists
- Empty state exists
- Error state exists
- Mobile layout works
- Desktop layout works
- TypeScript passes
- Lint passes
- Build passes
- No secrets are exposed
- Relevant documentation is updated
