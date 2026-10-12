/* Upgrade a legacy worker without clearing user data. No production API access. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const assets = JSON.parse(source.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
let legacy = true;
function bytes(file) { return file === 'data/sync-config.json' ? Buffer.from('{"endpoint":""}') : fs.readFileSync(path.join(root, file)); }
const hashes = Object.fromEntries(assets.map(file => [file, crypto.createHash('sha256').update(bytes(file === './' ? 'index.html' : file)).digest('hex')]));
const current = source.replace(/const HASHES = {[\s\S]*?};/, 'const HASHES = ' + JSON.stringify(hashes) + ';');
const old = "self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));";
const server = http.createServer((request, response) => {
  const file = new URL(request.url, 'http://localhost').pathname.replace(/^\/wedding\//, '') || 'index.html';
  if (!request.url.startsWith('/wedding/') || file.includes('..')) { response.writeHead(404).end(); return; }
  try {
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); response.setHeader('Cache-Control', 'no-store');
    response.end(file === 'sw.js' ? legacy ? old : current : file === 'legacy.html' ? '<!doctype html><meta charset="utf-8"><h1>Legacy screen</h1><script>navigator.serviceWorker.register("sw.js")</script>' : bytes(file));
  } catch (_) { response.writeHead(404).end(); }
});
const checks = [];
async function run(engine, name, base) {
  legacy = true;
  const browser = await engine.launch({ headless: true, ...(engine === chromium && process.env.KWE_CHROME_PATH ? { executablePath: process.env.KWE_CHROME_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 320, height: 844 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const saved = { version: 2, pins: ['tilt-your-chin-down-just-a-little'], kit: ['tilt-your-chin-down-just-a-little'], lessons: { '1': { done: true, first: '2026-10-01', last: '2026-10-01', due: '2026-10-18', reps: 2, ease: 2.5, interval: 3, lapses: 0 } }, settings: { theme: 'dark', size: 20, rate: .85, voice: 'device voice' } };
  try {
    await page.goto(base + 'legacy.html'); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.evaluate(data => localStorage.setItem('kwe_state_v2', JSON.stringify(data)), saved);
    legacy = false;
    await page.goto(base + 'upgrade.html');
    await page.getByRole('button', { name: '업데이트 적용', exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('kwe_state_v2'))), saved); checks.push(name + ' preparation leaves legacy state untouched');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); checks.push(name + ' upgrade fits 320px');
    await page.getByRole('button', { name: '업데이트 적용', exact: true }).click();
    await page.waitForURL(base + 'field.html#scope=saved'); await page.locator('.phrase').waitFor();
    assert.equal(await page.evaluate(() => KWE.load().pins.includes('tilt-your-chin-down-just-a-little') && KWE.load().lessons['1'].due === '2026-10-18' && KWE.get('rate') === .85), true); checks.push(name + ' activation preserves saved sentences, review date and voice setting');
    await page.goto(base + 'upgrade.html'); await page.getByRole('button', { name: '최신 앱 열기', exact: true }).waitFor();
    await page.getByRole('button', { name: '최신 앱 열기', exact: true }).click(); await page.waitForURL(base + 'field.html#scope=saved');
    assert.deepEqual(errors, []); checks.push(name + ' already-current entry returns to saved collection without errors');
  } finally { await context.close(); await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/wedding/`;
    await run(chromium, 'chromium', base); await run(webkit, 'webkit', base);
    fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'artifacts/upgrade-browser-results.json'), JSON.stringify({ passed: checks.length, checks }, null, 2));
    console.log(`${checks.length} upgrade checks passed.`);
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
