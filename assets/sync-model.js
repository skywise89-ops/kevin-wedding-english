/* Saved collections converge with logical clocks, including removal tombstones. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./model.js'));
  else root.KWESyncModel = factory(root.KWEModel);
})(typeof window === 'undefined' ? globalThis : window, function (M) {
  'use strict';
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + stable(value[key]); }).join(',') + '}';
    return JSON.stringify(value);
  }
  function fail() { throw new Error('동기화 데이터 형식이 올바르지 않습니다. 기존 저장 목록은 유지됩니다.'); }
  function saved(raw) {
    var n = M.normalize({ lessons: {}, pins: raw.pins, sentences: raw.sentences, kit: raw.kit, kitName: raw.kitName });
    return copy({ pins: n.pins, sentences: n.sentences, kit: n.kit, kitName: n.kitName });
  }
  function validate(key, entry) {
    if (typeof key !== 'string' || key.length > 154 || !/^[pskn]:/.test(key)) fail();
    if (!entry || Array.isArray(entry) || Object.keys(entry).sort().join(',') !== 'actor,clock,value') fail();
    if (!Number.isSafeInteger(entry.clock) || entry.clock < 0 || entry.clock > 1000000000 || typeof entry.actor !== 'string' || !/^[a-z0-9-]{8,80}$/.test(entry.actor)) fail();
    var id = key.slice(2), kind = key[0], value = entry.value;
    if (!id || id.length > 150) fail();
    if (kind === 'p' && typeof value !== 'boolean') fail();
    if (kind === 'k' && value !== null && (!value || Object.keys(value).join(',') !== 'order' || !Number.isInteger(value.order) || value.order < 0 || value.order > 1000)) fail();
    if (kind === 'n' && (id !== 'kitName' || typeof value !== 'string' || value.length > 40)) fail();
    if (kind === 's' && value !== null) M.normalize({ lessons: {}, sentences: { [id]: value } });
    return entry;
  }
  function compare(a, b) {
    if (!b) return 1;
    return a.clock - b.clock || (a.actor > b.actor ? 1 : a.actor < b.actor ? -1 : 0);
  }
  function flat(raw) {
    var s = saved(raw), values = {};
    s.pins.forEach(function (id) { values['p:' + id] = true; });
    Object.keys(s.sentences).forEach(function (id) { values['s:' + id] = s.sentences[id]; });
    s.kit.forEach(function (id, index) { values['k:' + id] = { order: index }; });
    values['n:kitName'] = s.kitName;
    return values;
  }
  function create(actor) {
    if (!/^[a-z0-9-]{8,80}$/.test(actor)) fail();
    return { version: 1, actor: actor, clock: 0, entries: {}, view: null };
  }
  function restore(raw) {
    if (!raw || raw.version !== 1 || !Number.isSafeInteger(raw.clock) || raw.clock < 0 || raw.clock > 1000000000 || !raw.entries || Array.isArray(raw.entries) || Object.keys(raw.entries).length > 6000) fail();
    var meta = create(raw.actor); meta.clock = raw.clock;
    Object.keys(raw.entries).forEach(function (key) { meta.entries[key] = copy(validate(key, raw.entries[key])); meta.clock = Math.max(meta.clock, meta.entries[key].clock); });
    meta.view = raw.view === null ? null : saved(raw.view);
    return meta;
  }
  function observe(meta, raw) {
    var next = saved(raw), after = flat(next), before = meta.view === null ? {} : flat(meta.view), initial = meta.view === null;
    Array.from(new Set(Object.keys(before).concat(Object.keys(after)))).forEach(function (key) {
      if (stable(before[key]) === stable(after[key])) return;
      var value = Object.prototype.hasOwnProperty.call(after, key) ? after[key] : key[0] === 'p' ? false : null;
      var entry = { clock: initial ? 0 : ++meta.clock, actor: meta.actor, value: copy(value) };
      validate(key, entry); meta.entries[key] = entry;
    });
    meta.view = next;
    return meta;
  }
  function merge(meta, entries) {
    if (!entries || Array.isArray(entries) || Object.keys(entries).length > 6000) fail();
    // Validate everything before changing the durable journal.
    Object.keys(entries).forEach(function (key) {
      validate(key, entries[key]);
      var current = meta.entries[key];
      if (current && compare(entries[key], current) === 0 && stable(entries[key].value) !== stable(current.value)) fail();
    });
    Object.keys(entries).forEach(function (key) {
      var entry = entries[key], current = meta.entries[key];
      meta.clock = Math.max(meta.clock, entry.clock);
      if (compare(entry, current) > 0) meta.entries[key] = copy(entry);
    });
    return meta;
  }
  function pending(meta, remote) {
    return Object.keys(meta.entries).filter(function (key) { return compare(meta.entries[key], remote[key]) > 0; }).map(function (key) { return Object.assign({ key: key }, copy(meta.entries[key])); });
  }
  function replace(meta, raw) {
    var next = saved(raw), values = flat(next);
    Array.from(new Set(Object.keys(meta.entries).concat(Object.keys(values)))).forEach(function (key) {
      var value = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : key[0] === 'p' ? false : null;
      if (meta.entries[key] && stable(meta.entries[key].value) === stable(value)) return;
      var entry = { clock: ++meta.clock, actor: meta.actor, value: copy(value) };
      validate(key, entry); meta.entries[key] = entry;
    });
    meta.view = next; return meta;
  }
  function materialize(meta) {
    var result = { pins: [], sentences: {}, kit: [], kitName: '이번 촬영' }, kit = [];
    Object.keys(meta.entries).sort().forEach(function (key) {
      var entry = meta.entries[key], id = key.slice(2);
      if (key[0] === 'p' && entry.value) result.pins.push(id);
      if (key[0] === 's' && entry.value !== null) result.sentences[id] = copy(entry.value);
      if (key[0] === 'k' && entry.value !== null) kit.push({ id: id, entry: entry });
      if (key === 'n:kitName') result.kitName = entry.value;
    });
    if (result.pins.length > 1000 || Object.keys(result.sentences).length > 500) throw new Error('합친 저장 목록이 앱의 보관 한도를 넘었습니다. 기존 목록을 백업하고 정리해 주세요.');
    kit.sort(function (a, b) { return a.entry.value.order - b.entry.value.order || compare(b.entry, a.entry) || (a.id > b.id ? 1 : a.id < b.id ? -1 : 0); });
    result.kit = kit.slice(0, 24).map(function (row) { return row.id; });
    return { saved: saved(result), overflow: Math.max(0, kit.length - 24) };
  }
  function rebase(before, desired, latest) {
    var base = flat(before), next = flat(desired), values = flat(latest), meta = create('rebase-preview');
    Array.from(new Set(Object.keys(base).concat(Object.keys(next)))).forEach(function (key) {
      if (stable(base[key]) === stable(next[key])) return;
      if (Object.prototype.hasOwnProperty.call(next, key)) values[key] = next[key]; else delete values[key];
    });
    Object.keys(values).forEach(function (key) { meta.entries[key] = { clock: 0, actor: meta.actor, value: values[key] }; });
    return materialize(meta).saved;
  }
  return { create: create, restore: restore, saved: saved, observe: observe, replace: replace, merge: merge, pending: pending, materialize: materialize, rebase: rebase, validate: validate, compare: compare, stable: stable };
});
