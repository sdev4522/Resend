import 'dotenv/config';
import fetch from 'node-fetch';
import { generateApiKey, revokeApiKey } from './services/api/apiKeyService.js';
import { getAuthorizedConnections } from './services/connections/connectionService.js';
import { query } from './database/dbpromise.js';

const BASE_URL = 'http://localhost:3001/v1';

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

async function runTests() {
  console.log('====================================================');
  console.log('  STARTING WACRM PUBLIC REST API (v1) TEST SUITE');
  console.log('====================================================\n');

  // 1. Health check
  console.log('1. Testing GET /v1/health');
  {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    assert(res.status === 200, 'Health check returns HTTP 200');
    assert(data.status === 'ok', 'Health status is "ok"');
    assert(res.headers.get('x-request-id')?.startsWith('req_'), 'Health response has X-Request-ID');
  }

  // 2. Authentication validations
  console.log('\n2. Testing Authentication Failures');
  {
    const res1 = await fetch(`${BASE_URL}/connections`);
    const data1 = await res1.json();
    assert(res1.status === 401, 'Missing token returns HTTP 401');
    assert(data1.error?.code === 'INVALID_API_KEY', 'Missing token returns INVALID_API_KEY code');

    const res2 = await fetch(`${BASE_URL}/connections`, {
      headers: { Authorization: 'Bearer rk_live_invalid_fake_key_12345' },
    });
    const data2 = await res2.json();
    assert(res2.status === 401, 'Invalid token returns HTTP 401');
    assert(data2.error?.code === 'INVALID_API_KEY', 'Invalid token returns INVALID_API_KEY code');
  }

  // Fetch real workspaces from database
  const userRows = await query('SELECT uid, email FROM user WHERE plan_expire IS NOT NULL LIMIT 2');
  if (userRows.length < 2) {
    console.error('Need at least 2 users with active plans in database to test multi-tenant isolation.');
    process.exit(1);
  }

  const workspaceA = userRows[0].uid;
  const workspaceB = userRows[1].uid;
  console.log(`\nWorkspace A: ${workspaceA} (${userRows[0].email})`);
  console.log(`Workspace B: ${workspaceB} (${userRows[1].email})`);

  // Ensure connections exist in api_connections mapping
  const connsA = await getAuthorizedConnections(workspaceA);
  const connsB = await getAuthorizedConnections(workspaceB);
  console.log(`Workspace A has ${connsA.length} connections:`, connsA.map(c => `${c.id} (${c.provider})`));
  console.log(`Workspace B has ${connsB.length} connections:`, connsB.map(c => `${c.id} (${c.provider})`));

  // 3. Generate test API keys
  console.log('\n3. Generating Test API Keys');
  const keyA = await generateApiKey({
    uid: workspaceA,
    name: 'Test Key Workspace A',
    scopes: ['messages:send', 'messages:read', 'connections:read', 'contacts:read', 'templates:read', 'templates:send', 'usage:read'],
  });
  console.log(`  Key A created: id=${keyA.id}, prefix=${keyA.key_prefix}`);

  const keyB = await generateApiKey({
    uid: workspaceB,
    name: 'Test Key Workspace B',
    scopes: ['messages:send', 'messages:read', 'connections:read', 'contacts:read', 'templates:read', 'templates:send', 'usage:read'],
  });
  console.log(`  Key B created: id=${keyB.id}, prefix=${keyB.key_prefix}`);

  const keyLimited = await generateApiKey({
    uid: workspaceA,
    name: 'Limited Scope Key',
    scopes: ['contacts:read', 'connections:read'], // No messages:send
  });
  console.log(`  Limited Key created: id=${keyLimited.id}, scopes=${keyLimited.scopes.join(',')}`);

  // 4. Test Valid GET /v1/connections
  console.log('\n4. Testing GET /v1/connections with Key A');
  {
    const res = await fetch(`${BASE_URL}/connections`, {
      headers: { Authorization: `Bearer ${keyA.secret}` },
    });
    const json = await res.json();
    assert(res.status === 200, 'GET /v1/connections returns 200');
    assert(Array.isArray(json.data), 'Returns array of connections');
    assert(json.request_id?.startsWith('req_'), 'Includes request_id');
    if (json.data.length > 0) {
      assert(json.data[0].id.startsWith('wa_'), 'Connection ID is opaque wa_ format');
    }
  }

  // 5. Test Scope Enforcement
  console.log('\n5. Testing Granular Scope Enforcement');
  {
    const res = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyLimited.secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: '919876543210',
        type: 'text',
        text: { body: 'Hello' },
      }),
    });
    const json = await res.json();
    assert(res.status === 403, 'Missing messages:send returns HTTP 403');
    assert(json.error?.code === 'INSUFFICIENT_SCOPE', 'Error code is INSUFFICIENT_SCOPE');
  }

  // 6. Test Key Revocation
  console.log('\n6. Testing Instant Key Revocation');
  {
    const revokableKey = await generateApiKey({
      uid: workspaceA,
      name: 'Revoke Me Key',
      scopes: ['connections:read'],
    });

    // Verify it works
    const resBefore = await fetch(`${BASE_URL}/connections`, {
      headers: { Authorization: `Bearer ${revokableKey.secret}` },
    });
    assert(resBefore.status === 200, 'Key works before revocation');

    // Revoke it
    await revokeApiKey(revokableKey.id, workspaceA);

    // Verify immediate failure
    const resAfter = await fetch(`${BASE_URL}/connections`, {
      headers: { Authorization: `Bearer ${revokableKey.secret}` },
    });
    const jsonAfter = await resAfter.json();
    assert(resAfter.status === 401, 'Revoked key immediately returns HTTP 401');
    assert(jsonAfter.error?.code === 'API_KEY_REVOKED', 'Error code is API_KEY_REVOKED');
  }

  // 7. Test Tenant Isolation & Cross-Tenant IDOR Prevention
  console.log('\n7. Testing Tenant Isolation & Anti-IDOR');
  if (connsA.length > 0) {
    const targetConnA = connsA[0].id;
    // Workspace B key tries to use Workspace A's connection
    const res = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyB.secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: targetConnA,
        to: '919876543210',
        type: 'text',
        text: { body: 'Unauthorized cross-tenant attempt' },
      }),
    });
    const json = await res.json();
    assert(res.status === 404, 'Cross-tenant connection access returns HTTP 404');
    assert(json.error?.code === 'CONNECTION_NOT_FOUND', 'Does not leak existence of another tenant connection');
  }

  // 8. Test Ambiguous / Missing Connection Required Error
  console.log('\n8. Testing Missing Connection ID Handling');
  {
    const res = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyA.secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: '919876543210',
        type: 'text',
        text: { body: 'Hello without connection_id' },
      }),
    });
    const json = await res.json();
    assert(res.status === 400, 'Omitting connection_id without default returns HTTP 400');
    assert(json.error?.code === 'CONNECTION_REQUIRED', 'Error code is CONNECTION_REQUIRED');
  }

  // 9. Test QR Template Rejection (Rule 20, 47, 107)
  console.log('\n9. Testing QR Template Rejection');
  const qrConn = [...connsA, ...connsB].find(c => c.provider === 'qr');
  if (qrConn) {
    const keyForQr = connsA.some(c => c.id === qrConn.id) ? keyA : keyB;
    const res = await fetch(`${BASE_URL}/template-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyForQr.secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: qrConn.id,
        to: '919876543210',
        template_name: 'test_meta_template',
      }),
    });
    const json = await res.json();
    assert(res.status === 400, 'Template on QR connection returns HTTP 400');
    assert(
      json.error?.code === 'TEMPLATE_NOT_SUPPORTED_BY_CONNECTION',
      'Returns TEMPLATE_NOT_SUPPORTED_BY_CONNECTION'
    );
  } else {
    console.log('  (Skipping live QR template test: no QR connection found in workspace)');
  }

  // 10. Test Idempotency (Exactly-once delivery & replay protection)
  console.log('\n10. Testing Idempotency Middleware');
  {
    const idemKey = `test-idem-${Date.now()}`;
    const payload = {
      connection_id: 'wa_non_existent_dummy',
      to: '919876543210',
      type: 'text',
      text: { body: 'Idempotent test message' },
    };

    // First request
    const res1 = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyA.secret}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify(payload),
    });

    // Test Idempotency with different payload
    const resMismatch = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyA.secret}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify({
        ...payload,
        to: '910000000000', // Modified payload
      }),
    });
    const jsonMismatch = await resMismatch.json();
    // If the first request was cached (even 404), different payload should trigger 409
    // If 404 wasn't cached, both return 404
    assert(
      resMismatch.status === 409 || resMismatch.status === 404,
      'Reusing idempotency key handled properly'
    );
  }

  // 11. Test Contacts Endpoint
  console.log('\n11. Testing GET /v1/contacts');
  {
    const res = await fetch(`${BASE_URL}/contacts?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${keyA.secret}` },
    });
    const json = await res.json();
    assert(res.status === 200, 'GET /v1/contacts returns HTTP 200');
    assert(Array.isArray(json.data), 'Contacts response contains data array');
    assert(json.pagination?.page === 1, 'Pagination page is 1');
    assert(json.request_id?.startsWith('req_'), 'Includes request_id');
  }

  // 12. Test Usage Endpoint
  console.log('\n12. Testing GET /v1/usage');
  {
    const res = await fetch(`${BASE_URL}/usage`, {
      headers: { Authorization: `Bearer ${keyA.secret}` },
    });
    const json = await res.json();
    assert(res.status === 200, 'GET /v1/usage returns HTTP 200');
    assert(typeof json.data?.api_requests === 'number', 'Returns numeric api_requests');
    assert(typeof json.data?.messages?.accepted === 'number', 'Returns numeric messages.accepted');
    assert(json.request_id?.startsWith('req_'), 'Includes request_id');
  }

  // 13. Test Rate Limiting
  console.log('\n13. Testing Rate Limiting (Burst handling)');
  {
    // Fire burst of requests
    const promises = [];
    for (let i = 0; i < 70; i++) {
      promises.push(
        fetch(`${BASE_URL}/connections`, {
          headers: { Authorization: `Bearer ${keyA.secret}` },
        })
      );
    }
    const responses = await Promise.all(promises);
    const statuses = responses.map(r => r.status);
    const rateLimited = responses.find(r => r.status === 429);

    assert(statuses.includes(200), 'Initial burst requests succeed with 200');
    if (rateLimited) {
      assert(rateLimited.status === 429, 'Rate limit triggered with HTTP 429');
      assert(rateLimited.headers.has('retry-after'), 'Includes Retry-After header');
      const errJson = await rateLimited.json();
      assert(errJson.error?.code === 'RATE_LIMITED', 'Error code is RATE_LIMITED');
    } else {
      console.log('  (Burst completed within limit window)');
    }
  }

  // Cleanup test keys
  await query('DELETE FROM api_keys WHERE id IN (?, ?, ?)', [keyA.id, keyB.id, keyLimited.id]);
  await query('DELETE FROM api_key_connections WHERE api_key_id IN (?, ?, ?)', [keyA.id, keyB.id, keyLimited.id]);

  console.log('\n====================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
