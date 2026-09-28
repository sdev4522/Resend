# WaCRM Frontend Implementation Plan

> Mapping every backend capability to a Next.js page, component, or API module.
> Backend base URL: `http://localhost:3010` (dev) or `NEXT_PUBLIC_API_URL` env var.

---

## Tech Stack

```
Framework:     Next.js 14+ (App Router)
Language:      TypeScript (strict mode)
Styling:       Tailwind CSS + shadcn/ui
Forms:         react-hook-form + Zod
Real-time:     socket.io-client
Auth:          httpOnly cookies via Next.js API route proxy
HTTP client:   Centralized lib/api/ layer (no raw fetch in components)
```

---

## Project Structure

```
/home/sdev/Projects/wacrm-frontend/
├── app/
│   ├── (marketing)/          Landing page group
│   │   ├── page.tsx          Main landing page
│   │   ├── pricing/page.tsx
│   │   ├── features/page.tsx
│   │   └── ...
│   ├── (auth)/               Auth page group
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── recovery-user/[token]/page.tsx
│   ├── dashboard/            User app
│   │   ├── layout.tsx        Sidebar + header layout
│   │   ├── page.tsx          Dashboard overview
│   │   ├── inbox/page.tsx
│   │   ├── contacts/page.tsx
│   │   ├── campaigns/
│   │   ├── templates/
│   │   ├── automation/
│   │   ├── flows/
│   │   ├── analytics/page.tsx
│   │   ├── integrations/page.tsx
│   │   ├── team/page.tsx
│   │   ├── billing/page.tsx
│   │   └── settings/
│   ├── admin/                Admin panel
│   │   ├── layout.tsx
│   │   ├── page.tsx          Admin overview
│   │   ├── users/page.tsx
│   │   ├── plans/page.tsx
│   │   ├── payments/page.tsx
│   │   ├── whatsapp/page.tsx
│   │   └── settings/
│   └── api/                  Next.js API routes (proxy + auth)
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   └── me/route.ts
│       └── proxy/[...path]/route.ts
├── components/
│   ├── ui/               shadcn/ui components
│   ├── marketing/        Landing page sections
│   ├── dashboard/        Dashboard-specific components
│   ├── inbox/            WhatsApp inbox components
│   ├── campaigns/        Campaign management components
│   ├── automation/       Flow builder components
│   ├── admin/            Admin panel components
│   └── shared/           Reusable across sections
├── lib/
│   ├── api/              Typed API client layer
│   │   ├── client.ts     Base fetch wrapper
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── contacts.ts
│   │   ├── inbox.ts
│   │   ├── campaigns.ts
│   │   ├── templates.ts
│   │   ├── automation.ts
│   │   ├── flows.ts
│   │   ├── agents.ts
│   │   ├── qr.ts
│   │   ├── billing.ts
│   │   ├── admin.ts
│   │   └── web.ts
│   ├── socket/           Socket.IO client + hooks
│   │   ├── client.ts
│   │   └── hooks/
│   ├── auth/             Auth utilities
│   ├── validations/      Zod schemas
│   ├── types/            TypeScript type definitions
│   ├── constants/
│   └── utils/
└── hooks/                React custom hooks
```

---

## Phase 1: Backend Analysis ✅ COMPLETE

See BACKEND_ANALYSIS.md.

---

## Phase 2: Project Setup

**Actions:**
1. Bootstrap: `npx create-next-app@latest wacrm-frontend --typescript --tailwind --app --eslint --src-dir=false`
2. Install shadcn/ui: `npx shadcn@latest init`
3. Install dependencies: `socket.io-client`, `react-hook-form`, `zod`, `@hookform/resolvers`, `date-fns`, `lucide-react`, `sonner`, `next-themes`
4. Configure path aliases in tsconfig.json: `@/*` → `./*`
5. Configure `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` env vars
6. Setup ESLint with strict rules
7. Add `npm run typecheck` script: `tsc --noEmit`

---

## Phase 3: API Client Layer

### lib/api/client.ts

Central fetch wrapper:
- Reads token from httpOnly cookie (via Next.js server-side) or memory (client-side)
- Adds `Authorization: Bearer <token>` header
- Handles `{ success: false }` responses → throws typed errors
- Handles `logout: true` response → clears session and redirects
- Timeout: 15s
- Dev request logging

### API Module Mapping

