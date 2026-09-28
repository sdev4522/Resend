import 'dotenv/config';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
const { sign } = jwt;
import { query } from './database/dbpromise.js';
import randomstring from 'randomstring';

const BASE_URL = 'http://localhost:3001/api';
const JWTKEY = process.env.JWTKEY;

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
  console.log('  STARTING WACRM AUTOMATION & FLOW BUILDER TEST SUITE');
  console.log('====================================================\n');

  // Find two users for multi-tenancy verification
  const users = await query('SELECT uid, email, tokenVersion FROM user WHERE plan_expire IS NOT NULL AND is_blocked = 0 LIMIT 2');
  if (users.length < 2) {
    console.error('Need at least 2 users with active plans in database to test.');
    process.exit(1);
  }

  const userA = users[0];
  const userB = users[1];

  const tokenA = sign({ uid: userA.uid, role: 'user', tokenVersion: userA.tokenVersion || 0 }, JWTKEY);
  const tokenB = sign({ uid: userB.uid, role: 'user', tokenVersion: userB.tokenVersion || 0 }, JWTKEY);

  const headersA = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` };
  const headersB = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` };

  const testFlowId = `test_flow_${randomstring.generate(16)}`;
  let createdDbId = null;

  // ----------------------------------------------------
  // 1. Flow Creation & Validation
  // ----------------------------------------------------
  console.log('1. Testing Flow Creation & Blank Flow Rejection');
  {
    // Try saving blank flow
    const blankRes = await fetch(`${BASE_URL}/chat_flow/insert_flow_beta`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'Blank Flow',
        flow_id: testFlowId,
        source: 'wa_chatbot',
        data: { nodes: [], edges: [] },
      }),
    });
    const blankData = await blankRes.json();
    assert(blankData.success !== true, 'Blank flow without nodes/edges is rejected');

    // Try saving flow with last node moveToNextNode: true
    const invalidLastNodeRes = await fetch(`${BASE_URL}/chat_flow/insert_flow_beta`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'Invalid Last Node Flow',
        flow_id: testFlowId,
        source: 'wa_chatbot',
        data: {
          nodes: [
            { id: 'initialNode', type: 'INITIAL', position: { x: 0, y: 0 }, data: {} },
            {
              id: 'node_last',
              type: 'SEND_MESSAGE',
              position: { x: 300, y: 0 },
              data: { moveToNextNode: true, content: { text: { body: 'Hello' } } },
            },
          ],
          edges: [
            { id: 'e1', source: 'initialNode', target: 'node_last' },
          ],
        },
      }),
    });
    const invalidLastNodeData = await invalidLastNodeRes.json();
    assert(invalidLastNodeData.success !== true, 'Flow where last node has moveToNextNode: true is rejected');

    // Save valid flow
    const validFlowRes = await fetch(`${BASE_URL}/chat_flow/insert_flow_beta`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'Onboarding Welcome Flow',
        flow_id: testFlowId,
        source: 'wa_chatbot',
        data: {
          nodes: [
            {
              id: 'initialNode',
              type: 'INITIAL',
              position: { x: 100, y: 300 },
              data: { whPhonePath: '', sourceTitle: 'Inbound WhatsApp' },
            },
            {
              id: 'node_welcome',
              type: 'SEND_MESSAGE',
              position: { x: 500, y: 300 },
              data: {
                moveToNextNode: false,
                type: { type: 'text', title: 'Welcome Message' },
                content: { type: 'text', text: { body: 'Welcome {{senderName}}!' } },
                customCustomProp: 'preserved_value',
              },
            },
          ],
          edges: [
            { id: 'e_init', source: 'initialNode', target: 'node_welcome', type: 'smoothstep' },
          ],
        },
      }),
    });
    const validFlowData = await validFlowRes.json();
    assert(validFlowData.success === true, 'Valid flow is saved successfully');
    assert(validFlowData.flow_id === testFlowId, 'Returns created flow_id');
  }

  // ----------------------------------------------------
  // 2. Flow Retrieval & Data Roundtrip Preservation
  // ----------------------------------------------------
  console.log('\n2. Testing Flow Retrieval & Property Preservation');
  {
    const getRes = await fetch(`${BASE_URL}/chat_flow/get_flow_beta?flow_id=${testFlowId}`, {
      headers: headersA,
    });
    const getData = await getRes.json();
    assert(getData.success === true, 'GET /get_flow_beta returns HTTP success');
    assert(getData.data.name === 'Onboarding Welcome Flow', 'Flow name matches');
    assert(getData.data.data.nodes.length === 2, 'Flow has 2 nodes');
    assert(getData.data.data.edges.length === 1, 'Flow has 1 edge');
    assert(
      getData.data.data.nodes[1].data.customCustomProp === 'preserved_value',
      'Custom/unknown property preserved in roundtrip'
    );
    createdDbId = getData.data.id;
  }

  // ----------------------------------------------------
  // 3. Multi-Tenant Isolation
  // ----------------------------------------------------
  console.log('\n3. Testing Multi-Tenant Isolation (Workspace A vs Workspace B)');
  {
    // User B tries to read User A's flow
    const resReadB = await fetch(`${BASE_URL}/chat_flow/get_flow_beta?flow_id=${testFlowId}`, {
      headers: headersB,
    });
    assert(resReadB.status === 404, 'User B cannot read User A flow (returns 404)');

    // User B tries to overwrite User A's flow
    const resWriteB = await fetch(`${BASE_URL}/chat_flow/insert_flow_beta`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        name: 'Hacked Flow',
        flow_id: testFlowId,
        source: 'wa_chatbot',
        data: {
          nodes: [
            { id: 'initialNode', type: 'INITIAL', position: { x: 0, y: 0 }, data: {} },
            { id: 'n2', type: 'SEND_MESSAGE', position: { x: 300, y: 0 }, data: { moveToNextNode: false, content: { text: { body: 'hacked' } } } },
          ],
          edges: [{ id: 'e1', source: 'initialNode', target: 'n2' }],
        },
      }),
    });
    assert(resWriteB.status === 403, 'User B cannot update User A flow (returns 403 Unauthorized)');

    // Verify User A flow was NOT mutated
    const verifyRes = await fetch(`${BASE_URL}/chat_flow/get_flow_beta?flow_id=${testFlowId}`, {
      headers: headersA,
    });
    const verifyData = await verifyRes.json();
    assert(verifyData.data.name === 'Onboarding Welcome Flow', 'Flow A was protected and remained unchanged');
  }

  // ----------------------------------------------------
  // 4. Existing Flow Regression Test (Flow 76 from DB)
  // ----------------------------------------------------
  console.log('\n4. Testing Regression on Existing DB Flow');
  {
    const existingFlows = await query('SELECT * FROM beta_flows WHERE id = 76 LIMIT 1');
    if (existingFlows.length > 0) {
      const existingFlow = existingFlows[0];
      const parsedData = JSON.parse(existingFlow.data);
      const originalNodeCount = parsedData.nodes.length;
      const originalEdgeCount = parsedData.edges.length;

      // Ensure node count and edge count are non-empty
      assert(originalNodeCount >= 2, `Existing flow 76 has ${originalNodeCount} nodes`);
      assert(originalEdgeCount >= 1, `Existing flow 76 has ${originalEdgeCount} edges`);

      // Verify node types in existing flow
      const hasInitial = parsedData.nodes.some(n => n.type === 'INITIAL');
      assert(hasInitial, 'Existing flow 76 contains INITIAL trigger node');
    } else {
      console.log('  Notice: Flow ID 76 not present, skipping flow 76 check');
    }
  }

  // ----------------------------------------------------
  // 5. Chatbot Binding & Lifecycle (Add, Status Toggle, Delete)
  // ----------------------------------------------------
  console.log('\n5. Testing Chatbot Activation Lifecycle');
  let chatbotId = null;
  {
    // Try binding with invalid QR interactive message
    const qrInteractiveRes = await fetch(`${BASE_URL}/chatbot/add_beta_chatbot`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'QR Bot with Buttons',
        origin: { code: 'QR', title: '+919999999999', data: { uniqueId: 'fake_inst' } },
        flow: { id: createdDbId, flow_id: testFlowId },
      }),
    });
    // Valid flow has text only, so it should accept QR or check provider restrictions
    // Let's create a flow with buttons to test QR rejection
    const buttonFlowId = `btn_flow_${randomstring.generate(16)}`;
    await fetch(`${BASE_URL}/chat_flow/insert_flow_beta`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'Button Flow',
        flow_id: buttonFlowId,
        source: 'wa_chatbot',
        data: {
          nodes: [
            { id: 'initialNode', type: 'INITIAL', position: { x: 0, y: 0 }, data: {} },
            {
              id: 'btn_node',
              type: 'SEND_MESSAGE',
              position: { x: 300, y: 0 },
              data: {
                moveToNextNode: false,
                type: { type: 'button' },
                content: { interactive: { type: 'button' } },
              },
            },
          ],
          edges: [{ id: 'e1', source: 'initialNode', target: 'btn_node' }],
        },
      }),
    });

    const [btnFlowRow] = await query('SELECT * FROM beta_flows WHERE flow_id = ?', [buttonFlowId]);
    const qrRejectRes = await fetch(`${BASE_URL}/chatbot/add_beta_chatbot`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'QR Bot with Buttons',
        origin: { code: 'QR', title: '+919999999999', data: { uniqueId: 'fake_inst' } },
        flow: { id: btnFlowRow.id, flow_id: buttonFlowId },
      }),
    });
    const qrRejectData = await qrRejectRes.json();
    assert(
      qrRejectData.success === false && qrRejectData.msg?.includes('Interactive'),
      'Backend rejects interactive buttons on QR origin'
    );

    // Now bind valid flow with META origin
    // Check if META bot already exists, clean up if needed
    await query('DELETE FROM beta_chatbot WHERE uid = ? AND origin_id = "META"', [userA.uid]);

    const addMetaRes = await fetch(`${BASE_URL}/chatbot/add_beta_chatbot`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Meta Welcome Bot',
        origin: { code: 'META', title: 'Meta Cloud API', data: {} },
        flow: { id: createdDbId, flow_id: testFlowId },
      }),
    });
    const addMetaData = await addMetaRes.json();
    assert(addMetaData.success === true, 'Successfully created beta_chatbot on META origin');

    // Verify in beta_chatbot table
    const [botRow] = await query(
      'SELECT * FROM beta_chatbot WHERE uid = ? AND flow_id = ?',
      [userA.uid, testFlowId]
    );
    assert(botRow !== undefined, 'Chatbot row found in database');
    assert(botRow.active === 1, 'Chatbot initialized as active = 1');
    chatbotId = botRow.id;

    // Toggle status to inactive (0)
    const pauseRes = await fetch(`${BASE_URL}/chatbot/change_beta_bot_status`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ id: chatbotId, status: false }),
    });
    const pauseData = await pauseRes.json();
    assert(pauseData.success === true, 'Paused chatbot status');

    const [pausedRow] = await query('SELECT active FROM beta_chatbot WHERE id = ?', [chatbotId]);
    assert(pausedRow.active === 0, 'Database confirms active = 0');

    // Toggle status back to active (1)
    const resumeRes = await fetch(`${BASE_URL}/chatbot/change_beta_bot_status`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ id: chatbotId, status: true }),
    });
    const resumeData = await resumeRes.json();
    assert(resumeData.success === true, 'Resumed chatbot status');

    const [resumedRow] = await query('SELECT active FROM beta_chatbot WHERE id = ?', [chatbotId]);
    assert(resumedRow.active === 1, 'Database confirms active = 1');

    // Clean up button test flow
    await query('DELETE FROM beta_flows WHERE flow_id = ?', [buttonFlowId]);
  }

  // ----------------------------------------------------
  // 6. Flow Duplication
  // ----------------------------------------------------
  console.log('\n6. Testing Flow Duplication');
  let dupFlowId = null;
  {
    const dupRes = await fetch(`${BASE_URL}/chat_flow/duplicate_flow_beta`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ flow_id: testFlowId }),
    });
    const dupData = await dupRes.json();
    assert(dupData.success === true, 'Flow duplicated successfully');
    assert(Boolean(dupData.flow_id), 'Returns new flow_id for duplicate');
    dupFlowId = dupData.flow_id;

    const [dupRow] = await query('SELECT * FROM beta_flows WHERE flow_id = ?', [dupFlowId]);
    assert(dupRow.name === 'Onboarding Welcome Flow (Copy)', 'Duplicate flow has "(Copy)" suffix');
    const dupParsed = JSON.parse(dupRow.data);
    assert(dupParsed.nodes.length === 2, 'Duplicate has same node count');
    assert(dupParsed.edges.length === 1, 'Duplicate has same edge count');

    // Clean up duplicate
    await query('DELETE FROM beta_flows WHERE flow_id = ?', [dupFlowId]);
  }

  // ----------------------------------------------------
  // 7. Cleanup
  // ----------------------------------------------------
  console.log('\n7. Cleaning up test data');
  {
    if (chatbotId) {
      const delBotRes = await fetch(`${BASE_URL}/chatbot/del_beta_chatbot`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({ id: chatbotId }),
      });
      const delBotData = await delBotRes.json();
      assert(delBotData.success === true, 'Deleted test beta_chatbot record');
    }

    if (createdDbId) {
      const delFlowRes = await fetch(`${BASE_URL}/chat_flow/del_flow_beta`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({ id: createdDbId }),
      });
      const delFlowData = await delFlowRes.json();
      assert(delFlowData.success === true, 'Deleted test beta_flows record');
    }
  }

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
