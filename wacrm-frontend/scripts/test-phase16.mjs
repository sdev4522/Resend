import sharp from 'sharp';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3005';
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
  console.log('  WACRM PHASE 16 — PUBLIC LAUNCH READINESS AUDIT  ');
  console.log(`  Target: ${BASE_URL}`);
  console.log('====================================================\n');

  // TEST 1: Homepage /
  console.log('1. Checking Homepage (/) ...');
  try {
    const res = await fetch(`${BASE_URL}/`);
    assert(res.status === 200, 'Homepage returns HTTP 200');
    const html = await res.text();
    assert(html.includes('<title>WaCRM — WhatsApp CRM, Automation &amp; Multi-Agent Inbox</title>') || html.includes('<title>WaCRM — WhatsApp CRM, Automation & Multi-Agent Inbox</title>'), 'Homepage has exact, unique title');
    assert(html.includes('name="description"'), 'Homepage has meta description');
    assert(html.includes('rel="canonical"'), 'Homepage has canonical link');
    assert(html.includes('property="og:image"'), 'Homepage has og:image');
    assert(html.includes('property="og:title"'), 'Homepage has og:title');
    assert(html.includes('name="twitter:card"'), 'Homepage has twitter:card');
    assert(html.includes('application/ld+json'), 'Homepage has JSON-LD structured data');
    assert(html.includes('SoftwareApplication'), 'Homepage includes SoftwareApplication schema');
    assert(html.includes('FAQPage'), 'Homepage includes FAQPage schema');
    assert(!html.includes('Trusted by engineers at'), 'No fake "Trusted by engineers at" logos');
    assert(!html.includes('Join hundreds of high-growth businesses'), 'No unverified customer count claims');
  } catch (e) {
    assert(false, `Homepage failed: ${e.message}`);
  }

  // TEST 2: Features /features
  console.log('\n2. Checking Features (/features) ...');
  try {
    const res = await fetch(`${BASE_URL}/features`);
    assert(res.status === 200, 'Features page returns HTTP 200');
    const html = await res.text();
    assert(html.includes('Features — WhatsApp Cloud API, Inbox &amp; Automation | WaCRM') || html.includes('Features — WhatsApp Cloud API, Inbox & Automation | WaCRM'), 'Features page has unique title');
    assert(html.includes('canonical') && html.includes('/features'), 'Features page has canonical URL to /features');
    assert(html.includes('BreadcrumbList'), 'Features page has BreadcrumbList structured data');
  } catch (e) {
    assert(false, `Features failed: ${e.message}`);
  }

  // TEST 3: Pricing /pricing
  console.log('\n3. Checking Pricing (/pricing) ...');
  try {
    const res = await fetch(`${BASE_URL}/pricing`);
    assert(res.status === 200, 'Pricing page returns HTTP 200');
    const html = await res.text();
    assert(html.includes('Pricing — Transparent WhatsApp CRM Plans | WaCRM'), 'Pricing page has unique title');
    assert(html.includes('canonical') && html.includes('/pricing'), 'Pricing page has canonical URL to /pricing');
    assert(html.includes('Starter') && html.includes('Growth') && html.includes('Enterprise'), 'Pricing plans rendered correctly');
    assert(html.includes('schema.org') && html.includes('Offer'), 'Pricing page has Schema.org Offers');
  } catch (e) {
    assert(false, `Pricing failed: ${e.message}`);
  }

  // TEST 4: Contact /contact
  console.log('\n4. Checking Contact (/contact) ...');
  try {
    const res = await fetch(`${BASE_URL}/contact`);
    assert(res.status === 200, 'Contact page returns HTTP 200');
    const html = await res.text();
    assert(html.includes('Contact Sales &amp; Customer Support | WaCRM') || html.includes('Contact Sales & Customer Support | WaCRM'), 'Contact page has unique title');
    assert(html.includes('support@wacrm.com'), 'Real business contact email displayed');
    assert(html.includes('contact-name') && html.includes('contact-email') && html.includes('contact-content'), 'Contact form fields present');
    assert(html.includes('Spam Prevention Challenge'), 'CAPTCHA challenge rendered');
  } catch (e) {
    assert(false, `Contact failed: ${e.message}`);
  }

  // TEST 5: Privacy Policy /privacy
  console.log('\n5. Checking Privacy Policy (/privacy) ...');
  try {
    const res = await fetch(`${BASE_URL}/privacy`);
    assert(res.status === 200, 'Privacy policy returns HTTP 200');
    const html = await res.text();
    assert(html.includes('Privacy Policy | WaCRM'), 'Privacy policy has unique title');
    assert(html.includes('WhatsApp &amp; Meta Platform Compliance') || html.includes('WhatsApp & Meta Platform Compliance'), 'Accurately covers WhatsApp Cloud API compliance');
    assert(html.includes('Cookies &amp; Local Storage') || html.includes('Cookies & Local Storage'), 'Accurately documents essential vs telemetry cookies');
  } catch (e) {
    assert(false, `Privacy policy failed: ${e.message}`);
  }

  // TEST 6: Terms & Conditions /terms
  console.log('\n6. Checking Terms & Conditions (/terms) ...');
  try {
    const res = await fetch(`${BASE_URL}/terms`);
    assert(res.status === 200, 'Terms page returns HTTP 200');
    const html = await res.text();
    assert(html.includes('Terms and Conditions | WaCRM'), 'Terms page has unique title');
    assert(html.includes('WhatsApp Business Messaging Policy'), 'Terms specify WhatsApp policy compliance');
  } catch (e) {
    assert(false, `Terms failed: ${e.message}`);
  }

  // TEST 7: Thank-You page /thank-you
  console.log('\n7. Checking Thank-You (/thank-you) ...');
  try {
    const res = await fetch(`${BASE_URL}/thank-you`);
    assert(res.status === 200, 'Thank-you page returns HTTP 200');
    const html = await res.text();
    assert(html.includes('content="noindex, nofollow"'), 'Thank-you page protected with noindex, nofollow');
  } catch (e) {
    assert(false, `Thank-you failed: ${e.message}`);
  }

  // TEST 8: Custom 404 Page
  console.log('\n8. Checking Custom 404 Experience ...');
  try {
    const res = await fetch(`${BASE_URL}/non-existent-page-${Date.now()}`);
    assert(res.status === 404, 'Non-existent route returns HTTP 404');
    const html = await res.text();
    assert(html.includes('Page Not Found'), 'Custom 404 heading displayed');
    assert(html.includes('content="noindex'), '404 page has noindex directive');
    assert(html.includes('Back to Home'), 'Helpful return CTA present');
    assert(!html.includes('node_modules') && !html.includes('webpack'), 'No stack traces or internal paths exposed');
  } catch (e) {
    assert(false, `404 check failed: ${e.message}`);
  }

  // TEST 9: Private / Dashboard SEO Protection
  console.log('\n9. Checking Authenticated Route SEO Protection ...');
  try {
    // Check unauthenticated redirect protection
    const dashRedirectRes = await fetch(`${BASE_URL}/dashboard`, { redirect: 'manual' });
    assert(dashRedirectRes.status === 307, 'Dashboard redirects unauthenticated crawlers with HTTP 307');

    // Check rendered layout noindex protection
    const dashAuthRes = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: 'wacrm_session=mock_token; wacrm_role=user' },
    });
    const dashHtml = await dashAuthRes.text();
    assert(dashHtml.includes('content="noindex, nofollow"'), 'Dashboard layout has noindex, nofollow meta protection');

    const adminRes = await fetch(`${BASE_URL}/admin`);
    const adminHtml = await adminRes.text();
    assert(adminHtml.includes('content="noindex, nofollow"'), 'Admin interface has noindex, nofollow meta protection');

    const loginRes = await fetch(`${BASE_URL}/login`);
    const loginHtml = await loginRes.text();
    assert(loginHtml.includes('content="noindex, follow"'), 'Auth login page has noindex, follow meta protection');
  } catch (e) {
    assert(false, `Private routes protection check failed: ${e.message}`);
  }

  // TEST 10: Robots.txt & Sitemap.xml
  console.log('\n10. Checking robots.txt and sitemap.xml ...');
  try {
    const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
    assert(robotsRes.status === 200, 'robots.txt returns HTTP 200');
    const robotsText = await robotsRes.text();
    assert(robotsText.includes('Allow: /') && robotsText.includes('Allow: /pricing'), 'robots.txt allows public marketing pages');
    assert(robotsText.includes('Disallow: /dashboard/') && robotsText.includes('Disallow: /admin/'), 'robots.txt disallows dashboard and admin');
    assert(robotsText.includes('Sitemap:'), 'robots.txt references sitemap');

    const sitemapRes = await fetch(`${BASE_URL}/sitemap.xml`);
    assert(sitemapRes.status === 200, 'sitemap.xml returns HTTP 200');
    const sitemapText = await sitemapRes.text();
    assert(sitemapText.includes('<loc>') && sitemapText.includes('/pricing'), 'sitemap includes pricing page');
    assert(!sitemapText.includes('/dashboard') && !sitemapText.includes('/admin'), 'sitemap excludes private routes');
  } catch (e) {
    assert(false, `robots/sitemap check failed: ${e.message}`);
  }

  // TEST 11: Brand Icons & Open Graph image
  console.log('\n11. Checking Social Assets & Icons ...');
  try {
    const ogRes = await fetch(`${BASE_URL}/og.png`);
    assert(ogRes.status === 200, 'og.png returns HTTP 200');
    assert(ogRes.headers.get('content-type')?.includes('image/png'), 'og.png has image/png content-type');
    const ogBuf = Buffer.from(await ogRes.arrayBuffer());
    const ogMeta = await sharp(ogBuf).metadata();
    assert(ogMeta.width === 1200 && ogMeta.height === 630, `og.png has exact 1200x630 dimensions (got ${ogMeta.width}x${ogMeta.height})`);

    const iconRes = await fetch(`${BASE_URL}/apple-touch-icon.png`);
    assert(iconRes.status === 200, 'apple-touch-icon.png returns HTTP 200');
    const iconBuf = Buffer.from(await iconRes.arrayBuffer());
    const iconMeta = await sharp(iconBuf).metadata();
    assert(iconMeta.width === 180 && iconMeta.height === 180, 'apple-touch-icon.png has 180x180 dimensions');

    const favRes = await fetch(`${BASE_URL}/favicon.png`);
    assert(favRes.status === 200, 'favicon.png returns HTTP 200');

    const manifestRes = await fetch(`${BASE_URL}/manifest.webmanifest`);
    assert(manifestRes.status === 200, 'manifest.webmanifest returns HTTP 200');
  } catch (e) {
    assert(false, `Assets check failed: ${e.message}`);
  }

  // TEST 12: Contact Submission Proxy End-to-End
  console.log('\n12. Checking Contact Form Backend Submission ...');
  try {
    // Test with incorrect CAPTCHA first
    const failRes = await fetch(`${BASE_URL}/api/proxy/web/submit_contact_form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Audit Bot',
        email: 'audit@example.com',
        content: 'Testing verification failure handling',
        captchaQuestion: '5 + 3',
        captchaAnswer: '99',
      }),
    });
    const failData = await failRes.json();
    assert(failData.success === false && failData.captchaFail === true, 'Contact endpoint rejects invalid CAPTCHA');

    // Test with correct submission
    const successRes = await fetch(`${BASE_URL}/api/proxy/web/submit_contact_form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Launch Verification Lead',
        email: 'lead@wacrm-launch.test',
        mobile: '+18005550199',
        content: 'End-to-end launch verification message',
        captchaQuestion: '6 + 2',
        captchaAnswer: '8',
      }),
    });
    const successData = await successRes.json();
    assert(successData.success === true, 'Contact endpoint accepts valid submission and returns success');
  } catch (e) {
    assert(false, `Contact form proxy failed: ${e.message}`);
  }

  console.log('\n====================================================');
  console.log(`  AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
