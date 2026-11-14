#!/usr/bin/env node

/**
 * Search Engine & IndexNow Submission Script
 * Submits canonical URLs to IndexNow (Bing, Yandex, Seznam, Naver) and pings search engines with the sitemap.
 */

const HOST = 'resend.in';
const KEY = 'c37b98d28e4e46049a405efc8d17b35e';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const URLS = [
  `https://${HOST}/`,
  `https://${HOST}/features`,
  `https://${HOST}/pricing`,
  `https://${HOST}/faq`,
  `https://${HOST}/contact`,
  `https://${HOST}/privacy`,
  `https://${HOST}/terms`,
  `https://${HOST}/llms.txt`,
  `https://${HOST}/llms-full.txt`,
];

async function submitToIndexNow(endpointName, endpointUrl) {
  console.log(`Submitting ${URLS.length} URLs to ${endpointName} (${endpointUrl})...`);
  try {
    const payload = {
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList: URLS,
    };

    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'Resend-IndexNow-Submitter/1.0',
      },
      body: JSON.stringify(payload),
    });

    const status = res.status;
    const bodyText = await res.text();
    if (res.ok || status === 200 || status === 202) {
      console.log(`[SUCCESS] ${endpointName}: HTTP ${status} (Accepted/OK)`);
    } else {
      console.log(`[STATUS] ${endpointName}: HTTP ${status} - ${bodyText || 'No response body'}`);
    }
  } catch (err) {
    console.error(`[ERROR] ${endpointName} failed:`, err.message);
  }
}

async function pingSitemap(engineName, pingUrl) {
  console.log(`Pinging sitemap on ${engineName}...`);
  try {
    const res = await fetch(pingUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Resend-Sitemap-Ping/1.0',
      },
    });
    console.log(`[PING] ${engineName}: HTTP ${res.status}`);
  } catch (err) {
    console.error(`[PING ERROR] ${engineName}:`, err.message);
  }
}

async function main() {
  console.log(`=== Starting Search Engine & IndexNow Submission for ${HOST} ===\n`);

  // 1. IndexNow API (Central IndexNow Hub)
  await submitToIndexNow('IndexNow Hub', 'https://api.indexnow.org/indexnow');

  // 2. Microsoft Bing IndexNow Direct
  await submitToIndexNow('Bing IndexNow', 'https://www.bing.com/indexnow');

  // 3. Yandex IndexNow Direct
  await submitToIndexNow('Yandex IndexNow', 'https://yandex.com/indexnow');

  // 4. Ping Google Sitemap
  await pingSitemap('Google', `https://www.google.com/ping?sitemap=https://${HOST}/sitemap.xml`);

  // 5. Ping Bing Sitemap
  await pingSitemap('Bing', `https://www.bing.com/ping?sitemap=https://${HOST}/sitemap.xml`);

  console.log('\n=== Indexing Submission Completed ===');
}

main();
