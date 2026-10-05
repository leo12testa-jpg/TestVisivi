const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    // Manifest JSON non registra da solo il worker: prepara le due cache prima dell'install.
    await page.goto(`${base}/manifest.webmanifest`);
    await page.evaluate(async () => { await caches.open('jetprogram-cache-v41'); await caches.open('other-app-cache'); });
    await page.goto(`${base}/login.html`);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const keys = await page.evaluate(() => caches.keys());
    assert.ok(keys.includes('jetprogram-cache-v42'));
    assert.ok(keys.includes('other-app-cache'));
    assert.ok(!keys.includes('jetprogram-cache-v41'));
    const urls = await page.evaluate(async () => (await (await caches.open('jetprogram-cache-v42')).keys()).map(r => r.url));
    assert.ok(urls.includes(`${base}/js/jet-normalizer.js`));
    assert.ok(urls.includes(`${base}/js/archive-utils.js`));
    assert.ok(urls.includes(`${base}/js/jet-ui-compat.js`));
    assert.ok(!urls.some(url => /atleti_importati|firestore|backup/.test(url) && !url.includes('firebase-firestore-compat.js')));
    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('#login-email');
    assert.equal(await page.locator('#login-password').count(), 1);
    assert.deepEqual(errors, []);
    const result = { ok: true, cache: 'jetprogram-cache-v42', oldCacheRemoved: true, unrelatedCachePreserved: true, offlineLoginLoaded: true, errors };
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync('reports/pwa-results.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
