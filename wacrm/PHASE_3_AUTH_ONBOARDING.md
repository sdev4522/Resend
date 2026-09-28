# Phase 3 — Authentication, Session, Workspace Context & Onboarding

> Documenting the authenticated SaaS architecture, secure session model, role enforcement, and onboarding flow connecting the Next.js frontend to the existing Express/MySQL backend.

---

## 1. Authentication Flow & Security Architecture

### Zero-Client-Token Security (httpOnly Cookies)
In strict compliance with SaaS security standards, **no JWT tokens or secret credentials are ever exposed to client-side JavaScript** or stored in `localStorage`, `sessionStorage`, or `IndexedDB`.

```
Browser Client                     Next.js Route Handlers                 Express Backend
 (React 19 / App Router)            (Server-Side API Proxy)               (Port 3010)
      │                                     │                                  │
      │── 1. POST /api/auth/login ─────────>│                                  │
      │      { email, password, role }      │── 2. POST /api/user/login ──────>│
      │                                     │      (or /api/agent/login)       │
      │                                     │<─ 3. { token: "eyJ..." } ────────│
      │<─ 4. Set-Cookie: wacrm_session ─────│                                  │
      │      (httpOnly, SameSite=Lax)       │                                  │
      │      { success: true, user }        │                                  │
      │                                     │                                  │
      │── 5. GET /api/auth/me ─────────────>│                                  │
      │      (Browser auto-attaches cookie) │── 6. GET /api/user/get_me ───────>│
      │                                     │      Authorization: Bearer <JWT> │
      │                                     │<─ 7. { data: { ...user } } ──────│
      │<─ 8. { success: true, workspace } ──│                                  │
```

