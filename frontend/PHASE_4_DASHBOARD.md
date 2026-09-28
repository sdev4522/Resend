# Phase 4 — User Dashboard, Workspace UI & Core Product Shell

## Overview
Phase 4 implements the authenticated user application shell, dashboard overview, workspace context, and route foundations for the WaCRM platform. In strict accordance with the product specifications:
- **Design Source of Truth**: Aligned with [`akash3444/pure-landing-shadcnui-template`](https://github.com/akash3444/pure-landing-shadcnui-template) and official shadcn/ui primitives. Zero random gradients, glow effects, or decorative blobs.
- **Zero Mock Data**: All displayed dashboard metrics, connection statuses, and limits are fetched directly from real backend APIs. If an API has no recorded data, a clean empty state is shown.
- **Clear Product Boundaries**: Full Inbox (Socket.IO chat), Campaigns, Contacts, Automation, and Billing (Razorpay) belong to subsequent phases and are represented by standardized, honest route placeholders.

---

## 1. Dashboard Architecture & Layout

### Desktop Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│ Sidebar (shadcn)           │ Header                                    │
│  - Brand (WaCRM)           ├───────────────────────────────────────────┤
│  - WorkspaceSwitcher       │ SidebarTrigger | Breadcrumbs | WhatsApp   │
│  - Platform Navigation     │ Status Pill | Notifications | UserNav     │
│    * Overview (/dashboard) ├───────────────────────────────────────────┤
│    * Inbox (/inbox)        │ Main Content                              │
│    * Contacts (/contacts)  │  - DashboardPageHeader                    │
│    * Campaigns             │  - Real WhatsApp Connection Card          │
│    * Templates             │  - Real Stats Grid (4 Cards)              │
│    * Chatbot Rules         │  - Workspace Usage & Limits Foundation    │
│    * Flow Builder          │  - Functional Quick Actions               │
│    * Analytics             │  - Recent Message Activity / Traffic      │
│    * Integrations          │                                           │
│    * Team / Agents         │                                           │
│    * Billing & Plans       │                                           │
│    * Settings              │                                           │
│  - SidebarFooter           │                                           │
└────────────────────────────┴───────────────────────────────────────────┘
```

### Layout Primitives Used
- `SidebarProvider`: Manages collapsible desktop state (`collapsible="icon"`) and responsive mobile drawer.
- `SidebarInset`: Wraps the fixed header and scrolling main content area.
- `DashboardHeader`: Compact 56px header with `SidebarTrigger`, `Breadcrumb`, dynamic WhatsApp connectivity indicator, `NotificationsPopover`, `ThemeToggle`, and `UserNav`.

---

## 2. Route Structure

| Route | Status in Phase 4 | Description & Data Source |
|---|---|---|
| `/dashboard` | **Fully Built** | Main dashboard overview using real backend data from `/api/user/get_dashboard`, `/api/qr/get_all`, `/api/user/get_meta_keys`. |
| `/dashboard/settings` | **Fully Built** | Tabbed settings (Profile, Workspace, Security, Notifications). Profile updates persist via `/api/user/update_profile`. |
| `/dashboard/team` | **Fully Built** | Real agent directory from `/api/agent/get_my_agents`, add agent via `/api/agent/add_agent`, delete via `/api/agent/del_agent`. |
| `/dashboard/inbox` | *Phase 5 Placeholder* | Clean placeholder with header and phase notice. Socket.IO messaging reserved for Phase 5. |
| `/dashboard/contacts` | *Future Placeholder* | Clean placeholder for audience segmentation & phonebook CSV management. |
| `/dashboard/campaigns` | *Future Placeholder* | Clean placeholder for bulk broadcasts. |
| `/dashboard/templates` | *Future Placeholder* | Clean placeholder for Meta Cloud API template definitions. |
| `/dashboard/automation` | *Future Placeholder* | Clean placeholder for keyword auto-replies. |
| `/dashboard/flows` | *Future Placeholder* | Clean placeholder for visual drag-and-drop conversational trees. |
| `/dashboard/analytics` | *Future Placeholder* | Clean placeholder for delivery & response-time analytics. |
| `/dashboard/integrations` | *Future Placeholder* | Clean placeholder for Meta Cloud API & QR instance management. |
| `/dashboard/billing` | *Future Placeholder* | Clean placeholder for subscription tiers and future Razorpay gateway integration. |

---

## 3. Real Backend Integrations & Data Sources

### Dashboard Overview (`/dashboard`)
1. **`GET /api/user/get_dashboard`**:
   - `stats.activeChats`: Count of active unread conversations.
   - `stats.agents`: Count of active workspace agents.
   - `stats.completedTasks`: Count of tasks completed by team members.
   - `stats.activeInstances`: Active Baileys QR sessions.
   - `user.contact`: Total customer contacts stored in phonebooks.
   - `activeChatbots`: Active automated rules deployed.
   - `performanceData`: 7-day breakdown of incoming & outgoing messages.
2. **`GET /api/qr/get_all`**:
   - Returns real Baileys QR instances (`status: 'ACTIVE' | 'INACTIVE'`, phone numbers).
3. **`GET /api/user/get_meta_keys`**:
   - Returns Meta Cloud API credentials (`waba_id`, `phone_number_id`, `token`).

### Real WhatsApp Connection Status Logic
- If any QR instance has `status === 'ACTIVE'`: Marked as **Connected** (`Baileys QR (<phone>)`).
- Else if Meta API keys exist with valid `phone_number_id`: Marked as **Connected** (`Meta Cloud API`).
- Else: Marked as **Disconnected** with a direct CTA button to "Connect WhatsApp" (`/dashboard/integrations`).

### Profile & Settings Persistence (`/dashboard/settings`)
- Submits real mutations to `POST /api/user/update_profile`:
  `{ name, email, mobile_with_country_code, timezone, newPassword? }`.
- Automatically calls `refreshUser()` in `AuthContext` to synchronize updated state across header, sidebar, and workspace switcher without page reloads.

### Team Management (`/dashboard/team`)
- Fetches real agents using `GET /api/agent/get_my_agents`.
- Creates real agents using `POST /api/agent/add_agent`.
- Deletes agents using `POST /api/agent/del_agent`.
- Toggles agent status using `POST /api/agent/change_status_mask`.

---

## 4. Permission-Aware Navigation
Centralized in [`lib/auth/permissions.ts`](file:///home/sdev/Projects/wacrm-frontend/lib/auth/permissions.ts):
- **User / Owner (`role: 'user'`)**: Full access to all workspace features, team management, billing, and settings.
- **Agent (`role: 'agent'`)**: Operational access only (Dashboard, Inbox, Contacts lookup, own Profile). Administrative routes (`/dashboard/team`, `/dashboard/billing`, `/dashboard/integrations`) are hidden from navigation and access-restricted in the UI.
- **Super Admin (`role: 'admin'`)**: Admin access isolated to `/admin` portal.

---

## 5. Mobile Responsiveness & Touch Experience
- **Sidebar on Mobile**: Automatically transforms into a slide-over `Sheet` via shadcn `useIsMobile()`. Navigating closes the sheet automatically.
- **Touch Targets**: All sidebar buttons, header controls, and dialog action buttons meet standard touch target sizes (`h-9` or `h-10`).
- **Zero Horizontal Overflow**: Checked and verified across viewports:
  - 320px (iPhone SE / narrow mobile)
  - 375px (standard mobile)
  - 390px (iPhone 12/13/14)
  - 414px (iPhone Plus)
  - 768px (iPad portrait / tablet)
  - 1024px (iPad landscape / small laptop)
  - 1280px+ (desktop)

---

## 6. Components Created & Refactored

| Component | Path | Description |
|---|---|---|
| `DashboardPageHeader` | `components/dashboard/dashboard-page-header.tsx` | Reusable header with integrated breadcrumbs, title, description, and action buttons. |
| `WorkspaceSwitcher` | `components/dashboard/workspace-switcher.tsx` | Active workspace indicator with plan tier, role badge, and multi-workspace extensible architecture. |
| `NotificationsPopover` | `components/dashboard/notifications-popover.tsx` | Header bell dropdown with accessible unread counter and clean empty state. |
| `DashboardSidebar` | `components/dashboard/sidebar.tsx` | Official shadcn Sidebar with collapsible icon support, brand mark, and permission-aware menu. |
| `DashboardHeader` | `components/dashboard/header.tsx` | App header with trigger, breadcrumbs, live WhatsApp status pill, notifications, and user nav. |
| `DashboardOverview` | `app/dashboard/page.tsx` | Complete overview screen with real backend data, skeletons, connection card, and usage foundation. |
| `SettingsPage` | `app/dashboard/settings/page.tsx` | Tabbed settings with Profile, Workspace, Security, and Notifications. |
| `TeamPage` | `app/dashboard/team/page.tsx` | Team member directory with add agent dialog, delete action, and permission enforcement. |

---

## 7. Quality Audits & Test Results

### Automated Test Suite (`test-phase4-dashboard.mjs`)
```
====================================================
PHASE 4 — USER DASHBOARD & CORE PRODUCT SHELL TESTS
====================================================

✅ [PASS] 1. Unauthenticated /dashboard redirects to /login
✅ [PASS] 2. Unauthenticated /dashboard/settings & /team redirect to /login
✅ [PASS] 3. User session cookie format and role verified
✅ [PASS] 4. Authenticated /dashboard returns HTTP 200 OK with real sections
✅ [PASS] 5. Authenticated /dashboard/settings returns HTTP 200 with tabbed settings
✅ [PASS] 6. Authenticated /dashboard/team returns HTTP 200 with directory
✅ [PASS] 7. Route placeholder /dashboard/inbox returns HTTP 200
✅ [PASS] 7. Route placeholder /dashboard/contacts returns HTTP 200
✅ [PASS] 7. Route placeholder /dashboard/campaigns returns HTTP 200
✅ [PASS] 7. Route placeholder /dashboard/templates returns HTTP 200
✅ [PASS] 7. Route placeholder /dashboard/automation returns HTTP 200
✅ [PASS] 7. Route placeholder /dashboard/flows returns HTTP 200
✅ [PASS] 7. Route placeholder /dashboard/analytics returns HTTP 200
✅ [PASS] 7. Route placeholder /dashboard/integrations returns HTTP 200
✅ [PASS] 7. Route placeholder /dashboard/billing returns HTTP 200
✅ [PASS] 8. Official shadcn Sidebar and SidebarProvider used in layout
✅ [PASS] 9. Header includes SidebarTrigger, Breadcrumbs, and WhatsApp status pill
✅ [PASS] 10. Dashboard contains zero hardcoded mock statistics
✅ [PASS] 11. Centralized permission helper restricts agents from billing/team

====================================================
TOTAL TESTS: 19 | PASSED: 19 | FAILED: 0
====================================================
```

### Phase 3.5 Regression Suite (`test-phase3-5-complete.mjs`)
```
====================================================
TOTAL TESTS: 16 | PASSED: 16 | FAILED: 0
====================================================
```

### Build & Quality Verification
- `npm run typecheck`: **0 errors**
- `npm run lint`: **0 errors, 0 warnings**
- `npm run build`: **Compiled successfully (36/36 static & dynamic routes)**