| Module | Backend endpoints |
|---|---|
| `lib/api/auth.ts` | POST /api/user/login, /signup, /login_with_facebook, /login_with_google, /send_resovery, /check_recovery |
| `lib/api/users.ts` | GET /api/user/get_me, POST /update_profile, /generate_api_key, GET /get_api_key |
| `lib/api/contacts.ts` | All /api/phonebook/* endpoints |
| `lib/api/inbox.ts` | All /api/inbox/* endpoints (HTTP portion) |
| `lib/api/campaigns.ts` | All /api/broadcast/* endpoints |
| `lib/api/templates.ts` | All /api/templet/*, GET /api/user/get_my_meta_templets, POST /add_meta_templet, /del_meta_templet |
| `lib/api/flows.ts` | All /api/chat_flow/* endpoints |
| `lib/api/automation.ts` | All /api/chatbot/* endpoints |
| `lib/api/agents.ts` | All /api/agent/* endpoints |
| `lib/api/qr.ts` | All /api/qr/* endpoints |
| `lib/api/billing.ts` | GET /api/user/get_payment_details, get_plans, get_orders, POST /create_stripe_session, /pay_with_*, /start_free_trial |
| `lib/api/admin.ts` | All /api/admin/* endpoints |
| `lib/api/web.ts` | All /api/web/* endpoints |
| `lib/api/media.ts` | POST /api/user/return_media_url, /return_media_url_meta, /convert_audio |
| `lib/api/meta.ts` | POST /api/user/update_meta, /update_embed_meta, GET /get_meta_keys |

---

## Phase 4: Authentication

### Token flow

```
User submits login form
  → Next.js API route /api/auth/login
    → Proxies to backend POST /api/user/login
    → Gets { success: true, token }
    → Sets httpOnly cookie "wacrm_token"
  → Client redirects to /dashboard

Protected routes:
  → middleware.ts checks httpOnly cookie
  → If missing → redirect to /login
  → If present → pass through
```

### Auth pages

| Page | Route | Backend |
|---|---|---|
| Login | `/login` | POST /api/user/login, admin: POST /api/admin/login |
| Register | `/register` | POST /api/user/signup |
| Forgot password | `/forgot-password` | POST /api/user/send_resovery |
| Recovery | `/recovery-user/[token]` | POST /api/user/check_recovery |

### Middleware (middleware.ts)

- Protect `/dashboard/*` → redirect to `/login` if no token
- Protect `/admin/*` → redirect to `/admin/login` if no admin token
- Separate cookie: `wacrm_user_token` and `wacrm_admin_token`

---

## Phase 5: User Dashboard

### Layout (dashboard/layout.tsx)

- Sidebar (shadcn Sidebar)
- Header with user menu + notifications
- Breadcrumb
- Mobile responsive drawer

### Pages and their data

| Page | Route | Primary API calls |
|---|---|---|
| Dashboard | `/dashboard` | GET /api/user/get_dashboard |
| Inbox | `/dashboard/inbox` | Socket.IO: get_chat_list, load_conversation, send_chat_message |
| Contacts | `/dashboard/contacts` | GET /api/phonebook/get_by_uid, /get_contacts |
| Campaigns | `/dashboard/campaigns` | GET /api/broadcast/get_beta_campaigns |
| Create Campaign | `/dashboard/campaigns/new` | POST /api/broadcast/add_beta_campaign |
| Templates | `/dashboard/templates` | GET /api/user/get_my_meta_templets, /api/templet/get_templets |
| Create Template | `/dashboard/templates/new` | POST /api/user/add_meta_templet |
| Flows | `/dashboard/flows` | GET /api/chat_flow/get_flows_beta |
| Flow Editor | `/dashboard/flows/[id]` | GET /api/chat_flow/get_flow_by_id, POST /insert_flow_beta |
| Automation | `/dashboard/automation` | GET /api/chatbot/get_beta_chatbots |
| Analytics | `/dashboard/analytics` | GET /api/user/get_dashboard |
| Integrations | `/dashboard/integrations` | GET /api/user/get_meta_keys, /api/qr/get_instances |
| Team | `/dashboard/team` | GET /api/agent/get_my_agents |
| Billing | `/dashboard/billing` | GET /api/user/get_plans, /get_payment_details, /get_orders |
| Settings | `/dashboard/settings` | GET/POST /api/user/get_me, /update_profile |

---

## Phase 6: Admin Panel

### Pages and their data

| Page | Route | Primary API calls |
|---|---|---|
| Overview | `/admin` | GET /api/admin/get_users, /get_orders |
| Users | `/admin/users` | GET /api/admin/get_users, POST /update_user, /update_plan, /auto_login |
| Plans | `/admin/plans` | GET /api/admin/get_plans, POST /add_plan, /update_plan_data, /del_plan |
| Payments | `/admin/payments` | GET /api/admin/get_orders, /get_payment_gateway_admin, POST /update_pay_gateway |
| WhatsApp | `/admin/whatsapp` | GET instances across users |
| Settings | `/admin/settings` | GET/POST web_public, web_private, smtp, testimonials, FAQ, pages, brands |

---

## Phase 7: WhatsApp Inbox (Core Feature)

### Component structure

```
components/inbox/
├── InboxLayout.tsx          Three-column layout (list | chat | contact info)
├── ConversationList.tsx     Virtualized list, filters, search
├── ConversationItem.tsx     Single chat row
├── ChatWindow.tsx           Main chat area
├── MessageBubble.tsx        Message rendering per type
├── MessageComposer.tsx      Text, media, template send
├── ContactPanel.tsx         Right panel: contact info, tags, notes, agents
├── ChatFilters.tsx          Origin, status, label, agent filters
└── InboxSearch.tsx          Global search
```

### Socket.IO integration (lib/socket/)

```typescript
// Connection
const socket = io(SOCKET_URL, {
  query: { token: userToken },
  transports: ["websocket"],
})

// Listen
socket.on("chat_list", (data) => ...)
socket.on("load_conversation", (data) => ...)
socket.on("new_message", (data) => ...)
socket.on("request_update_chat_list", () => refetchChatList())
socket.on("request_update_opened_chat", () => refetchConversation())

// Emit
socket.emit("message", { type: "get_chat_list", payload: { limit: 20, offset: 0 } })
socket.emit("message", { type: "load_conversation", payload: { chat } })
socket.emit("message", { type: "send_chat_message", payload: { type, msgCon, chatInfo } })
```

### Chat features

- Paginated conversation list (virtualized, 20 per page)
- Real-time new message insertion
- Message types: text, image, video, audio, document, interactive, template
- Quick-reply templates picker
- Label management (add/remove)
- Agent assignment
- Notes (add/delete)
- Chat export (JSON/CSV)
- AI reply suggestion
- Message translation
- Star/delete messages

---

## Phase 8: Campaigns

### Campaign list page

- Data table: title, status, schedule, delivery stats
- Status badges: QUEUE, SENDING, SENT, FAILED
- Actions: view logs, delete, retry failed

### Create campaign form

```
Template selector (from Meta API)
Audience selector (from phonebooks)
Schedule picker (Calendar + time)
Variable preview
Send button
```

Backend: POST /api/broadcast/add_beta_campaign

### Campaign logs page

- Per-contact delivery status table
- Filter by status (PENDING, SENT, FAILED)
- Retry failed button → POST /api/broadcast/retry_failed

---

## Phase 9: Templates

### Quick-reply templates (/api/templet)

Simple CRUD: title, type, content (JSON). Used in inbox.

### Meta templates (/api/user/get_my_meta_templets)

- Fetched from Meta API, displayed with status (APPROVED/PENDING/REJECTED)
- Create form: name, category, language, components (header/body/footer/buttons)
- Preview panel
- Delete

---

## Phase 10: Automation (Flows + Chatbots)

### Flow list

- Data table of flows with source type
- Create/edit/duplicate/delete
- Source types: wa_chatbot, webhook_flow, telegram_chatbot, etc.

### Flow editor

- Visual node-graph editor (React Flow library)
- Node types: text, image, video, audio, button, list, delay, condition, webhook, AI, custom JS
- Edge connections
- Validation (last node cannot be moveToNextNode type)
- Save → POST /api/chat_flow/insert_flow_beta

### Chatbot assignments

- Assign a flow to an origin (Meta account, QR instance, Telegram, etc.)
- Toggle active/inactive
- One META chatbot per user at a time

---

## Phase 11: Contacts / Phonebook

### Phonebook list

- Cards showing name + contact count
- Create/delete phonebook

### Contact list

- Data table: name, mobile, variables, phonebook
- Import CSV
- Edit/delete
- Contact limit display (from plan)

---

## Phase 12: Integrations Page

### Meta WhatsApp

- Current status (configured/not configured)
- WABA ID, Phone Number ID, App ID form
- OR embedded signup (OAuth flow)
- Webhook URL display: `<BACKURI>/api/inbox/webhook/<uid>`

### QR Instances (Baileys)

- Instance list: title, status, connection state
- Connect new instance → POST /api/qr/gen_qr → Socket.IO QR code display
- Delete/logout instance
- Plan limit display

### Telegram, Instagram, Messenger

- Connection status per integration
- Setup instructions

---

## Phase 13: Billing Page

### Plan display

- Current plan name + expiry
- Feature list
- Days remaining

### Available plans

- Plan cards (from /api/admin/get_plans — public endpoint)
- CTA: Upgrade

### Checkout

- Stripe → create session → redirect
- Razorpay → client-side integration
- PayPal → client-side integration
- Paystack, MercadoPago, Offline → respective flows

### Order history

- Data table: date, method, amount, status

---

## Phase 14: Landing Page

### Sections (all data from public admin endpoints)

- Navbar (shadcn Sidebar/Navigation)
- Hero
- Product preview / screenshot
- WhatsApp features
- Feature grid
- Pricing cards (from /api/admin/get_plans)
- Testimonials (from /api/admin/get_testi)
- FAQ accordion (from /api/admin/get_faq)
- Partner logos (from /api/admin/get_brands)
- CTA
- Footer

### Data fetching strategy

Public endpoints are RSC-compatible — fetch at build time or with revalidation:
- `{ next: { revalidate: 3600 } }` for plans, testimonials, FAQ

---

## Phase 15: TypeScript Types

```typescript
// Core types to define in lib/types/

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  msg?: string;
  logout?: boolean;
}

interface User {
  uid: string;
  name: string;
  email: string;
  mobile_with_country_code: string;
  timezone: string;
  plan: Plan | null;
  plan_expire: string | null;
  trial: number;
  api_key: string | null;
  role: "user";
}

interface Admin {
  uid: string;
  email: string;
  role: "admin";
}

interface Agent {
  uid: string;
  owner_uid: string;
  name: string;
  email: string;
  mobile: string;
  is_active: number;
}

interface Plan {
  id: number;
  title: string;
  price: number;
  price_strike: number;
  plan_duration_in_days: number;
  is_trial: number;
  allow_tag: number;
  allow_note: number;
  allow_chatbot: number;
  contact_limit: number;
  allow_api: number;
  qr_account: number;
  wa_warmer: number;
  instagram_inbox: number;
  telegram_inbox: number;
  allow_wa_forms: number;
}

interface Chat {
  id: number;
  chat_id: string;
  uid: string;
  sender_name: string;
  sender_mobile: string;
  origin: "meta" | "qr" | "instagram" | "telegram" | "messenger";
  last_message: Message | null;
  unread_count: number;
  chat_label: Label[];
  chat_note: Note[];
  assigned_agent: Agent | Agent[] | null;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  chat_id: string;
  uid: string;
  type: string;
  msgContext: Record<string, unknown>;
  timestamp: number;
  senderName: string;
  senderMobile: string;
  route: "INCOMING" | "OUTGOING";
  sentBy: string;
  star: number;
  reaction: string;
  status: string;
  origin: string;
  metaChatId: string;
}

interface Label {
  id: number;
  title: string;
  hex: string;
  show_on_kanban: number;
}

interface Phonebook {
  id: number;
  uid: string;
  name: string;
  contactCount: number;
}

interface Contact {
  id: number;
  uid: string;
  phonebook_id: number;
  name: string;
  mobile: string;
  var1?: string;
  var2?: string;
  var3?: string;
  var4?: string;
  var5?: string;
}

interface Flow {
  flow_id: string;
  uid: string;
  name: string;
  data: { nodes: FlowNode[]; edges: FlowEdge[] };
  source: string;
}

interface Chatbot {
  id: number;
  uid: string;
  source: string;
  title: string;
  flow_id: string;
  origin: Record<string, unknown>;
  origin_id: string;
  active: number;
}

interface Campaign {
  id: number;
  broadcast_id: string;
  uid: string;
  title: string;
  status: "QUEUE" | "SENDING" | "SENT" | "FAILED";
  schedule: string;
}

interface Order {
  id: number;
  uid: string;
  payment_mode: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface QrInstance {
  id: number;
  uid: string;
  uniqueId: string;
  title: string;
  status: "ACTIVE" | "DISCONNECTED" | "CONNECTING";
}
```

---

## Phase 16: Development Commands

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "format": "prettier --write ."
  }
}
```

After every major phase: `npm run typecheck && npm run lint && npm run build`

---

## Phase 17: Important Integration Notes

1. **Do NOT add mock data** — all data must come from real API calls to the backend.
2. **CORS**: New frontend at a different origin must be added to backend's `FRONTENDURI` env var.
3. **Media URLs**: Backend returns absolute URLs like `https://backend.com/media/file.jpg`. Display as-is; do not proxy media through Next.js unless needed.
4. **Socket connection**: Maintain a single socket instance per user session, reconnect on disconnect.
5. **Token rotation**: If backend returns `success: false` with a session-expired message, clear cookie and redirect to login.
6. **Plan errors**: `{ success: false, msg: "Please subscribe a plan..." }` — show upgrade prompt, not generic error.
7. **Agent login**: Agents use `/api/agent/login` not `/api/user/login`. They have a separate `role: "agent"` token with `owner_uid`.
8. **Admin impersonation**: `POST /api/admin/auto_login` returns a user token — store separately to support "admin mode" sessions.
9. **Webhook URLs**: Display to users as `${NEXT_PUBLIC_API_URL}/api/inbox/webhook/${user.uid}`.
10. **API key display**: Mask by default; reveal on button click. Never log in console.