### Next.js Route Handlers Created
- [`app/api/auth/login/route.ts`](file:///home/sdev/Projects/wacrm-frontend/app/api/auth/login/route.ts): Handles role-based login (`user`, `agent`, `admin`), stores JWT inside `wacrm_session` httpOnly cookie, and sanitizes user password before returning.
- [`app/api/auth/register/route.ts`](file:///home/sdev/Projects/wacrm-frontend/app/api/auth/register/route.ts): Registers new account via `POST /api/user/signup`, auto-logs the user in, issues the session cookie, and routes directly to `/onboarding`.
- [`app/api/auth/me/route.ts`](file:///home/sdev/Projects/wacrm-frontend/app/api/auth/me/route.ts): Validates session cookie, queries backend for real-time profile, enforces `tokenVersion` validity, and constructs the tenant workspace context.
- [`app/api/auth/logout/route.ts`](file:///home/sdev/Projects/wacrm-frontend/app/api/auth/logout/route.ts): Clears session cookies (`Max-Age=0`) and optionally logs out agent sessions on backend.
- [`app/api/auth/forgot-password/route.ts`](file:///home/sdev/Projects/wacrm-frontend/app/api/auth/forgot-password/route.ts): Proxies password recovery request to `POST /api/user/send_resovery`.
- [`app/api/auth/reset-password/route.ts`](file:///home/sdev/Projects/wacrm-frontend/app/api/auth/reset-password/route.ts): Submits new password to `GET /api/user/modify_password` with recovery token.
- [`app/api/auth/socket-token/route.ts`](file:///home/sdev/Projects/wacrm-frontend/app/api/auth/socket-token/route.ts): Provides short-lived authenticated handshake for real-time Socket.IO connection.
- [`app/api/proxy/[...path]/route.ts`](file:///home/sdev/Projects/wacrm-frontend/app/api/proxy/[...path]/route.ts): Transparent proxy forwarding frontend API requests (`/api/proxy/*` → `http://localhost:3010/api/*`) with injected `Authorization: Bearer <cookieToken>` header.

---

## 2. Session Management & Edge Protection

### Edge Middleware (`middleware.ts`)
The Edge runtime inspects session state before pages render, preventing flash-of-unauthenticated-content:
- **Unauthenticated Users** attempting to access `/dashboard/*`, `/admin/*`, or `/onboarding/*` are intercepted and redirected to `/login?callbackUrl=<pathname>`.
- **Authenticated Users** visiting `/login` or `/register` are redirected to `/dashboard` (or `/admin` for administrators).
- **Role Enforcement at Edge**: Non-admin users attempting to load `/admin/*` are automatically redirected to `/dashboard?error=unauthorized_admin`.

### Global Session Invalidation (`tokenVersion`)
- The backend invalidates sessions by bumping `tokenVersion` on password reset or profile updates.
- If the backend returns `401`, `{ logout: true }`, or `{ msg: "Session expired. Please login again." }`, the proxy automatically deletes the `wacrm_session` cookie and triggers the client `wacrm:unauthorized` event, gracefully steering the user to `/login?error=session_expired`.

---

## 3. User Identity & Workspace Context Architecture

### Auth State Model (`lib/auth/auth-context.tsx`)
Explicit, non-flashing state machine:
- `AUTHENTICATING`: App is resolving initial session from server.
- `AUTHENTICATED`: Valid user and workspace loaded.
- `UNAUTHENTICATED`: No active session.
- `SESSION_EXPIRED`: Backend invalidated token or session timed out.
- `AUTH_ERROR`: Login or registration error.

### Multi-Tenant Workspace Model
- **Workspace Owner (`role: 'user'`)**:
  - `workspace.id`: `user.uid`
  - `workspace.name`: `${user.name}'s Workspace`
  - Full permissions across all CRM tools, templates, broadcasts, and billing.
- **Support Agent (`role: 'agent'`)**:
  - `workspace.id`: `agent.owner_uid` (the workspace they work for)
  - `workspace.name`: `${owner.name}'s Workspace`
  - Scoped permissions restricted to assigned chats, inbox, quick replies, and tasks.
- **Super Administrator (`role: 'admin'`)**:
  - System-wide control panel access.

### Centralized Authorization Gates
Components use centralized authorization helpers rather than dispersed boolean checks:
- `<RoleGate allowedRoles={['admin']}>...</RoleGate>`
- `<PermissionGate permission="inbox">...</PermissionGate>`
- `canAccess('permission')` & `hasRole('role')`

---

## 4. Resumable Onboarding Flow (`/onboarding`)

### Real Backend Integration
The multi-step wizard is backed by real backend capabilities:
1. **Step 1: Workspace Profile**
   - Collects Business Name, Contact Phone, and Operating Timezone.
   - Saves to DB via `POST /api/user/update_profile` (`name, email, mobile_with_country_code, timezone`).
2. **Step 2: WhatsApp Channel Setup**
   - Inspects real instance connection status via `GET /api/qr/get_all`.
   - Explains Baileys QR multi-device vs Meta Cloud API.
   - Allows instant connection or deferred setup.
3. **Step 3: Team Invitation**
   - Invites first customer support agent via `POST /api/agent/add_agent`.
   - Allows seamless skipping if operating solo.
4. **Step 4: Launch Dashboard**
   - Displays workspace confirmation card and transitions user into `/dashboard`.

### Resumability Guarantee
- Onboarding status is derived from real backend state (`user.timezone` and `user.wa_connected`).
- If a user closes the browser or refreshes, the wizard automatically resumes at the appropriate step.

### Mobile UX
- Responsive step indicator and sticky bottom action buttons.
- Touch-friendly input fields with 44px+ touch targets.
- Fully tested for mobile viewports: 320px, 375px, 390px, and 414px without horizontal overflow.

---

## 5. Backend Endpoints Used

| Action | Route Handler | Target Backend Endpoint | Notes |
|---|---|---|---|
| User Login | `/api/auth/login` | `POST /api/user/login` | Returns JWT in cookie |
| Agent Login | `/api/auth/login` | `POST /api/agent/login` | Returns JWT in cookie |
| Admin Login | `/api/auth/login` | `POST /api/admin/login` | Returns JWT in cookie |
| Signup | `/api/auth/register` | `POST /api/user/signup` | Auto-logs in on success |
| Current User | `/api/auth/me` | `GET /api/user/get_me` | Strips hashed password |
| Logout | `/api/auth/logout` | `GET /api/agent/logout` | Clears `wacrm_session` |
| Forgot Password | `/api/auth/forgot-password` | `POST /api/user/send_resovery` | Email recovery link |
| Reset Password | `/api/auth/reset-password` | `GET /api/user/modify_password` | Updates pass & bumps version |
| Update Profile | `/api/proxy/user/update_profile` | `POST /api/user/update_profile` | Updates name, phone, tz |
| Get Instances | `/api/proxy/qr/get_all` | `GET /api/qr/get_all` | WhatsApp connection status |
| Add Agent | `/api/proxy/agent/add_agent` | `POST /api/agent/add_agent` | Adds agent to team |

---

## 6. Discrepancies & Backend Nuances Resolved

1. **Login Failure Format**:
   - Backend returns `{"msg": "Invalid credentials"}` without `success: false`.
   - Handled: The proxy checks both `!data.token` and `data.msg` to ensure 401 is properly returned.
2. **Password Exposure in `get_me`**:
   - Backend queries `SELECT * FROM user` which includes bcrypt password hashes.
   - Handled: The Next.js API layer `/api/auth/me` strips the `password` field before passing data to the client.
3. **Password Recovery Endpoint**:
   - Backend endpoint is spelled `/api/user/send_resovery` and password modification is `GET /api/user/modify_password?pass=...`.
   - Handled: Mapped transparently behind standard RESTful `/api/auth/forgot-password` and `/api/auth/reset-password` routes.

---

## 7. Verification & Test Suite Results

Run command: `node test-phase3-auth.mjs`

```
====================================================
🚀 RUNNING PHASE 3 END-TO-END AUTHENTICATION SUITE
====================================================

✅ [PASS] Edge Middleware: Unauthenticated access to /dashboard redirects to /login
✅ [PASS] Login Failure: Invalid credentials returns 401 with human-readable error
✅ [PASS] Registration: New user registers and receives httpOnly session cookie
✅ [PASS] Current User (/api/auth/me): Validates session and returns workspace context
✅ [PASS] Protected Route with Session: /dashboard is accessible with session cookie
✅ [PASS] Role Guard: Standard user is blocked from /admin and redirected to dashboard
✅ [PASS] Onboarding: Updates profile timezone and details via authenticated API proxy
✅ [PASS] Password Recovery: /api/auth/forgot-password sends recovery request
✅ [PASS] Logout: /api/auth/logout clears session and role cookies
✅ [PASS] Session Invalidation: Invalid cookie returns 401 logout response

====================================================
🏁 TEST SUMMARY: 10 PASSED, 0 FAILED
====================================================
```

- `npm run typecheck`: **0 errors**
- `npm run lint`: **0 errors, 0 warnings**
- `npm run build`: **33/33 static & dynamic routes compiled cleanly**
