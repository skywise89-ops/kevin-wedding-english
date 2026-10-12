'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const M = require('../assets/sync-model.js');
const { createService } = require('../server/main.cjs');
const empty = () => ({ pins: [], sentences: {}, kit: [], kitName: '이번 촬영' });
const state = (pins = [], kit = []) => ({ ...empty(), pins, kit });
const material = meta => M.materialize(meta).saved;
const seeded = (actor, raw) => M.observe(M.create(actor), raw);

test('first connection unions original saved expressions from both devices', () => {
  const a = seeded('device-aaaaaaaa', state(['a'])), b = seeded('device-bbbbbbbb', state(['b']));
  M.merge(a, b.entries); M.merge(b, a.entries);
  assert.deepEqual(material(a).pins, ['a', 'b']); assert.deepEqual(material(a), material(b));
});
test('deleted expressions stay removed when an old, not-yet-connected device imports them', () => {
  const a = seeded('device-aaaaaaaa', state(['a'])); M.observe(a, state());
  const stale = seeded('device-bbbbbbbb', state(['a', 'b']));
  M.merge(a, stale.entries); M.merge(stale, a.entries);
  assert.deepEqual(material(a).pins, ['b']); assert.deepEqual(material(a), material(stale));
});
test('offline additions and removals of distinct expressions survive reconnect in either order', () => {
  const a = seeded('device-aaaaaaaa', state(['a'])), b = seeded('device-bbbbbbbb', state(['a']));
  M.merge(a, b.entries); M.merge(b, a.entries); a.view = material(a); b.view = material(b);
  M.observe(a, state([])); M.observe(b, state(['a', 'b']));
  M.merge(a, b.entries); M.merge(b, a.entries);
  assert.deepEqual(material(a).pins, ['b']); assert.deepEqual(material(a), material(b));
});
test('same-expression concurrent conflicts converge deterministically and keep tombstones', () => {
  const a = seeded('device-aaaaaaaa', state()), b = seeded('device-zzzzzzzz', state(['a']));
  M.observe(a, state(['a'])); M.observe(b, state());
  M.merge(a, b.entries); M.merge(b, a.entries);
  assert.deepEqual(material(a).pins, []); assert.deepEqual(material(a), material(b)); assert.equal(a.entries['p:a'].value, false);
});
test('shooting kit order, name and removal synchronize', () => {
  const a = seeded('device-aaaaaaaa', state([], ['a', 'b']));
  const b = seeded('device-bbbbbbbb', state()); M.merge(b, a.entries); b.view = material(b);
  M.observe(b, { ...state([], ['b']), kitName: '토요일' }); M.merge(a, b.entries);
  assert.deepEqual(material(a).kit, ['b']); assert.equal(material(a).kitName, '토요일'); assert.equal(a.entries['k:a'].value, null);
});
test('supplemental lesson sentence text and translation travel with its canonical saved ID', () => {
  const id = 'lesson-sentence-' + 'a'.repeat(24);
  const sentence = { id, en: 'No rush at all.', ko: '천천히 하세요.', cat: 'arrival', situation: '도착', note: '기다리기', lessons: [1], src: 'saved-lesson' };
  const a = seeded('device-aaaaaaaa', { ...state([id]), sentences: { [id]: sentence } }), b = seeded('device-bbbbbbbb', state());
  M.merge(b, a.entries); assert.deepEqual(material(b).sentences[id], sentence); assert.equal(material(b).pins[0], id);
});
test('invalid or inconsistent remote records fail atomically', () => {
  const a = seeded('device-aaaaaaaa', state(['a'])), before = M.stable(a);
  assert.throws(() => M.merge(a, { 'p:b': { clock: 5, actor: 'device-bbbbbbbb', value: true }, 'p:a': { ...a.entries['p:a'], value: false } }));
  assert.equal(M.stable(a), before);
  for (const entry of [{ clock: -1, actor: 'device-aaaaaaaa', value: true }, { clock: 1, actor: 'x', value: true }, { clock: 1, actor: 'device-aaaaaaaa', value: '<script>' }]) assert.throws(() => M.validate('p:a', entry));
  assert.throws(() => M.restore({ ...a, version: 99 }));
});
test('overlapping browser tabs rebase only intended changes', () => {
  assert.deepEqual(M.rebase(state(), state(['b']), state(['a'])).pins, ['a', 'b']);
  assert.deepEqual(M.rebase(state(['a']), state(), state(['a', 'b'])).pins, ['b']);
});
test('concurrent kits over 24 retain overflow records rather than deleting them', () => {
  const a = seeded('device-aaaaaaaa', state([], Array.from({ length: 24 }, (_, i) => 'a' + i)));
  const b = seeded('device-bbbbbbbb', state([], ['b1', 'b2'])); M.merge(a, b.entries);
  const result = M.materialize(a); assert.equal(result.saved.kit.length, 24); assert.equal(result.overflow, 2);
  a.view = result.saved; M.observe(a, { ...result.saved, pins: ['hello'] });
  assert.equal(Object.keys(a.entries).filter(k => k.startsWith('k:') && a.entries[k].value !== null).length, 26);
});
test('local journal roundtrip keeps pending removals and original local collection', () => {
  const a = seeded('device-aaaaaaaa', state(['a'])); M.observe(a, state(['b']));
  const restored = M.restore(JSON.parse(JSON.stringify(a)));
  assert.deepEqual(restored, a); assert.ok(M.pending(restored, {}).some(row => row.key === 'p:a' && row.value === false));
});
test('explicit backup replacement clears all known saved and overflow kit entries', () => {
  const a = seeded('device-aaaaaaaa', state(['a'], Array.from({ length: 24 }, (_, i) => 'a' + i)));
  const b = seeded('device-bbbbbbbb', state(['b'], ['b1', 'b2'])); M.merge(a, b.entries);
  M.replace(a, state(['kept']));
  assert.deepEqual(material(a).pins, ['kept']); assert.deepEqual(material(a).kit, []);
  assert.ok(Object.values(a.entries).filter(x => x.value === null).length >= 26);
});

