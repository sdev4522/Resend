# Phase 6.5 Documentation — Complete Templates + Contacts + Campaigns

## Overview of Implementation

Phase 6.5 completes the core messaging capabilities of WACRM across three major domains:
1. **WhatsApp Template Builder Completion**: Upgraded the dynamic button builder (Quick Replies, URL, and Phone Number actions), body variable interpolation (`{{1}}`, `{{2}}`), formatting helpers (`*bold*`, `_italic_`, `~strike~`, `mono`), live WhatsApp preview synchronization, and dedicated template detail view (`/dashboard/templates/[name]`).
2. **Contacts & Phonebook Engine**: Fully implemented customer directory at `/dashboard/contacts` connected to MySQL `contact` and `phonebook` tables, supporting audience list filtering, search, contact CRUD, bulk selection, CSV import with validation reporting, and CSV export.
3. **Broadcast Campaigns**: Fully implemented campaign management at `/dashboard/campaigns`, wizard at `/dashboard/campaigns/new`, and campaign analytics/logs at `/dashboard/campaigns/[id]`, strictly relying on the authoritative backend background dispatcher (`loops/campaignBeta.js`) and Meta webhook delivery updates (`routes/inbox.js`).

---

## 1. Part A: Complete WhatsApp Template Builder

### 1.1 Button Builder
- **Category Selection**: `NONE`, `QUICK_REPLY`, or `CALL_TO_ACTION`.
- **Quick Reply Buttons**:
  - Allows up to 3 quick reply chips per Meta template specification.
  - Controls: Add button (capped at 3), Reorder (Move Up / Down), Remove.
  - Validation: Button label required, max 25 characters, duplicate button labels rejected.
- **Call-to-Action Buttons**:
  - Allows up to 2 total CTA buttons: at most 2 URL buttons, or 1 URL + 1 Phone Number button (Meta constraint).
  - URL Button: Web address validation (must start with `http://` or `https://`).
  - Phone Number Button: International E.164 phone number validation (`+` followed by country code and digits).
  - Controls: Add Website Link, Add Phone Call, Reorder (Move Up / Down), Remove.

### 1.2 Body Variables & Formatting
- **Auto-detection**: Automatically parses `{{1}}`, `{{2}}`, etc. from the body text and ensures strictly sequential indexing starting at 1.
- **Sample Values**: Provides individual input fields for each detected variable, required by Meta Graph API for template review submission (`example.body_text`).
- **Formatting Toolbar**: Quick action buttons to insert WhatsApp Markdown syntax (`*bold*`, `_italic_`, `~strikethrough~`, `monospace`), and insert next sequential variable tag `{{n}}`.
- **Preview Interpolation**: Live WhatsApp chat bubble automatically replaces variable tokens with user-supplied sample values in real time.

### 1.3 Supported Headers
- `NONE`: Text-only message body.
- `TEXT`: Single-line bold headline (up to 60 characters).
- `IMAGE` / `VIDEO` / `DOCUMENT`: Media headers integrated with backend endpoint `POST /api/user/return_media_url_meta` for sample file upload to Meta Resumable Upload API.

### 1.4 Template Detail View
- Location: `/dashboard/templates/[name]`
- Displays complete Meta metadata (Category, Language, Meta ID, Status badge, Rejection reason if rejected).
- Component breakdown: Header, Body, Footer, Interactive Buttons.
- Interactive variable testing sandbox for immediate preview simulation.
- Permanent deletion from Meta Cloud API via confirmation `AlertDialog`.

---

## 2. Part B: Contacts & Phonebooks

### 2.1 Backend Contract Integration
All contacts operations connect to authoritative Express routes in `routes/phonebook.js`:
- `GET /api/phonebook/get_uid_contacts`: Server-side paginated contacts query supporting search (by name or mobile) and phonebook filtering.
- `GET /api/phonebook/get_by_uid`: Retrieves all phonebook groups belonging to the tenant with real-time `contactCount`.
- `POST /api/phonebook/add`: Creates a new audience group (`{ name }`).
- `POST /api/phonebook/del_phonebook`: Deletes a phonebook group and cascades deletion to all contained contacts.
- `POST /api/phonebook/add_single_contact`: Inserts single contact with `phonebook_id`, `name`, `mobile`, and custom variables `var1`–`var5`.
- `PUT /api/phonebook/edit_contact`: Updates contact attributes.
- `POST /api/phonebook/del_contacts`: Bulk deletes contacts by ID array (`{ selected: [id1, id2, ...] }`).
- `POST /api/phonebook/import_contacts`: Multipart CSV file upload, validates numbers, and returns inserted count and invalid row list.
- `GET /api/phonebook/export_contacts_csv`: Direct CSV file download.

