# WaCRM Backend Analysis

> **Version:** 6.1.0 (env.js)  
> **Package version:** 5.9.8 (package.json)  
> **Runtime:** Node.js (CommonJS, no TypeScript)  
> **Database:** MySQL (mysql2, pool of 200 connections)  
> **Real-time:** Socket.IO v4  
> **WhatsApp integrations:** Meta Cloud API (webhook) + Baileys QR scan

---

## 1. Architecture

```
server.js (Entry point = app.js, both files are identical)
  Express 4 + Socket.IO 4 + express-fileupload
  CORS: hostname-allow-list from FRONTENDURI / BACKURI env
  Static: ./client/public (compiled SPA)
  Media: /media and /meta-media routes with Range support

Routes (REST)  -->  MySQL Pool (database/)
Socket.IO      -->  helper/socket/
Background     -->  loops/ (campaign, qr campaign, baileys warmer)
```

### Startup sequence (server.js)
1. `updateLangJsonFromEnglish()` — syncs missing keys from English.json to other language files
2. `init()` — starts Baileys QR session manager, reconnects persisted sessions
3. `warmerLoopInit()` — WhatsApp number warmer loop (plan-gated)
4. `initCampaign()` — campaign broadcast dispatch loop, 30s interval
5. `initTele()` — Telegram session manager
6. `initQrCampaignLoop()` — QR-based campaign send loop
7. Socket.IO attached to the same HTTP server
8. `nodeCleanup` hook: calls `cleanupTele()` + `cleanup()` on exit

---

## 2. Database

**Technology:** MySQL via mysql2 pool, 200 max connections, charset utf8mb4.  
**Query helper:** `database/dbpromise.js` — `query(sql, params): Promise`

### Tables (inferred from codebase)

| Table | Key columns |
|---|---|
| `user` | uid, name, email, password, mobile_with_country_code, plan (JSON), plan_expire, trial, api_key, timezone, tokenVersion, role |
| `admin` | uid, email, password, role="admin", tokenVersion |
| `agents` | uid, owner_uid, email, password, name, mobile, is_active, tokenVersion |
| `plan` | id, title, short_description, price, price_strike, plan_duration_in_days, is_trial, allow_tag, allow_note, allow_chatbot, contact_limit, allow_api, qr_account, wa_warmer, rest_api_qr, instagram_inbox, telegram_inbox, allow_wa_forms |
| `orders` | id, uid, payment_mode, amount, data, s_token, status, createdAt |
| `meta_api` | uid, waba_id, access_token, business_phone_number_id, app_id, login_type, embed_data |
| `beta_chats` | chat_id, uid, sender_name, sender_mobile, origin, last_message (JSON), unread_count, chat_label (JSON), chat_note (JSON), assigned_agent (JSON), kanban_order, updatedAt, createdAt |
| `beta_conversation` | id, chat_id, uid, type, msgContext (JSON), context (JSON), timestamp, senderName, senderMobile, route, sentBy, star, reaction, status, origin, metaChatId |
| `contact` | id, uid, phonebook_id, phonebook_name, name, mobile, var1-var5 |
| `phonebook` | id, uid, name |
| `broadcast` | id, broadcast_id, uid, title, templet (JSON), phonebook (JSON), status, schedule, timezone |
| `broadcast_log` | uid, broadcast_id, templet_name, sender_mobile, send_to, delivery_status, example (JSON), contact (JSON) |
| `beta_campaign_logs` | meta_msg_id, delivery_status, error_message |
| `beta_api_logs` | msg_id, status, err |
| `templets` | id, uid, title, type, content (JSON) |
| `beta_flows` | flow_id, uid, name, data (JSON: nodes+edges), source |
| `beta_chatbot` | id, uid, source, title, flow_id, origin (JSON), origin_id, active |
| `instance` | uid, status, uniqueId, title |
| `chat_tags` | id, uid, title, hex, show_on_kanban |
| `agent_task` | owner_uid, status |
| `meta_templet_media` | uid, templet_name, meta_hash, file_name |
| `web_public` | app_name, currency_code, exchange_rate, fb_login_app_id, fb_login_app_sec |
| `web_private` | Stripe, PayPal, Razorpay, Paystack, MercadoPago, offline payment keys |
| `smtp` | email, host, port, password, username |
| `partners` | id, filename |
| `faq` | id, question, answer |
| `page` | id, slug, title, image, content, permanent |
| `testimonial` | id, title, description, reviewer_name, reviewer_position |
| `chats` | LEGACY — chat_id, uid, chat_status, chat_note, chat_tags |

