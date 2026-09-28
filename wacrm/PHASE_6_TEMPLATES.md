# PHASE 6 — WHATSAPP TEMPLATE MANAGEMENT + META SYNC

## Executive Summary

Phase 6 implements the complete WhatsApp Template Management and Meta Cloud API synchronization experience for WACRM. Official WhatsApp message templates are not treated as static local records; they represent synchronized entities with the Meta Graph API (`v20.0` / `v21.0`), governed by official Meta Business Account (WABA) approval statuses.

---

## 1. Template Data Model

The frontend data model adheres strictly to the official Meta Graph API message template specification:

```typescript
export type MetaTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export type MetaTemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';

export type MetaHeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export type MetaButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

export interface MetaTemplate {
  id: string;                      // Meta-assigned numeric string ID
  name: string;                    // Unique template name (lowercase + underscores)
  language: string;                // Language code (e.g. en_US, es_ES, hi)
  status: MetaTemplateStatus;      // Authoritative status from Meta
  category: MetaTemplateCategory;  // Category classification
  components: MetaTemplateComponent[];
  rejected_reason?: string;        // Specific reason if rejected by Meta
  quality_score?: { score: string };
  variables?: MetaTemplateVariable[];
}
```

### Components Supported
1. **HEADER**:
   * Text (`TEXT`) up to 60 characters with optional `{{1}}` parameter.
   * Media (`IMAGE`, `VIDEO`, `DOCUMENT`) with file upload registered via Meta Graph API upload sessions (`example.header_handle`).
2. **BODY**:
   * Text up to 1024 characters supporting numbered variables (`{{1}}`, `{{2}}`).
   * Meta-required sample values formatted under `example.body_text` for submission review.
3. **FOOTER**:
   * Plain text up to 60 characters (e.g., opt-out instructions).
4. **BUTTONS**:
   * Quick Reply (up to 3 interactive reply chips).
   * Call to Action (URL link or phone call action).

---

## 2. Backend Endpoints & Architecture

The Next.js frontend interacts exclusively with the WACRM backend via the Next.js API proxy (`/api/proxy/...`). The browser never directly contacts Meta Graph API, ensuring Meta permanent credentials and access tokens are never exposed to the client.

| Feature | Method | WACRM Endpoint | Target Backend Controller | External Meta Target |
|---|---|---|---|---|
| **Sync / List Meta Templates** | `GET` | `/api/user/get_my_meta_templets_beta` | `routes/user.js:3023` | `GET https://graph.facebook.com/v21.0/${waba_id}/message_templates` |
| **Fallback List** | `GET` | `/api/user/get_my_meta_templets` | `routes/user.js:1112` | `GET https://graph.facebook.com/v20.0/${waba_id}/message_templates` |
| **Create Template** | `POST` | `/api/user/add_meta_templet` | `routes/user.js:1075` | `POST https://graph.facebook.com/v20.0/${waba_id}/message_templates` |
| **Delete Template** | `POST` | `/api/user/del_meta_templet` | `routes/user.js:1144` | `DELETE https://graph.facebook.com/v20.0/${waba_id}/message_templates?name=${name}` |
| **Upload Header Media** | `POST` | `/api/user/return_media_url_meta` | `routes/user.js:1187` | Meta Upload Session API (`/app/uploads`) |
| **Meta WABA Status** | `GET` | `/api/user/get_meta_keys` | `routes/user.js:1059` | `SELECT * FROM meta_api WHERE uid = ?` |
| **Local Quick Replies** | `GET` | `/api/templet/get_templets` | `routes/templet.js:33` | `SELECT * FROM templets WHERE uid = ?` |

---

## 3. Two-Way Synchronization Flow

```
Meta WhatsApp Cloud API
         ▲
         │ (Meta Graph API v20/v21)
         ▼
Express WACRM Backend
  - Validates user JWT & subscription plan
  - Queries `meta_api` table for WABA ID and credentials
  - Calls Meta Graph API endpoint
  - Returns authoritative template array
         ▲
         │ (Next.js Proxy)
         ▼
Next.js Frontend (/dashboard/templates)
  - "Sync with Meta" button triggers live synchronization
  - Displays last synced timestamp
  - Refreshes local state without page reload
```

---

