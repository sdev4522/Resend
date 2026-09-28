import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { query } from './database/dbpromise.js';
import { execSync } from 'child_process';

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:3001/api';
const JWTKEY = process.env.JWTKEY;

async function measureHttp(url, headers = {}) {
  const start = performance.now();
  const res = await fetch(url, { headers });
  const latency = performance.now() - start;
  const buffer = await res.arrayBuffer();
  const size = buffer.byteLength;
  const contentEncoding = res.headers.get('content-encoding') || 'none';
  return {
    status: res.status,
    latencyMs: Math.round(latency * 10) / 10,
    sizeBytes: size,
    contentEncoding,
    cacheControl: res.headers.get('cache-control') || 'none'
  };
}

async function runBenchmark() {
  console.log('================================================================');
  console.log('⚡ MEASURING PHASE 14 OPTIMIZED PERFORMANCE');
  console.log('================================================================\n');

  // 1. Process Memory
  const memRaw = execSync('ps -eo pid,rss,vsz,comm,args | grep -E "next-server|node server.js" | grep -v grep').toString();
  console.log('=== PROCESS MEMORY ===');
  console.log(memRaw.trim());

  // 2. Fetch test user & admin tokens
  const users = await query("SELECT uid, email, tokenVersion FROM user LIMIT 1");
  const admins = await query("SELECT uid, email, tokenVersion FROM admin LIMIT 1");

  const userToken = jwt.sign({ uid: users[0].uid, role: 'user', tokenVersion: users[0].tokenVersion || 0 }, JWTKEY);
  const adminToken = jwt.sign({ uid: admins[0].uid, role: 'admin', tokenVersion: admins[0].tokenVersion || 0 }, JWTKEY);

  const userHeaders = { Authorization: `Bearer ${userToken}`, 'Accept-Encoding': 'gzip, deflate, br' };
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Accept-Encoding': 'gzip, deflate, br' };

  // 3. Measure Key Backend API Latencies
  console.log('\n=== KEY BACKEND API LATENCY (OPTIMIZED) ===');
  const apiEndpoints = [
    { name: 'Health check', url: 'http://localhost:3001/api/v1/health', headers: { 'Accept-Encoding': 'gzip' } },
    { name: 'User Profile (/api/user/get_user_profile)', url: `${BACKEND_URL}/user/get_user_profile`, headers: userHeaders },
    { name: 'User Analytics (/api/user/analytics?range=30d)', url: `${BACKEND_URL}/user/analytics?range=30d`, headers: userHeaders },
    { name: 'Contacts List (/api/phonebook/get_by_uid)', url: `${BACKEND_URL}/phonebook/get_by_uid`, headers: userHeaders },
    { name: 'Campaigns List (/api/broadcast/get_campaigns)', url: `${BACKEND_URL}/broadcast/get_campaigns`, headers: userHeaders },
    { name: 'Templates List (/api/templet/get_templets)', url: `${BACKEND_URL}/templet/get_templets`, headers: userHeaders },
    { name: 'Inbox Chats (/api/inbox/get_chats)', url: `${BACKEND_URL}/inbox/get_chats`, headers: userHeaders },
    { name: 'Billing Plan (/api/billing/current_plan)', url: `${BACKEND_URL}/billing/current_plan`, headers: userHeaders },
    { name: 'Admin Stats (/api/admin/overview)', url: `${BACKEND_URL}/admin/overview`, headers: adminHeaders },
    { name: 'Admin Users (/api/admin/users?page=1&limit=20)', url: `${BACKEND_URL}/admin/users?page=1&limit=20`, headers: adminHeaders },
  ];

  const apiResults = [];
  for (const ep of apiEndpoints) {
    await measureHttp(ep.url, ep.headers);
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const res = await measureHttp(ep.url, ep.headers);
      samples.push(res);
    }
    const avgLatency = Math.round(samples.reduce((a, b) => a + b.latencyMs, 0) / samples.length);
    apiResults.push({
      name: ep.name,
      status: samples[0].status,
      avgLatencyMs: avgLatency,
      sizeBytes: samples[0].sizeBytes,
      encoding: samples[0].contentEncoding,
    });
    console.log(`  ${ep.name}: ${avgLatency}ms | Size: ${samples[0].sizeBytes} bytes | Encoding: ${samples[0].contentEncoding}`);
  }

  // 4. Measure Frontend Route Server Response & HTML Transfer
  console.log('\n=== FRONTEND ROUTE SERVER RESPONSE (TTFB / HTML SIZE) ===');
  const userCookieHeader = { Cookie: `wacrm_session=${userToken}; wacrm_role=user`, 'Accept-Encoding': 'gzip, deflate, br' };
  const adminCookieHeader = { Cookie: `wacrm_session=${adminToken}; wacrm_role=admin`, 'Accept-Encoding': 'gzip, deflate, br' };

  const pages = [
    { name: 'Marketing Homepage', path: '/', headers: { 'Accept-Encoding': 'gzip' } },
    { name: 'Login', path: '/login', headers: { 'Accept-Encoding': 'gzip' } },
    { name: 'Dashboard', path: '/dashboard', headers: userCookieHeader },
    { name: 'Inbox', path: '/dashboard/inbox', headers: userCookieHeader },
    { name: 'Contacts', path: '/dashboard/contacts', headers: userCookieHeader },
    { name: 'Campaigns', path: '/dashboard/campaigns', headers: userCookieHeader },
    { name: 'Templates', path: '/dashboard/templates', headers: userCookieHeader },
    { name: 'Analytics', path: '/dashboard/analytics', headers: userCookieHeader },
    { name: 'Billing', path: '/dashboard/billing', headers: userCookieHeader },
    { name: 'Admin Dashboard', path: '/admin', headers: adminCookieHeader },
    { name: 'Admin Users', path: '/admin/users', headers: adminCookieHeader },
  ];

  const pageHttpResults = [];
  for (const page of pages) {
    const cold = await measureHttp(`${FRONTEND_URL}${page.path}`, page.headers);
    const warm = await measureHttp(`${FRONTEND_URL}${page.path}`, page.headers);
    pageHttpResults.push({
      name: page.name,
      path: page.path,
      coldLatencyMs: cold.latencyMs,
      warmLatencyMs: warm.latencyMs,
      sizeBytes: warm.sizeBytes,
      encoding: warm.contentEncoding,
      cacheControl: warm.cacheControl
    });
    console.log(`  ${page.name} (${page.path}): Cold TTFB=${cold.latencyMs}ms | Warm TTFB=${warm.latencyMs}ms | Size=${warm.sizeBytes} B | Encoding=${warm.contentEncoding}`);
  }

  // 5. Lighthouse Audits for Representative Pages (Desktop & Mobile)
  console.log('\n=== LIGHTHOUSE CORE WEB VITALS (DESKTOP & MOBILE) ===');
  const lhTargets = [
    { name: 'Marketing Homepage', url: `${FRONTEND_URL}/`, auth: false },
    { name: 'Login', url: `${FRONTEND_URL}/login`, auth: false },
    { name: 'Dashboard', url: `${FRONTEND_URL}/dashboard`, auth: true, cookie: `wacrm_session=${userToken}; wacrm_role=user` },
    { name: 'Inbox', url: `${FRONTEND_URL}/dashboard/inbox`, auth: true, cookie: `wacrm_session=${userToken}; wacrm_role=user` },
    { name: 'Admin Dashboard', url: `${FRONTEND_URL}/admin`, auth: true, cookie: `wacrm_session=${adminToken}; wacrm_role=admin` },
  ];

  const lhResults = [];
  for (const target of lhTargets) {
    for (const preset of ['desktop', 'mobile']) {
      const outputPath = `/tmp/lh-optimized-${target.name.toLowerCase().replace(/\s+/g, '-')}-${preset}.json`;
      const extraHeaderFlag = target.auth ? `--extra-headers="{\\"Cookie\\": \\"${target.cookie}\\"}"` : '';
      const presetFlag = preset === 'desktop' ? '--preset=desktop' : '';
      const cmd = `npx lighthouse "${target.url}" --chrome-flags="--headless=new --no-sandbox" --output=json --output-path="${outputPath}" --only-categories=performance ${presetFlag} ${extraHeaderFlag} --quiet`;
      try {
        console.log(`  Auditing ${target.name} [${preset}]...`);
        execSync(cmd, { stdio: 'ignore', timeout: 60000 });
        const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        const audits = data.audits || {};
        const res = {
          page: target.name,
          preset,
          score: Math.round((data.categories?.performance?.score || 0) * 100),
          FCP: audits['first-contentful-paint']?.displayValue || 'N/A',
          LCP: audits['largest-contentful-paint']?.displayValue || 'N/A',
          TBT: audits['total-blocking-time']?.displayValue || 'N/A',
          CLS: audits['cumulative-layout-shift']?.displayValue || '0',
          speedIndex: audits['speed-index']?.displayValue || 'N/A',
          totalByteWeight: audits['total-byte-weight']?.displayValue || 'N/A',
          reqCount: audits['network-requests']?.details?.items?.length || 0
        };
        lhResults.push(res);
        console.log(`    Score: ${res.score} | FCP: ${res.FCP} | LCP: ${res.LCP} | TBT: ${res.TBT} | CLS: ${res.CLS} | Bytes: ${res.totalByteWeight} | Reqs: ${res.reqCount}`);
      } catch (err) {
        console.error(`    Audit failed for ${target.name} [${preset}]: ${err.message}`);
      }
    }
  }

  const optimizedReport = {
    timestamp: new Date().toISOString(),
    apiResults,
    pageHttpResults,
    lhResults,
  };

  fs.writeFileSync('./optimized-report.json', JSON.stringify(optimizedReport, null, 2));
  console.log('\n✅ Optimized measurement completed and saved to optimized-report.json');
  process.exit(0);
}

runBenchmark().catch(err => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