> **Warning:** `chats` and `chatbot` are legacy tables. Production uses `beta_chats`, `beta_conversation`, and `beta_chatbot`.

---

## 3. Authentication

**Mechanism:** JWT Bearer tokens — `Authorization: Bearer <token>` header

### JWT payloads

```json
// User
{ "uid": "<randomstring>", "role": "user", "tokenVersion": 0 }

// Agent
{ "uid": "<randomstring>", "role": "agent", "owner_uid": "<uid>", "tokenVersion": 0 }

// Admin
{ "uid": "<randomstring>", "role": "admin", "email": "...", "tokenVersion": 0 }
```

- **Secret:** `process.env.JWTKEY`
- **Expiry:** User/Agent tokens expire in 7d. Admin tokens have **no expiry**.
- **Invalidation:** `tokenVersion` in DB. Incrementing it on password change rejects old tokens.

### Middleware chain

1. `middlewares/user.js` — `validateUser`: verifies role=user, DB lookup, attaches `req.decode`
2. `middlewares/agent.js` — `validateAgent`: verifies role=agent, checks is_active, attaches `req.decode` + `req.owner`
3. `middlewares/admin.js` — `adminValidator`: verifies role=admin
4. `middlewares/plan.js` — `checkPlan`: verifies active non-expired plan, attaches `req.plan`

### Plan-gating middlewares

- `checkContactLimit` — plan.contact_limit
- `checkNote` — plan.allow_note
- `checkTags` — plan.allow_tag
- `checkWaWArmer` — plan.wa_warmer
- `checkQrScan` — plan.qr_account with instance count check
- `checkTeleInbox` — plan.telegram_inbox
- `checkInstaInbox` — plan.instagram_inbox
- `checkWaForms` — plan.allow_wa_forms

### API key auth (for /api/v1 and /api/qr)

`?token=<api_key>` query parameter. Verified as valid JWT AND must match `user.api_key` in DB.

### Social login

- `POST /api/user/login_with_facebook` — validates via Graph API
- `POST /api/user/login_with_google` — validates via googleapis.com/oauth2/v3/userinfo

---

## 4. API Route Inventory

### /api/user (routes/user.js — 3900 lines)

**Public**

| Method | Endpoint | Description |
|---|---|---|
| POST | /signup | Register (email, name, password, mobile, acceptPolicy) |
| POST | /login | Login → { success, token } |
| POST | /login_with_facebook | Facebook OAuth |
| POST | /login_with_google | Google OAuth |
| POST | /send_resovery | Send recovery email |
| POST | /check_recovery | Validate recovery token |
| GET | /stripe_payment | Stripe callback redirect |
| GET | /paystack_payment | Paystack callback |
| GET | /mercadopago_payment | MercadoPago callback |

**Protected (validateUser)**

| Method | Endpoint | Description |
|---|---|---|
| GET | /get_me | Profile + addon list + contact count |
| POST | /update_profile | Name, email, password, mobile, timezone |
| POST | /return_media_url | Upload file → URL (ffmpeg audio conversion optional) |
| POST | /convert_audio | Convert audio to MP3 |
| POST | /save_note | Save chat note (+ checkNote) |
| POST | /push_tag | Add tag to chat (+ checkTags) |
| POST | /del_tag | Delete tag |
| POST | /check_contact | Check contact in phonebook |
| POST | /save_contact | Add contact (+ checkContactLimit) |
| POST | /del_contact | Delete contact |
| POST | /update_meta | Save WhatsApp Cloud API credentials |
| POST | /update_embed_meta | Save embedded signup Meta credentials |
| GET | /get_meta_keys | Get Meta API credentials |
| POST | /add_meta_templet | Create Meta template |
| GET | /get_my_meta_templets | Fetch templates from Meta API |
| POST | /del_meta_templet | Delete Meta template |
| POST | /return_media_url_meta | Upload media for Meta template + hash |
| POST | /get_plan_details | Get plan by ID |
| GET | /get_payment_details | Get payment gateway info |
| POST | /create_stripe_session | Create Stripe checkout session |
| POST | /pay_with_rz | Razorpay payment |
| POST | /pay_with_paypal | PayPal payment |
| POST | /pay_with_paystack | Paystack payment |
| POST | /pay_with_mercadopago | MercadoPago payment |
| POST | /pay_offline | Offline/manual payment |
| POST | /start_free_trial | Activate trial plan |
| GET | /get_dashboard | Stats: agents, unread, instances, performance |
| POST | /generate_api_key | Generate new API key |
| GET | /get_api_key | Get API key |
| GET | /get_orders | User payment history |
| GET | /get_plans | All plans |