## 4. Status Mapping & Accessible UI

Status badges utilize semantic icons and clear textual badges so status is never conveyed by color alone:
* `✓ APPROVED` (Emerald): Meta-reviewed and available for live broadcasts and outbound campaigns.
* `◌ PENDING` (Amber): Submitted to Meta and currently undergoing automated/manual review.
* `! REJECTED` (Destructive): Rejected by Meta; details dialog renders an alert displaying Meta's specific `rejected_reason`.
* `⏸ PAUSED` (Slate): Quality rating dropped; template temporarily paused by Meta.
* `✕ DISABLED` (Muted): Disabled by Meta policy.

---

## 5. Template Creation Wizard (`/dashboard/templates/new`)

* **Client-Side Pre-Validation**:
  * Enforces template name rules (lowercase letters, numbers, and underscores only).
  * Validates sequential variable numbering (e.g. `{{1}}`, `{{2}}` without gaps).
  * Requires sample/example values for every variable, as enforced by Meta Graph API.
* **Side-by-Side Live WhatsApp Preview**:
  * Features a realistic WhatsApp chat bubble simulation.
  * Dynamically interpolates user variables in real time.
  * Shows delivered checkmarks and timestamp.
* **Header Media Support**:
  * Integrates with `/api/user/return_media_url_meta` to create Meta upload sessions and register media hashes.

---

## 6. Update and Deletion Behaviors

* **Editing Approved Templates**:
  * Meta Graph API does not support in-place modification of approved templates without triggering re-review and possible downtime.
  * In the existing backend, editing is performed by submitting a revised template version or deleting and re-creating.
  * The UI communicates this lifecycle transparently.
* **Template Deletion**:
  * Deletion triggers a shadcn `AlertDialog` confirming that the template will be permanently removed from Meta Business Account.
  * Calls `POST /api/user/del_meta_templet` with `{ name }` to delete the template from Meta Graph API.
  * The frontend automatically re-syncs authoritative state after deletion.

---

## 7. Plan / Entitlement Integration

* Backend route `POST /api/user/add_meta_templet` enforces the `checkPlan` middleware.
* If a tenant does not have an active plan supporting templates or has exceeded limits, the backend returns `{ success: false, msg: "Please subscribe a plan to proceed this." }`.
* The frontend presents clear error notices without breaking the application state.

---

## 8. Webhook & Real-Time Behavior

* **Existing Backend Inspection**: An audit of `routes/inbox.js:321` revealed that the webhook handler currently processes inbound `messages` and `calls`. It does not yet include a case for `message_template_status_update`.
* **Behavior**: Template status updates are synchronized on demand when the user clicks **"Sync with Meta"** or visits the Templates dashboard. Real-time webhook reconciliation is documented as a future backend enhancement.

---

## 9. Verification & Test Results

All Phase 6 capabilities were verified using an automated test suite (`test-phase6-templates.mjs`) against the live backend (`http://localhost:3010`) and frontend (`http://localhost:3000`):

| Test Case | Description | Result |
|---|---|---|
| **User Authentication** | Login and establish session cookie | PASS |
| **Templates Route** | `GET /dashboard/templates` returns 200 OK | PASS |
| **New Template Route** | `GET /dashboard/templates/new` returns 200 OK | PASS |
| **Meta Keys API** | `GET /api/proxy/user/get_meta_keys` returns status | PASS |
| **Meta Templates List** | `GET /api/proxy/user/get_my_meta_templets` handles request cleanly | PASS |
| **Meta Beta List** | `GET /api/proxy/user/get_my_meta_templets_beta` handles request cleanly | PASS |
| **Local Templates** | `GET /api/proxy/templet/get_templets` returns presets | PASS |
| **Payload Validation** | Template payload conforms to Meta Graph API v20/v21 schema | PASS |
| **Entitlement Enforcement** | Backend `checkPlan` middleware enforced on template creation | PASS |
| **Route Security** | Unauthenticated access redirects to `/login` (307) | PASS |
| **TypeScript** | `npm run typecheck` passes with 0 errors | PASS |
| **ESLint** | `npm run lint` passes with 0 errors and 0 warnings | PASS |
| **Production Build** | `npm run build` succeeds (39 static/dynamic routes) | PASS |