test('Mac mini API authenticates, isolates users, merges atomically and persists SQLite backups', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kwe-sync-'));
  const dbPath = path.join(directory, 'saved.sqlite');
  let service = createService({ dbPath, origins: ['https://skywise89-ops.github.io'] });
  await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
  let base = 'http://127.0.0.1:' + service.server.address().port;
  const get = (url, user) => fetch(base + url, { headers: user ? { 'Tailscale-User-Login': user } : {} });
  const post = (payload, user = 'alice@example.com', origin = 'https://skywise89-ops.github.io') => fetch(base + '/v1/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Tailscale-User-Login': user, Origin: origin }, body: JSON.stringify(payload) });
  try {
    assert.equal((await get('/health')).status, 200); assert.equal((await get('/v1/state')).status, 401);
    const a = await (await get('/v1/state', 'alice@example.com')).json(), b = await (await get('/v1/state', 'bob@example.com')).json();
    assert.notEqual(a.ownerId, b.ownerId);
    const one = { key: 'p:hello', clock: 1, actor: 'device-aaaaaaaa', value: true };
    let response = await post({ ownerId: a.ownerId, operations: [one] }); assert.equal(response.status, 200);
    let current = await response.json(); assert.equal(current.entries['p:hello'].value, true); assert.equal(current.revision, 1);
    assert.deepEqual((await (await get('/v1/state', 'bob@example.com')).json()).entries, {});
    assert.equal((await post({ ownerId: a.ownerId, operations: [one] }, 'bob@example.com')).status, 409);
    assert.equal((await post({ ownerId: a.ownerId, operations: [one] }, 'alice@example.com', 'https://evil.example')).status, 403);
    assert.equal((await get('/v1/state?owner=' + a.ownerId + '&since=1', 'alice@example.com')).status, 204);
    assert.equal((await get('/v1/state?owner=' + a.ownerId + '&since=0', 'bob@example.com')).status, 200);
    const two = { key: 'p:second', clock: 2, actor: 'device-aaaaaaaa', value: true };
    assert.equal((await post({ ownerId: a.ownerId, operations: [two, { ...one, value: false }] })).status, 400);
    assert.equal((await (await get('/v1/state', 'alice@example.com')).json()).entries['p:second'], undefined);
    response = await post({ ownerId: a.ownerId, operations: [{ ...one, clock: 3, value: false }, two] }); assert.equal(response.status, 200);
    current = await response.json(); assert.equal(current.entries['p:hello'].value, false);
    await post({ ownerId: a.ownerId, operations: [one] }); assert.equal((await (await get('/v1/state', 'alice@example.com')).json()).entries['p:hello'].value, false);
    const preflight = await fetch(base + '/v1/sync', { method: 'OPTIONS', headers: { Origin: 'https://skywise89-ops.github.io', 'Access-Control-Request-Headers': 'content-type', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Private-Network': 'true' } });
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');
    const file = service.backup(); assert.ok(fs.existsSync(file)); assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    await service.close(); service = createService({ dbPath });
    await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + service.server.address().port;
    const restored = await (await get('/wedding-sync/v1/state', 'alice@example.com')).json();
    assert.equal(restored.ownerId, a.ownerId); assert.equal(restored.entries['p:hello'].value, false); assert.equal(restored.entries['p:second'].value, true);
  } finally { await service.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
