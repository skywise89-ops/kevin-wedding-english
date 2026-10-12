/* Private Tailscale Serve backend. No public Funnel, passwords or cloud SDK. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const Model = require('../assets/sync-model.js');

function createService(options = {}) {
  const dbPath = options.dbPath || path.join(os.homedir(), 'Library/Application Support/WeddingEnglishSync/data/saved.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS entries (owner TEXT NOT NULL, item TEXT NOT NULL, clock INTEGER NOT NULL, actor TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(owner,item)); CREATE TABLE IF NOT EXISTS revisions (owner TEXT PRIMARY KEY, revision INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);');
  try { fs.chmodSync(dbPath, 0o600); } catch (_) {}
  db.prepare('INSERT OR IGNORE INTO settings VALUES (?,?)').run('instance', crypto.randomUUID());
  const instance = db.prepare('SELECT value FROM settings WHERE name=?').get('instance').value;
  const origins = new Set(options.origins || ['https://skywise89-ops.github.io']);
  const listeners = new Map(), rate = new Map();
  const readRows = db.prepare('SELECT item,clock,actor,value FROM entries WHERE owner=?');
  const readRevision = db.prepare('SELECT revision FROM revisions WHERE owner=?');
  const write = db.prepare('INSERT INTO entries VALUES (?,?,?,?,?) ON CONFLICT(owner,item) DO UPDATE SET clock=excluded.clock,actor=excluded.actor,value=excluded.value');
  function snapshot(owner) {
    const entries = {};
    for (const row of readRows.all(owner)) entries[row.item] = { clock: row.clock, actor: row.actor, value: JSON.parse(row.value) };
    return { version: 1, ownerId: owner, revision: readRevision.get(owner)?.revision || 0, entries };
  }
  function identity(request) {
    // This header is stripped and re-created by Tailscale Serve. Listen on loopback only.
    const login = options.identity ? options.identity(request) : request.headers['tailscale-user-login'];
    if (typeof login !== 'string' || !login.trim() || login.length > 512) return null;
    return crypto.createHash('sha256').update(instance + '\0' + login.trim().toLowerCase()).digest('hex');
  }
  function send(response, status, data) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(data === undefined ? '' : JSON.stringify(data));
  }
  function notify(owner) {
    const revision = readRevision.get(owner)?.revision || 0;
    for (const response of listeners.get(owner) || []) response.write('data: ' + JSON.stringify({ revision }) + '\n\n');
  }
  async function body(request) {
    if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw Object.assign(new Error('JSON 요청이 필요합니다.'), { status: 415 });
    if (Number(request.headers['content-length']) > 524288) throw Object.assign(new Error('한 번에 보낼 데이터가 너무 큽니다.'), { status: 413 });
    let size = 0, chunks = [];
    for await (const chunk of request) { size += chunk.length; if (size > 524288) throw Object.assign(new Error('한 번에 보낼 데이터가 너무 큽니다.'), { status: 413 }); chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { throw Object.assign(new Error('JSON 형식이 올바르지 않습니다.'), { status: 400 }); }
  }
  const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = request.headers.origin;
    if (origin && !origins.has(origin)) { send(response, 403, { error: '허용되지 않은 앱 주소입니다.' }); return; }
    if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
    if (request.method === 'OPTIONS') {
      const headers = (request.headers['access-control-request-headers'] || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (headers.some(h => h !== 'content-type')) { send(response, 403, { error: '허용되지 않은 요청 헤더입니다.' }); return; }
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type'); response.setHeader('Access-Control-Allow-Private-Network', 'true'); send(response, 204); return;
    }
    const url = new URL(request.url, 'http://localhost'), route = url.pathname.replace(/^\/wedding-sync(?=\/|$)/, '') || '/';
    if (route === '/health' && request.method === 'GET') { send(response, 200, { ok: true, service: 'wedding-english-sync', version: 1 }); return; }
    const owner = identity(request);
    if (!owner) { send(response, 401, { error: 'Tailscale에서 같은 계정으로 연결해 주세요.' }); return; }
    const now = Date.now(), limited = rate.get(owner);
    if (!limited || now - limited.start > 60000) rate.set(owner, { start: now, count: 1 });
    else if (++limited.count > 180) { send(response, 429, { error: '잠시 후 다시 연결해 주세요.' }); return; }
    try {
      if (route === '/v1/state' && request.method === 'GET') {
        const state = snapshot(owner);
        if (url.searchParams.get('owner') === owner && url.searchParams.get('since') === String(state.revision)) send(response, 204);
        else send(response, 200, state);
        return;
      }
      if (route === '/v1/events' && request.method === 'GET') {
        if ((listeners.get(owner)?.size || 0) >= 12) { send(response, 429, { error: '열린 앱 창을 줄여 주세요.' }); return; }
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive' });
        response.write('retry: 5000\n\ndata: ' + JSON.stringify({ revision: readRevision.get(owner)?.revision || 0 }) + '\n\n');
        if (!listeners.has(owner)) listeners.set(owner, new Set()); listeners.get(owner).add(response);
        const heartbeat = setInterval(() => response.write(': keepalive\n\n'), 20000);
        response.on('close', () => { clearInterval(heartbeat); listeners.get(owner)?.delete(response); if (!listeners.get(owner)?.size) listeners.delete(owner); });
        return;
      }
      if (route === '/v1/sync' && request.method === 'POST') {
        const payload = await body(request);
        if (!payload || payload.ownerId !== owner) { send(response, 409, { error: '연결 계정이 바뀌었습니다. 다시 연결해 주세요.' }); return; }
        if (!Array.isArray(payload.operations) || payload.operations.length > 300) throw new Error('동기화 요청 개수가 올바르지 않습니다.');
        for (const operation of payload.operations) {
          if (!operation || Object.keys(operation).sort().join(',') !== 'actor,clock,key,value') throw new Error('동기화 요청 형식이 올바르지 않습니다.');
          Model.validate(operation.key, { clock: operation.clock, actor: operation.actor, value: operation.value });
        }
        let changed = false;
        db.exec('BEGIN IMMEDIATE');
        try {
          const state = snapshot(owner), combined = Object.assign({}, state.entries);
          for (const operation of payload.operations) {
            const entry = { clock: operation.clock, actor: operation.actor, value: operation.value }, previous = combined[operation.key];
            if (Model.compare(entry, previous) > 0) { combined[operation.key] = entry; changed = true; }
            else if (previous && Model.compare(entry, previous) === 0 && Model.stable(entry.value) !== Model.stable(previous.value)) throw new Error('같은 수정 기록에 다른 값이 있습니다.');
          }
          if (Object.keys(combined).length > 6000) throw new Error('저장 기록의 보관 한도를 넘었습니다.');
          if (changed) {
            for (const [key, entry] of Object.entries(combined)) if (Model.compare(entry, state.entries[key]) > 0) write.run(owner, key, entry.clock, entry.actor, JSON.stringify(entry.value));
            db.prepare('INSERT INTO revisions VALUES (?,1) ON CONFLICT(owner) DO UPDATE SET revision=revision+1').run(owner);
          }
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        send(response, 200, snapshot(owner)); if (changed) notify(owner); return;
      }
      send(response, 404, { error: '요청한 경로가 없습니다.' });
    } catch (error) { if (!response.headersSent) send(response, error.status || 400, { error: error.message }); else response.end(); }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  function backup(directory = path.join(path.dirname(dbPath), 'backups')) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const file = path.join(directory, 'saved-' + new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite');
    db.prepare('VACUUM INTO ?').run(file); fs.chmodSync(file, 0o600); return file;
  }
  server.on('close', () => db.close());
  return { server, db, snapshot, backup, close: async () => { for (const clients of listeners.values()) for (const response of clients) response.end(); await new Promise(resolve => server.close(resolve)); } };
}
if (require.main === module) {
  process.umask(0o077);
  const service = createService();
  if (process.argv.includes('--backup')) { console.log(service.backup()); service.db.close(); }
  else {
    service.server.listen(Number(process.env.KWE_SYNC_PORT || 18790), '127.0.0.1', () => console.log('Wedding English sync listening on loopback.'));
    const backupTimer = setInterval(() => { try { service.backup(); } catch (_) { console.error('Daily backup failed.'); } }, 86400000); backupTimer.unref();
    process.on('SIGTERM', () => { service.close().then(() => process.exit(0)); });
  }
}
module.exports = { createService };
