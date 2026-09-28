/**
 * test-phase17.mjs - Comprehensive Verification Suite for Phase 17
 * Public Website + Real Pricing + Support + Contact + Security Isolation
 */

import http from 'http';
import { readFileSync } from 'fs';
import mysql from '/home/sdev/Projects/wacrm/node_modules/mysql2/promise.js';
import jwt from '/home/sdev/Projects/wacrm/node_modules/jsonwebtoken/index.js';

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:3001';

const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '4522',
  database: 'whatscrm',
};

const JWT_SECRET = 'NCRUp5hKovUAcZd9OwIw0BCKmjZj9JxpNCRUp5hKovUAcZd9OwIw0BCKmjZj9JxpNCRUp5hKovUAcZd9OwIw0BCKmjZj9Jxp';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(body);
          } catch {
            data = body;
          }
          resolve({ status: res.statusCode, headers: res.headers, data, text: body });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  console.log('==============================================');
  console.log('PHASE 17 COMPREHENSIVE VERIFICATION SUITE');
  console.log('==============================================\n');

  const db = await mysql.createConnection(DB_CONFIG);

  try {
    // ----------------------------------------------------
    // TEST 1: Public Pages Availability & SEO Routes
    // ----------------------------------------------------
    console.log('Test 1: Public Pages & SEO Routes Availability');
    const pages = ['/', '/pricing', '/contact', '/faq', '/sitemap.xml', '/robots.txt'];
    for (const p of pages) {
      const res = await request(`${FRONTEND_URL}${p}`);
      assert(res.status === 200, `Page ${p} returns HTTP 200 OK`);
      if (p === '/sitemap.xml') {
        assert(res.text.includes('/faq'), `sitemap.xml contains /faq entry`);
        assert(res.text.includes('/pricing'), `sitemap.xml contains /pricing entry`);
        assert(res.text.includes('/contact'), `sitemap.xml contains /contact entry`);
      }
      if (p === '/robots.txt') {
        assert(res.text.includes('Disallow: /dashboard/'), `robots.txt disallows /dashboard/`);
        assert(res.text.includes('Disallow: /admin/'), `robots.txt disallows /admin/`);
      }
    }

    // ----------------------------------------------------
    // TEST 2: Real Pricing Backend Endpoint & Discounts
    // ----------------------------------------------------
    console.log('\nTest 2: Backend Authoritative Pricing & Duration Discounts');
    const plansRes = await request(`${BACKEND_URL}/api/billing/plans`);
    assert(plansRes.status === 200, 'GET /api/billing/plans returns 200 OK');
    assert(plansRes.data.success === true, 'Billing plans API success is true');
    assert(Array.isArray(plansRes.data.plans) && plansRes.data.plans.length > 0, `Returned ${plansRes.data.plans.length} active plans from database`);
    // DURATION_DISCOUNT_RATES is keyed by months: { 1: 0.0, 3: 0.05, 6: 0.10, 12: 0.15 }
    assert(plansRes.data.durationDiscounts?.[12] === 0.15, `12-month duration discount is 15% (got ${plansRes.data.durationDiscounts?.[12]})`);
    assert(plansRes.data.durationDiscounts?.[6] === 0.10, '6-month duration discount is 10%');
    assert(plansRes.data.currency === 'USD', 'Currency is USD');
    
    // Check first plan has real plan limit fields (flat DB columns)
    const p1 = plansRes.data.plans[0];
    assert(typeof p1.contact_limit !== 'undefined', `Plan "${p1.title}" contains contact_limit field`);
    assert(typeof p1.qr_account !== 'undefined', `Plan "${p1.title}" contains qr_account (WhatsApp instances) field`);
    assert(Array.isArray(p1.plan_prices), `Plan "${p1.title}" contains plan_prices currency array`);

    // ----------------------------------------------------
    // TEST 3: Contact Form B2B Submission & Security
    // ----------------------------------------------------
    console.log('\nTest 3: Contact Form B2B Submission, Captcha & DB Storage');
    const contactPayload = {
      name: 'Dr. Jane Tester',
      email: 'jane.tester@enterprise.example',
      company: 'Acme Health Systems',
      mobile: '+14155552671',
      subject: 'Inquiry regarding 50 Agent Seats and WhatsApp Cloud API SLA',
      reason: 'Sales',
      content: 'We are evaluating WACRM for our patient communication team. Need custom SLA.',
      captchaQuestion: '5 + 8',
      captchaAnswer: '13',
    };

    const contactRes = await request(`${BACKEND_URL}/api/web/submit_contact_form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: contactPayload,
    });
    assert(contactRes.status === 200 && contactRes.data.success === true, 'Contact form submitted successfully (200 OK)');

    // Verify row in MySQL database
    const [contactRows] = await db.query(
      'SELECT * FROM contact_form WHERE email = ? ORDER BY id DESC LIMIT 1',
      ['jane.tester@enterprise.example']
    );
    assert(contactRows.length > 0, 'Contact record successfully saved to database');
    if (contactRows.length > 0) {
      const cRow = contactRows[0];
      assert(cRow.company === 'Acme Health Systems', `DB company stored: "${cRow.company}"`);
      assert(cRow.subject.includes('Inquiry regarding 50 Agent Seats'), `DB subject stored: "${cRow.subject}"`);
      assert(cRow.reason === 'Sales', `DB reason stored: "${cRow.reason}"`);
    }

    // Invalid Captcha Rejection
    const invalidCaptchaRes = await request(`${BACKEND_URL}/api/web/submit_contact_form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { ...contactPayload, captchaAnswer: '999' },
    });
    assert(invalidCaptchaRes.status === 400 && invalidCaptchaRes.data.success === false, 'Invalid captcha is rejected with 400');

    // ----------------------------------------------------
    // TEST 4: Customer Support Portal (User Flow)
    // ----------------------------------------------------
    console.log('\nTest 4: Customer Support Portal (User Flow)');
    // Fetch test user with uid and tokenVersion for valid JWT
    const [userRows] = await db.query(
      'SELECT id, uid, email, name, role, tokenVersion FROM `user` WHERE role = "user" LIMIT 1'
    );
    assert(userRows.length > 0, 'Found registered tenant user in database');
    const testUser = userRows[0];

    // Sign JWT matching real validateUser middleware: uid + role + tokenVersion (must match DB)
    const userToken = jwt.sign(
      { uid: testUser.uid, email: testUser.email, role: 'user', tokenVersion: testUser.tokenVersion || 0 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create a support ticket
    const newTicketRes = await request(`${BACKEND_URL}/api/support/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: {
        subject: 'Need help setting up Cloud API webhook for high throughput',
        category: 'technical',
        priority: 'high',
        message: 'Hello Support Team, we are seeing intermittent rate limits on our Meta Cloud API webhook listener. We need guidance on the correct throughput settings.',
      },
    });

    assert(newTicketRes.status === 200 && newTicketRes.data.success === true, 'User successfully created support ticket (200 OK)');
    const ticketId = newTicketRes.data.ticket?.id;
    const ticketNumber = newTicketRes.data.ticket?.ticket_number;
    assert(ticketId && ticketNumber, `Assigned ticket ID #${ticketId} with number ${ticketNumber}`);

    // Fetch user tickets list
    const userTicketsRes = await request(`${BACKEND_URL}/api/support/tickets`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(userTicketsRes.status === 200 && userTicketsRes.data.success === true, 'User fetched tickets list (200 OK)');
    const foundUserTicket = userTicketsRes.data.tickets.find((t) => t.id === ticketId);
    assert(!!foundUserTicket, `User tickets list contains newly created ticket #${ticketNumber}`);

    // Fetch ticket detail
    const ticketDetailRes = await request(`${BACKEND_URL}/api/support/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(ticketDetailRes.status === 200 && ticketDetailRes.data.success === true, 'User retrieved ticket detail');
    assert(ticketDetailRes.data.messages.length >= 1, 'Initial ticket message present in conversation thread');

    // User replies to ticket
    const userReplyRes = await request(`${BACKEND_URL}/api/support/tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: { message: 'We also noticed error code 131056 in our developer logs. Can you check from your end too?' },
    });
    assert(userReplyRes.status === 200 && userReplyRes.data.success === true, 'User posted reply to ticket (200 OK)');

    // ----------------------------------------------------
    // TEST 5: Customer Support System (Admin Flow)
    // ----------------------------------------------------
    console.log('\nTest 5: Customer Support Management (Admin Flow)');
    // Admin JWT uses uid from admin table, role='admin', tokenVersion must match DB (1)
    const adminToken = jwt.sign(
      { uid: 'XhbfYkIAC1bYGhUodfJppmRCEUyGQJCZ', email: 'admin@admin.com', role: 'admin', tokenVersion: 1 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Admin fetches all tickets
    const adminTicketsRes = await request(`${BACKEND_URL}/api/support/admin/tickets`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminTicketsRes.status === 200 && adminTicketsRes.data.success === true, 'Admin fetched all support tickets (200 OK)');
    const foundAdminTicket = adminTicketsRes.data.tickets.find((t) => t.id === ticketId);
    assert(!!foundAdminTicket, `Admin tickets list contains ticket #${ticketNumber}`);
    assert(adminTicketsRes.data.counts?.all > 0, `Admin metrics counts total=${adminTicketsRes.data.counts?.all}`);

    // Admin replies to ticket
    const adminReplyRes = await request(`${BACKEND_URL}/api/support/admin/tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: {
        message: 'Hello, error code 131056 indicates your Meta Cloud API template tier requires verification. We have adjusted your throughput bucket.',
        status: 'in_progress',
      },
    });
    assert(adminReplyRes.status === 200 && adminReplyRes.data.success === true, 'Admin replied to customer ticket (200 OK)');

    // Admin updates status to resolved
    const statusUpdateRes = await request(`${BACKEND_URL}/api/support/admin/tickets/${ticketId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: { status: 'resolved' },
    });
    assert(statusUpdateRes.status === 200 && statusUpdateRes.data.success === true, 'Admin marked ticket status as "resolved"');

    // Verify User sees updated status and both replies
    const recheckDetail = await request(`${BACKEND_URL}/api/support/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(recheckDetail.data.ticket.status === 'resolved', 'User sees ticket status updated to "resolved"');
    assert(recheckDetail.data.messages.length === 3, 'Conversation thread has all 3 messages (Initial + User Followup + Admin Response)');

    // ----------------------------------------------------
    // TEST 6: Security & Role-Based Access Enforcement
    // ----------------------------------------------------
    console.log('\nTest 6: Role-Based Isolation & Tenant Boundaries');
    // Unauthenticated rejection
    const unauthRes = await request(`${BACKEND_URL}/api/support/tickets`);
    assert(unauthRes.status === 401, 'Unauthenticated user rejected from /api/support/tickets (401)');

    // Agent-role token has role != "user" so validateUser rejects with 401
    const agentToken = jwt.sign(
      { uid: 'fake-agent-uid', email: 'agent@workspace.test', role: 'agent', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const agentRes = await request(`${BACKEND_URL}/api/support/tickets`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(agentRes.status === 401, 'Agent role blocked from platform support tickets (401 Unauthorized - role mismatch)');

    // Cross-tenant protection: Foreign user uid not in DB returns 401
    const foreignUserToken = jwt.sign(
      { uid: 'totally-non-existent-uid', email: 'foreign@other.test', role: 'user', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const foreignDetailRes = await request(`${BACKEND_URL}/api/support/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${foreignUserToken}` },
    });
    assert(foreignDetailRes.status === 401 || foreignDetailRes.status === 404, 'Foreign user cannot access another user ticket (401 or 404)');

    // ----------------------------------------------------
    // TEST 7: UI Audit - Confirm Removal of Floating Badge
    // ----------------------------------------------------
    console.log('\nTest 7: Verification of Clean UI & Removal of Debug Badges');
    const sidebarFile = readFileSync('/home/sdev/Projects/wacrm-frontend/components/dashboard/sidebar.tsx', 'utf8');
    assert(
      !sidebarFile.includes('Official WhatsApp SaaS'),
      'Sidebar no longer contains "Official WhatsApp SaaS" floating badge'
    );
    assert(
      !sidebarFile.includes('Connected via Cloud API & Baileys instance'),
      'Sidebar no longer contains "Connected via Cloud API & Baileys instance" technical label'
    );

    // Check pricing component uses real API
    const pricingFile = readFileSync('/home/sdev/Projects/wacrm-frontend/components/marketing/pricing.tsx', 'utf8');
    assert(
      pricingFile.includes('billingApi.getPlans'),
      'Marketing pricing component fetches real backend plans via billingApi.getPlans()'
    );
    assert(
      !pricingFile.includes('Starter — $29'),
      'Marketing pricing component does not have hardcoded "$29/month" plan'
    );

    console.log('\n==============================================');
    console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('==============================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await db.end();
  }
}

run();