### 2.2 Contacts UI Features
- **Phonebook Sidebar**: Quick selector for audience segments with live recipient counts.
- **Debounced Search**: Instant searching across customer name and phone numbers.
- **Custom Variables**: Visual badges for `var1` (e.g. Order ID), `var2` (e.g. Delivery Date), and additional campaign metadata.
- **Bulk Selection**: Select-all checkbox and batch deletion with confirmation `AlertDialog`.
- **Responsive Layout**: Full data table on desktop, stacked card layout on mobile viewports.

---

## 3. Part C: Broadcast Campaigns

### 3.1 Backend Campaign Architecture
- Database tables: `beta_campaign` (campaign metadata and delivery counters) and `beta_campaign_logs` (per-recipient message status).
- Execution: Express background daemon (`loops/campaignBeta.js`) polls `beta_campaign` where `status = 'PENDING'` and `schedule <= NOW()`.
- Dispatch: Batches recipient messages through Meta Cloud API, sets status to `IN_PROGRESS`, records Meta Message IDs, and updates counters (`sent_count`, `failed_count`).
- Status Tracking: Inbound Meta webhooks (`routes/inbox.js`) match `meta_msg_id` and update delivery status (`delivered`, `read`).
- Campaign Completion: Once all logs are processed, backend marks campaign `status = 'COMPLETED'`.

### 3.2 Campaign Creation Flow (`/dashboard/campaigns/new`)
1. **Title & Audience**: Set campaign name and select target phonebook (displays audience count).
2. **Template Selection**: Loads approved Meta templates (`status === 'APPROVED'`), displaying language and category.
3. **Variable Mapping**:
   - For each detected positional placeholder (`{{1}}`, `{{2}}`), user maps either a dynamic contact attribute:
     - `{{{name}}}` (Contact Name)
     - `{{{mobile}}}` (Contact Mobile)
     - `{{{var1}}}` through `{{{var5}}}` (Custom fields)
   - Or specifies a static custom string.
4. **Scheduling**:
   - "Send Immediately" (dispatches to queue immediately).
   - "Schedule for Later" (datetime picker with local timezone resolution).
5. **Live Preview**: Dynamic message bubble rendering with sample recipient values.
6. **Submission**: Dispatches `POST /api/broadcast/create_template_campaign` with transactional log generation.

### 3.3 Campaign Analytics & Logs (`/dashboard/campaigns/[id]`)
- **KPI Metrics Cards**: Total Audience, Dispatched (`sent_count` + %), Delivered (`delivered_count` + %), Read / Opened (`read_count` + %), Failed (`failed_count`).
- **Progress Bar**: Real-time completion percentage based on processed recipients.
- **Recipient Logs Table**: Inspect individual recipient dispatch status (`SENT`, `FAILED`), delivery status (`delivered`, `read`), timestamp, Meta message ID, and error reasons.
- **Live Refresh**: Manual refresh button to poll webhook updates in real time.

---

## 4. Backend Adjustments

1. **`routes/phonebook.js:81` (`edit_contact`)**:
   - Safely defaulted `var6 = null` in the `req.body` destructuring:
     ```js
     const { contactId, name, mobile, var1, var2, var3, var4, var5, var6 = null } = req.body;
     ```
     Prevented potential `ReferenceError: var6 is not defined` when client sends standard 5 custom variables.
2. **`app/api/auth/login/route.ts`**:
   - Set cookie `secure: request.nextUrl.protocol === 'https:'` so cookies are properly transmitted in local HTTP development while remaining strictly HTTPS-secure in production.

---

## 5. Verification Results

### Quality Checks
- `npm run typecheck --prefix ../wacrm-frontend`: **0 errors**
- `npm run lint --prefix ../wacrm-frontend`: **0 errors, 0 warnings**
- `npm run build --prefix ../wacrm-frontend`: **Compiled successfully (40 routes generated)**

### Automated E2E Test Suite
- Tenant login (`sdev66878@gmail.com`): **Success**
- Template routes (`/dashboard/templates`, `/new`, `/[name]`): **200 OK**
- Contacts listing (`/dashboard/contacts`): **200 OK**
- Phonebook creation (`POST /api/phonebook/add`): **Success**
- Contact insertion (`POST /api/phonebook/add_single_contact`): **Success**
- Contact query with pagination (`GET /api/phonebook/get_uid_contacts`): **Verified**
- Contact edit (`PUT /api/phonebook/edit_contact`): **Verified in database**
- Contact delete (`POST /api/phonebook/del_contacts`): **Verified in database**
- Phonebook delete (`POST /api/phonebook/del_phonebook`): **Success**
- Campaigns listing (`/dashboard/campaigns`): **200 OK**
- Campaign creation wizard (`/dashboard/campaigns/new`): **200 OK**
- Campaign API query (`GET /api/broadcast/campaigns`): **Success**
- Campaign create validation (`POST /api/broadcast/create_template_campaign`): **Verified**