### /api/admin (routes/admin.js — 2012 lines)

**Public**

| Method | Endpoint | Description |
|---|---|---|
| POST | /login | Admin login (no expiry JWT) |
| GET | /get_plans | Plans list |
| GET | /get_web_public | Public site settings |
| GET | /get_brands | Partner logos |
| GET | /get_faq | FAQ items |
| GET | /get_testi | Testimonials |
| GET | /get_pages | CMS pages |

**Protected (adminValidator)**

| Method | Endpoint | Description |
|---|---|---|
| POST | /add_plan | Create plan |
| POST | /update_plan_data | Update plan |
| POST | /del_plan | Delete plan |
| GET | /get_users | All users |
| POST | /update_user | Edit user |
| POST | /update_plan | Assign plan to user |
| GET | /get_payment_gateway_admin | Payment keys |
| POST | /update_pay_gateway | Save payment credentials |
| POST | /add_brand_image | Upload partner logo |
| POST | /del_brand_logo | Delete partner logo |
| POST | /add_faq | Add FAQ |
| POST | /del_faq | Delete FAQ |
| POST | /add_page | Add CMS page |
| POST | /del_page | Delete CMS page |
| POST | /auto_login | Impersonate user (returns user JWT) |
| POST | /add_testimonial | Add testimonial |
| POST | /del_testi | Delete testimonial |
| GET | /get_orders | All orders with user join |
| GET | /get_smtp | SMTP settings |
| POST | /update_smtp | Save SMTP |
| POST | /update_web_public | Update site settings |
| GET | /get_web_private | Private settings |
| POST | /send_fcm_notification | Firebase push broadcast |

### /api/phonebook

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /add | user+plan+contactLimit | Create phonebook |
| GET | /get_by_uid | user | List phonebooks + contact counts |
| PUT | /edit_contact | user | Edit contact |
| POST | /del_phonebook | user | Delete phonebook |
| POST | /add_contact | user+plan+contactLimit | Add single contact |
| GET | /get_contacts | user | Contacts by phonebook ID |
| POST | /del_contacts | user | Delete contacts by IDs |
| POST | /import_csv | user | Import CSV |
| POST | /del_all_contacts | user | Clear phonebook |

### /api/broadcast

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /add_new | user+plan | Create Meta campaign |
| GET | /get_broadcast | user | List campaigns |
| POST | /del_broadcast | user | Delete campaign |
| POST | /get_broadcast_log | user | Delivery logs |
| GET | /get_beta_campaigns | user | Beta/Meta campaigns |
| POST | /add_beta_campaign | user+plan | Create campaign |
| POST | /del_beta_campaign | user | Delete |
| GET | /get_campaign_logs | user | Campaign logs |
| POST | /retry_failed | user | Retry failed messages |

### /api/inbox

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /embed/webhook/:uid | none | Meta webhook verification |
| POST | /embed/webhook/:uid | none | Meta webhook receiver (global embed) |
| POST | /webhook/:uid | none | Meta webhook per-user |
| POST | /send_message | user | Send via inbox |
| POST | /mark_read | user | Mark as read |
| POST | /assign_agent | user | Assign agent |
| GET | /get_chat_info | user | Chat metadata |
| POST | /update_chat_status | user | Update chat status |

### /api/templet

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /add_new | user+plan | Add quick-reply template |
| GET | /get_templets | user | All templates |
| POST | /del_templets | user | Delete templates |

### /api/chatbot

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /add_beta_chatbot | user+plan | Assign chatbot to origin |
| GET | /get_beta_chatbots | user | List by source type |
| POST | /change_beta_bot_status | user | Toggle active |
| POST | /del_beta_chatbot | user | Delete |

### /api/chat_flow

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /insert_flow_beta | user+plan | Create/update flow |
| GET | /get_flows_beta | user | List flows |
| POST | /del_flow_beta | user | Delete flow |
| POST | /duplicate_flow | user | Duplicate flow |
| GET | /get_flow_by_id | user | Single flow |

