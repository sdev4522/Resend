# AI Agent Operating Protocol — WACRM / Resend

> **Target Audience:** All AI coding agents (DeepMind, Claude, GPT, Cursor, Copilot) working in this repository.  
> **Last Verified:** 2026-09-29  
> **Repository Root:** `/home/sdev/Projects/Resend`

---

## 1. Operating Rules & Core Mandates

1. **Read `AGENTS.md` first.** This is the authoritative operating manual for all code and architecture modifications.
2. **Read `docs/PROJECT_STATE.md` second.** It provides the current system status, completed phases, known limitations, and active engineering priorities.
3. **Docs are persistent project memory.** The `docs/` directory is the single source of truth for architecture, API contracts, database schemas, and feature state. It is kept local to avoid noise in remote git commits (`docs/` is in `.gitignore`).
4. **Do NOT scan the entire repository blindly.** Never begin a task by recursively re-analyzing both frontend and backend trees. Use `docs/` as your navigation map.
5. **Inspect source code only where needed.** Check actual implementation files only when documentation is missing, potentially stale, or when implementing specific code changes.
6. **Code is the implementation; docs are the memory.** The working codebase is the ultimate implementation authority. If documentation and working code conflict, verify the code, treat working code as authoritative, and immediately correct the documentation.
7. **Never invent APIs, database tables, or Socket.IO events.** Only use endpoints, database columns, and socket events that are verified in backend code or explicitly documented in `docs/API.md`, `docs/DATABASE.md`, and `docs/SOCKETS.md`.
8. **Never create mock backend behavior.** Real backend controllers, Express routes, and MySQL queries exist for all supported features. Do not stub or fake responses.
9. **Never expose secrets.** Do not log or commit database passwords, JWT secrets, WhatsApp auth credentials, Meta permanent tokens, Razorpay keys, or session secrets.
10. **Preserve tenant boundaries and role enforcement.** Workspace isolation (`uid`) and role checks (`user`, `agent`, `admin`) are enforced in both Next.js middleware and Express backend middleware. Never bypass them.
11. **Update documentation after changes.** Any change to architecture, endpoints, database fields, or feature behavior MUST be documented in the corresponding `docs/` files, `docs/PROJECT_STATE.md`, and `docs/CHANGELOG.md`.
12. **Record architectural decisions.** For non-trivial architectural changes, add an ADR in `docs/decisions/` (`ADR-NNN-title.md`).
13. **Run validation.** After implementation, always run `npm run typecheck`, `npm run lint`, and `npm run build` in `frontend/`, and run relevant regression tests.

---

## 2. Context-Efficient Agent Workflow

```text
PROMPT
  │
  ▼
Read /AGENTS.md
  │
  ▼
Read docs/PROJECT_STATE.md
  │
  ▼
Identify & Read Relevant Feature Doc (docs/features/<feature>.md)
  │
  ▼
Read Relevant Domain Reference (API.md, DATABASE.md, SOCKETS.md, AUTH.md)
  │
  ▼
Targeted Source Code Inspection (only affected files)
  │
  ▼
Implement Minimal, Production-Ready Changes
  │
  ▼
Run Validation (typecheck, lint, build, test scripts)
  │
  ▼
Update Documentation (Feature doc, PROJECT_STATE.md, CHANGELOG.md)
```

---

## 3. Fast Navigation Index

| Topic / Domain | Primary Document | Secondary Reference |
|---|---|---|
| **Current Project State & Active Priorities** | [`docs/PROJECT_STATE.md`](file:///home/sdev/Projects/Resend/docs/PROJECT_STATE.md) | [`docs/README.md`](file:///home/sdev/Projects/Resend/docs/README.md) |
| **System Architecture & Data Flow** | [`docs/ARCHITECTURE.md`](file:///home/sdev/Projects/Resend/docs/ARCHITECTURE.md) | [`docs/BACKEND.md`](file:///home/sdev/Projects/Resend/docs/BACKEND.md) |
| **API Endpoints & Contracts** | [`docs/API.md`](file:///home/sdev/Projects/Resend/docs/API.md) | [`frontend/config/api.ts`](file:///home/sdev/Projects/Resend/frontend/config/api.ts) |
| **Database Schema & Tables** | [`docs/DATABASE.md`](file:///home/sdev/Projects/Resend/docs/DATABASE.md) | [`backend/database/schema.sql`](file:///home/sdev/Projects/Resend/backend/database/schema.sql) |
| **Auth, Cookies & Session Architecture** | [`docs/AUTH.md`](file:///home/sdev/Projects/Resend/docs/AUTH.md) | [`docs/decisions/ADR-001-httponly-cookie-session-architecture.md`](file:///home/sdev/Projects/Resend/docs/decisions/ADR-001-httponly-cookie-session-architecture.md) |
| **Socket.IO & Realtime Events** | [`docs/SOCKETS.md`](file:///home/sdev/Projects/Resend/docs/SOCKETS.md) | [`backend/socket.js`](file:///home/sdev/Projects/Resend/backend/socket.js) |
| **Environment Variables** | [`docs/ENVIRONMENT.md`](file:///home/sdev/Projects/Resend/docs/ENVIRONMENT.md) | `backend/.env.example` / `frontend/.env.example` |
| **Deployment, Nginx & PM2** | [`docs/DEPLOYMENT.md`](file:///home/sdev/Projects/Resend/docs/DEPLOYMENT.md) | [`backend/nginx/api.resend.in.conf`](file:///home/sdev/Projects/Resend/backend/nginx/api.resend.in.conf) |
| **Design System & Styling Tokens** | [`docs/DESIGN_SYSTEM.md`](file:///home/sdev/Projects/Resend/docs/DESIGN_SYSTEM.md) | [`frontend/app/globals.css`](file:///home/sdev/Projects/Resend/frontend/app/globals.css) |
| **Production Audits & Known Bugs** | [`docs/audits/production-audit.md`](file:///home/sdev/Projects/Resend/docs/audits/production-audit.md) | [`docs/PROJECT_STATE.md`](file:///home/sdev/Projects/Resend/docs/PROJECT_STATE.md) |
| **Historical Development Phases** | [`docs/phases/`](file:///home/sdev/Projects/Resend/docs/phases/) | [`docs/CHANGELOG.md`](file:///home/sdev/Projects/Resend/docs/CHANGELOG.md) |
| **Architectural Decisions (ADRs)** | [`docs/decisions/`](file:///home/sdev/Projects/Resend/docs/decisions/) | — |

---

## 4. Key Rules for Specific Features

### A. WhatsApp & Baileys QR
- Baileys socket lifecycle is managed in [`backend/helper/addon/qr/index.js`](file:///home/sdev/Projects/Resend/backend/helper/addon/qr/index.js).
- QR events: `qr_code`, `qr_connected`, `qr_disconnected`, `qr_expired`.
- Never wipe session files during normal Baileys reconnection / restart handshakes.

### B. Onboarding
- Must be concise (Workspace info -> Plan selection -> Finish).
- Plan selection uses live plans from `GET /api/billing/plans`.
- WhatsApp connection and agent invitations are post-onboarding dashboard actions.

### C. Admin Global Theme
- Global theme values map to shadcn semantic CSS variables (not hardcoded hex colors).
- Config is saved in backend (`/api/theme/*`) and enforced via admin authorization (`adminValidator`).
