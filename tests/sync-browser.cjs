/* Two isolated devices, real SQLite API and CORS, Chromium and WebKit. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium, webkit } = require('playwright');
const { createService } = require('../server/main.cjs');
const root = path.resolve(__dirname, '..'), artifacts = path.join(root, 'artifacts');
const workerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const assets = JSON.parse(workerSource.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kwe-sync-browser-'));
const dbPath = path.join(directory, 'saved.sqlite'), mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const checks = [], errors = [];
const check = (label, value) => { assert.ok(value, label); checks.push(label); };
let api, origin, proxyOrigin, apiPort, offlineBackend = false;
function bytes(file, account) {
  return file === 'data/sync-config.json' ? Buffer.from(JSON.stringify({ endpoint: proxyOrigin + '/' + account })) : fs.readFileSync(path.join(root, file));
}
function worker(account) {
  const hashes = Object.fromEntries(assets.map(file => [file, crypto.createHash('sha256').update(bytes(file === './' ? 'index.html' : file, account)).digest('hex')]));
  return workerSource.replace(/const VERSION = '[^']+';/, "const VERSION = 'sync-browser-" + account + "';").replace(/const HASHES = {[\s\S]*?};/, 'const HASHES = ' + JSON.stringify(hashes) + ';');
}
const frontend = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost'), match = url.pathname.match(/^\/(alice|bob)\/wedding\/(.*)$/);
  if (!match) { response.writeHead(404).end(); return; }
  const file = decodeURIComponent(match[2]) || 'index.html';
  if (file.includes('..')) { response.writeHead(404).end(); return; }
  try { response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); response.setHeader('Cache-Control', 'no-store'); response.end(file === 'sw.js' ? worker(match[1]) : bytes(file, match[1])); }
  catch (_) { response.writeHead(404).end(); }
});
const proxy = http.createServer((request, response) => {
  const match = request.url.match(/^\/(alice|bob)(\/.*)$/);
  if (!match) { response.writeHead(404).end(); return; }
  const upstream = http.request({ hostname: '127.0.0.1', port: apiPort, path: match[2], method: request.method, headers: { ...request.headers, 'tailscale-user-login': match[1] + '@example.com' } }, incoming => {
    response.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(response);
  });
  upstream.on('error', () => { if (!response.headersSent) response.writeHead(503, { 'Access-Control-Allow-Origin': origin, 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'Test backend offline' })); });
  response.on('close', () => upstream.destroy()); request.pipe(upstream);
});
async function ready(page) {
  await page.waitForFunction(() => document.querySelector('footer [data-sync-status]')?.textContent.includes('동기화됨'));
  await page.waitForFunction(() => navigator.serviceWorker.controller && document.querySelector('footer [data-offline]')?.textContent.includes('완료'));
}
async function hasPins(page, ids, absent = []) {
  await page.waitForFunction(({ ids, absent }) => ids.every(id => KWE.load().pins.includes(id)) && absent.every(id => !KWE.load().pins.includes(id)), { ids, absent });
}
async function field(page, base, query) {
  await page.goto(base + 'field.html#q=' + encodeURIComponent(query)); await page.waitForSelector('.phrase');
}
const chin = 'tilt-your-chin-down-just-a-little', family = 'could-we-get-the-immediate-family-for-the-next-o', closer = 'come-a-little-closer-to-each-other', joke = 'friends-relax-this-isn-t-a-passport-photo', serious = 'you-can-stop-smiling-like-it-s-a-passport-photo';
async function run(engine, label) {
  const browser = await engine.launch({ headless: true, ...(engine === chromium && process.env.KWE_CHROME_PATH ? { executablePath: process.env.KWE_CHROME_PATH } : {}) });
  const a = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const b = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const account = origin + '/alice/wedding/', other = origin + '/bob/wedding/';
  const seed = (pins, kit, rate) => ({ version: 2, lessons: { '1': { done: true, first: '2026-10-01', last: '2026-10-01', due: '2026-10-18', reps: 2, ease: 2.5, interval: 3, lapses: 0 } }, pins, kit, settings: { theme: 'light', size: 18, rate, voice: 'device voice' } });
  for (const [context, data] of [[a, seed([chin], [chin], .85)], [b, seed([family], [family], 1.05)]]) await context.addInitScript(raw => { if (!localStorage.getItem('kwe_state_v2')) localStorage.setItem('kwe_state_v2', JSON.stringify(raw)); }, data);
  const pa = await a.newPage(), pb = await b.newPage();
  for (const page of [pa, pb]) page.on('pageerror', error => errors.push(label + ': ' + error.message));
  try {
    await pa.goto(account + 'field.html#scope=saved'); await ready(pa);
    await pb.goto(account + 'field.html#scope=saved'); await ready(pb);
    await hasPins(pa, [chin, family]); await hasPins(pb, [chin, family]);
    check(label + ' original devices merge favorites and kits without lost IDs', await pa.evaluate(({ chin, family }) => [chin, family].every(id => KWE.load().kit.includes(id)), { chin, family }));
    check(label + ' legacy review dates and device speech settings survive', await pa.evaluate(() => KWE.load().lessons['1'].due === '2026-10-18' && KWE.get('rate') === .85) && await pb.evaluate(() => KWE.get('rate') === 1.05));
    await field(pa, account, '그룹 농담'); await pa.locator('[data-star="' + joke + '"]').click(); await hasPins(pb, [joke]);
    check(label + ' remote favorite appears in currently open field without reload', await pb.locator('.phrase[data-id="' + joke + '"]').count() === 1);
    await pa.goto(account + 'lessons/0001-arrival-greeting-car-exit.html'); await pa.locator('.scn [data-sentence-save]').first().waitFor(); await ready(pa);
    const sentence = pa.locator('.scn [data-sentence-save]').first(), sid = await sentence.getAttribute('data-sentence-save');
    if (await sentence.getAttribute('aria-pressed') !== 'true') await sentence.click();
    await hasPins(pb, [sid]); await pb.locator('.phrase[data-id="' + sid + '"]').waitFor();
    check(label + ' saved lesson sentence and translation arrive on other device', await pb.evaluate(id => !!KWE.load().sentences[id]?.en && !!KWE.load().sentences[id]?.ko, sid));
    const extraTab = await a.newPage(); await field(extraTab, account, '웃지 말고'); await ready(extraTab);
    // Stop the API, not the static origin: WebKit setOffline has a known navigation issue.
    offlineBackend = true; await api.close();
    await extraTab.locator('[data-star="' + serious + '"]').click(); await extraTab.close();
    await field(pb, account, '좀 가까이'); await pb.locator('[data-star="' + closer + '"]').click();
    await pb.reload(); await pb.waitForSelector('.phrase');
    check(label + ' disconnected device retains its queued favorite after reload', await pb.evaluate(id => KWE.load().pins.includes(id), closer));
    await field(pa, account, '턱 내려'); await pa.locator('[data-star="' + chin + '"]').click();
    check(label + ' disconnected device also keeps queued removals', await pa.evaluate(id => !KWE.load().pins.includes(id), chin));
    api = createService({ dbPath, origins: [origin] }); await new Promise(resolve => api.server.listen(apiPort, '127.0.0.1', resolve)); offlineBackend = false;
    await Promise.all([pa.getByRole('button', { name: '설정', exact: true }).click(), pb.getByRole('button', { name: '설정', exact: true }).click()]);
    await Promise.all([pa.getByRole('button', { name: '지금 동기화', exact: true }).click(), pb.getByRole('button', { name: '지금 동기화', exact: true }).click()]);
    await hasPins(pa, [closer, family, joke, sid, serious], [chin]); await hasPins(pb, [closer, family, joke, sid, serious], [chin]);
    check(label + ' reconnect merges offline additions and removals after real SQLite restart', true);
    check(label + ' another tab delivers its pending edit after that tab closes', true);
    await pa.getByRole('button', { name: '설정 닫기' }).click(); await pb.getByRole('button', { name: '설정 닫기' }).click();
    await field(pa, account, '웃지 말고'); await pa.locator('[data-star="' + serious + '"]').click(); await hasPins(pb, [family], [serious]);
    await pa.reload(); await ready(pa); await hasPins(pa, [family], [serious]);
    check(label + ' acknowledged closed-tab journal cannot revive a later removal', true);
    await pb.goto(other + 'field.html#scope=saved'); await ready(pb); await pb.waitForFunction(() => KWE.load().pins.length === 0);
    check(label + ' changed Tailscale account never uploads previous account favorites', await pb.evaluate(() => KWE.load().pins.length === 0));
    await pb.goto(account + 'field.html#scope=saved'); await ready(pb); await hasPins(pb, [closer, family, joke, sid], [chin]);
    check(label + ' former account profile is restored on return', true);
    await pb.getByRole('button', { name: '설정', exact: true }).click();
    const [download] = await Promise.all([pb.waitForEvent('download'), pb.getByRole('button', { name: '백업 내보내기', exact: true }).click()]);
    await pb.locator('#import-file').setInputFiles(await download.path()); await pb.getByText('저장 목록의 교체는 연결된 다른 기기에도 반영됩니다.', { exact: true }).waitFor();
    check(label + ' backup replacement explains its effect on connected devices', true);
    await pb.getByRole('button', { name: '취소', exact: true }).click();
    const replacement = await pb.evaluate(id => ({ ...KWE.load(), pins: [id], kit: [] }), family);
    await pb.locator('#import-file').setInputFiles({ name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
    await pb.getByRole('button', { name: '확인하고 복원', exact: true }).click(); await ready(pb);
    await hasPins(pa, [family], [joke, closer, sid, serious, chin]);
    check(label + ' explicit backup replacement propagates its removals to other device', true);
    await pb.setViewportSize({ width: 320, height: 844 });
    check(label + ' sync status and settings fit 320px without overflow', await pb.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await pb.getByRole('button', { name: '설정', exact: true }).click(); await pb.screenshot({ path: path.join(artifacts, 'sync-settings-' + label + '.png') });
    await pb.getByRole('button', { name: '설정 닫기' }).click();
    const c = await browser.newContext(); await c.addInitScript(() => localStorage.setItem('kwe_state_v2', JSON.stringify({ version: 99, lessons: {}, pins: ['future-only-id'] })));
    const pc = await c.newPage(); await pc.goto(account + 'index.html'); await pc.getByText('기존 데이터 보호 중 · 원본 백업을 확인한 뒤 동기화하세요.', { exact: true }).first().waitFor();
    check(label + ' future local data is protected and never uploaded', await pc.evaluate(() => JSON.parse(localStorage.getItem('kwe_state_v2')).version === 99)); await c.close();
  } finally { await a.close(); await b.close(); await browser.close(); }
}
(async () => {
  await new Promise(resolve => frontend.listen(0, '127.0.0.1', resolve)); origin = 'http://127.0.0.1:' + frontend.address().port;
  api = createService({ dbPath, origins: [origin] }); await new Promise(resolve => api.server.listen(0, '127.0.0.1', resolve)); apiPort = api.server.address().port;
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve)); proxyOrigin = 'http://127.0.0.1:' + proxy.address().port;
  try {
    await run(chromium, 'chromium');
    // Independent server account state for the second engine's first-connection migration.
    await api.close(); fs.rmSync(dbPath, { force: true }); fs.rmSync(dbPath + '-wal', { force: true }); fs.rmSync(dbPath + '-shm', { force: true });
    api = createService({ dbPath, origins: [origin] }); await new Promise(resolve => api.server.listen(apiPort, '127.0.0.1', resolve));
    await run(webkit, 'webkit'); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(artifacts, 'sync-browser-results.json'), JSON.stringify({ checks, errors, engines: ['Chromium', 'WebKit'], realIPhone: false, storage: 'real SQLite', identity: 'test proxy modeling private Tailscale Serve' }, null, 2));
    console.log('PASS ' + checks.length + ' two-device sync assertions across Chromium and WebKit.');
  } finally { if (!offlineBackend) await api.close(); frontend.close(); proxy.close(); fs.rmSync(directory, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