### /api/agent

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /add_agent | user+plan | Create agent |
| GET | /get_my_agents | user | List agents |
| POST | /update_agent | user | Update agent |
| POST | /del_agent | user | Delete agent |
| POST | /toggle_agent | user | Enable/disable |
| POST | /login | none | Agent login |
| GET | /get_me | agent | Agent profile |
| POST | /update_profile | agent | Update agent profile |
| POST | /get_tasks | agent/user | Get tasks |
| POST | /add_task | user | Create task |
| POST | /complete_task | agent | Mark complete |

### /api/qr

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /gen_qr | user+plan+qrScan | Create Baileys instance + QR |
| GET | /get_instances | user | List instances |
| POST | /del_instance | user | Delete + cleanup session |
| POST | /logout_instance | user | Logout instance |
| POST | /send_message | api_key | Send via QR instance |
| GET | /get_qr_status | user | Connection status |

### /api/v1 (Public REST API)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /send-message | ?token=api_key | Send via Meta |
| POST | /send-template | ?token=api_key | Send Meta template |
| GET | /get-contacts | ?token=api_key | Get contacts |
| GET | /get-phonebooks | ?token=api_key | Get phonebooks |

### Other routes

- `/api/web` — translations, install wizard, addons list, license check
- `/api/ai` — AI features (plan-gated, AI_BOT addon)
- `/api/kaban` — Kanban board (move cards, get board)
- `/api/waform` — WhatsApp Forms (plan-gated)
- `/api/qr_campaign` — Campaigns via Baileys
- `/api/telegram` — Telegram inbox
- `/api/insta` — Instagram DM inbox
- `/api/messenger` — Facebook Messenger inbox
- `/api/wa_call` — WhatsApp Calls via Meta
- `/api/theme` — UI theme / landing page customization
- `/api/webhook` — Minimal webhook pass-through

---

## 5. WhatsApp Integration

### Mode A: Meta Cloud API

- Credentials stored in `meta_api` table (waba_id, access_token, business_phone_number_id, app_id)
- Login types: "manual" or "embed" (embedded signup)
- Graph API version: v20.0 / v21.0
- Incoming: Meta Webhooks → `/api/inbox/webhook/:uid` and `/api/inbox/embed/webhook/:uid`
- Webhook handles: messages, status updates (sent/delivered/read/failed), call events
- Templates created and synced via Meta Graph API

### Mode B: Baileys (QR Scan)

- Package: `baileys@7.0.0-rc14` (WhatsApp Web protocol)
- Session persistence: `mysql-baileys` (MySQL-backed auth state)
- Each user can have multiple instances (plan.qr_account limit)
- Flow: POST /api/qr/gen_qr → createSession() → Baileys emits QR via Socket.IO → user scans → session stored in MySQL
- Sessions reconnect automatically on server restart
- Warmer loop keeps sessions alive

---

## 6. Messaging Architecture

### Outgoing (from `helper/socket/function.js`)

- `sendMetaMsg()` — Meta Cloud API
- `sendQrMsg()` — Baileys
- `sendInstaMsg()` — Instagram
- `sendMessengerMsg()` — Facebook Messenger
- `sendMessageTelegram()` — Telegram

Message types: text, image, video, audio, document, interactive (button/list), template, location, sticker, reaction

### Incoming

Meta webhook → `processMessage()` in `helper/inbox/inbox.js`
Baileys event → same `processMessage()`

processMessage saves to `beta_conversation`, updates `beta_chats`, increments unread_count, triggers chatbot flow if active, emits `new_message` via Socket.IO

### Storage model

```
beta_chats:        one row per unique sender×user pair (chat session)
beta_conversation: one row per message, linked to beta_chats.chat_id
```

---

## 7. Socket.IO Events

**Connection:** `?token=<JWT>` in handshake query string

### Server → Client

| Event | Description |
|---|---|
| `connection_ack` | Successful connection confirmation |
| `chat_list` | Paginated chat list response |
| `load_conversation` | Messages + chat info + labels + agents |
| `export_chats_result` | CSV/JSON export |
| `export_conversation_result` | Conversation export |
| `update_labels` | Labels list updated |
| `request_update_opened_chat` | Signal to reload open chat |
| `request_update_chat_list` | Signal to reload chat list |
| `new_message` | Incoming message notification |
| `qr_code` | QR code base64 for scanning |
| `qr_connected` | Session authenticated |
| `qr_disconnected` | Session disconnected |
| `error` | Error message |

### Client → Server (all via `socket.emit("message", { type, payload })`)

| type | Description |
|---|---|
| `get_chat_list` | Paginated chats with filters: search, origin, unreadOnly, assignedOnly, dateRange, limit, offset, filterType, hasNote, statusFilter, agentFilter, labelFilter |
| `export_chats` | Export chats as JSON or CSV |
| `export_conversation` | Export conversation messages |
| `load_conversation` | Load messages with filters (search, dateRange, pagination) |
| `add_label` | Create label |
| `on_label_delete` | Delete label |
| `set_chat_label` | Assign label to chat |
| `remove_chat_label` | Remove label from chat |
| `save_chat_note` | Add note to chat |
| `delete_chat_note` | Delete note |
| `send_chat_message` | Send message (dispatches by origin: meta/qr/instagram/messenger/telegram) |
| `send_template_to_conversation` | Send and log Meta template message |
| `assign_agent` | Assign/unassign agent |
| `delete_message` | Delete message |
| `star_message` | Star/unstar message |
| `forward_message` | Forward to another contact |
| `suggest_reply` | AI reply suggestion (OpenAI/Gemini/DeepSeek) |
| `translate_message` | Translate message (OpenAI/Gemini/DeepSeek) |

---

## 8. Automation / Flows

### Flow Builder

- Flows stored as `{ nodes: [...], edges: [...] }` JSON in `beta_flows.data`
- Source types: wa_chatbot, webhook_flow, webhook_automation, telegram_chatbot, instagram_chatbot, instagram_comment, messenger_chatbot
- Node types: text, image, video, audio, document, button, list, delay, condition, webhook call, AI response, custom JS (VM2), carousel template, catalog template
- Validation: last node cannot be a "move to next" type

### Chatbot Engine

- `beta_chatbot` row links a flow to an origin (Meta, QR, Telegram, etc.)
- Activated when incoming message arrives for that origin
- Executed via `helper/chatbot/`
- Session-state tracks current node per conversation

### Campaign Loop (loops/campaignBeta.js)

- Polls every 30 seconds for broadcast rows with status=QUEUE and schedule<=NOW()
- Batch size: 20, message delay: 800ms, max retries: 3
- Sends via Meta API sendTemplateMessage()
- Updates broadcast_log delivery_status
- Marks campaign SENT or FAILED

### QR Campaign Loop (loops/qrCampaignLoop.js)

- Same pattern but uses Baileys sessions

---

## 9. File / Media Handling

- Upload: `POST /api/user/return_media_url` (multipart/form-data, field: `file`)
- Allowed types: jpeg, png, webp, gif, mp4, mp3, ogg, wav, pdf, json, webm
- Saved to: `./client/public/media/<randomstring>.<ext>`
- Audio conversion (fluent-ffmpeg + ffmpeg-static):
  - `convert=YES&target=baileys` → .ogg (Opus 48kHz mono 64kbps)
  - `convert=YES&target=meta` → .mp3 (128kbps)
- URL format: `${FRONTENDURI}/media/<filename>`
- Media served with Range/streaming support + 1-year cache
- Meta uploads: upload to Meta Graph API → get media hash for templates

---

## 10. Admin Functionality

- Separate JWT (role=admin, no expiry)
- User management: list, update, force plan assign, impersonate
- Plan CRUD
- Payment gateway config
- CMS: pages, FAQ, testimonials, partner logos
- SMTP config
- Firebase push notification broadcast
- Orders/payment history

---

## 11. Payments / Billing

| Gateway | Flow |
|---|---|
| Stripe | Backend creates session → redirect → `/api/user/stripe_payment` callback → verify → activate |
| Razorpay | Client captures → POST rz_payment_id → backend verifies → activate |
| PayPal | Client creates order → POST orderID → backend verifies via PayPal sandbox → activate |
| Paystack | Redirect → `/api/user/paystack_payment` callback |
| MercadoPago | Creates preference → callback |
| Offline | Manual submission → admin approval |
| Trial | One-time free trial per user |

Plan activation = `updateUserPlan()` in functions/function.js → sets user.plan (JSON) + user.plan_expire

---

## 12. Environment Variables

```env
PORT=8001
DBHOST=localhost
DBNAME=db_name
DBUSER=db_user
DBPASS=db_password
DBPORT=3306
JWTKEY=<long random secret>
FRONTENDURI=https://domain.com    # Used for media URLs, CORS, password recovery links
BACKURI=https://domain.com        # Used for CORS, Stripe redirect URLs
STRIPE_LANG=en
NODE_ENV=logs                     # "logs" enables console output
```

Payment gateway credentials (Stripe, PayPal, etc.) are stored in the `web_private` DB table, not in .env.

---

## 13. Third-Party Integrations

| Integration | Package | Usage |
|---|---|---|
| Meta WhatsApp Cloud | node-fetch / axios | Messages, templates, webhooks |
| Baileys | baileys@7.0.0-rc14 | QR scan WA sessions |
| Telegram | telegram@2.26.22 | Telegram inbox |
| Instagram/Messenger | Meta Graph API | DM inbox |
| Google AI (Gemini) | @google/generative-ai | AI chatbot / reply suggest |
| ElevenLabs | @elevenlabs/elevenlabs-js | Voice/TTS |
| Firebase | firebase-admin | FCM push notifications |
| Stripe | stripe@12 | Payments |
| MercadoPago | mercadopago@3 | LATAM payments |
| FFmpeg | ffmpeg-static, fluent-ffmpeg | Audio conversion |
| VM2 | vm2@3.10.2 | Custom JS sandbox in flows |
| Sharp | sharp@0.32.6 | Image processing |

---

## 14. Technical Debt & Risks

### DANGEROUS — Do Not Touch

1. `loops/campaignBeta.js` — Core campaign dispatch. Changes can cause duplicate sends or message loss.
2. `helper/addon/qr/` — Baileys session management. Touching this can disconnect live WA sessions for all users.
3. `database/config.js` — MySQL pool. Altering charset or pool size can corrupt data.
4. `helper/inbox/inbox.js` — Message processing pipeline. Saves messages, triggers chatbots.
5. `user.tokenVersion` — Breaking this logic locks users out or fails to invalidate tokens.
6. `beta_chats` and `beta_conversation` — Production data. Never alter schema without a backup.

### Known Issues

1. `server.js === app.js` — Both files are byte-identical. Only server.js is used.
2. Admin JWT has no expiry — security risk.
3. Recovery token includes bcrypt hash in payload — unnecessary.
4. PayPal uses `api.sandbox.paypal.com` hardcoded — must use production URL in prod.
5. Socket.IO CORS is `origin: "*"` — allows all WebSocket origins.
6. VM2 is considered unmaintained with known security vulnerabilities.
7. Legacy `chats` and `chatbot` tables still exist alongside `beta_*` tables.
8. Response message typos: "Phonebook was addedd", "Contact(s) was deleted" (in templets).
9. All socket events use a single "message" event envelope — harder to type in frontend clients.
10. Routes/user.js is 3900 lines, routes/admin.js is 2012 lines — massive unmaintained files.
11. No input validation library (no Joi/Zod) — all manual checks.
12. No rate limiting middleware.

---

## 15. Frontend Integration Strategy

### Critical rules for the new Next.js frontend

1. Use `Authorization: Bearer <token>` header for all protected endpoints.
2. Use `?token=<JWT>` in Socket.IO handshake query (not auth object).
3. JWT is returned as `{ success: true, token: "..." }` from login. Store in httpOnly cookies via Next.js API route proxy — NOT localStorage.
4. All API responses follow `{ success: boolean, data?: any, msg?: string }` — handle success:false everywhere.
5. Check for `logout: true` in responses — admin middleware sends this on token failure; clear session.
6. Media URLs are absolute strings built from `${FRONTENDURI}/media/<filename>` — handle cross-origin.
7. Socket event envelope: emit `("message", { type: "get_chat_list", payload: {...} })`, listen on specific event names.
8. NEVER modify `/api/inbox/webhook/:uid` — live Meta webhook receiver for production traffic.
9. Plan features are enforced server-side — frontend shows UI state but must handle plan error responses.
10. These endpoints require NO auth (safe for landing page): `/api/admin/get_plans`, `/api/admin/get_web_public`, `/api/admin/get_testi`, `/api/admin/get_faq`, `/api/admin/get_brands`.
