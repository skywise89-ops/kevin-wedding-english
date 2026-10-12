/* Durable local outbox, authenticated private Mac mini API, live saved collections. */
(function (global) {
  'use strict';
  var M = KWESyncModel, prefix = 'kwe_saved_sync_v1:', ownerKey = 'kwe_saved_sync_owner', actorKey = 'kwe_saved_sync_actor';
  var started = false, actor, owner = '', endpoint = '', meta, remote = {}, revision = -1, busy = false, again = false, connected = false, blocked = false;
  var stream, timer, retryTimer, overflow = 0, observed;
  function status(text, ok) {
    connected = !!ok;
    document.querySelectorAll('[data-sync-status]').forEach(function (element) { if (element.textContent !== text) element.textContent = text; });
  }
  function key() { return prefix + (owner || 'unlinked') + ':' + actor; }
  function cached(id) {
    var text = localStorage.getItem(prefix + id + ':cache');
    var value = text ? JSON.parse(text) : null;
    if (value && (value.version !== 1 || value.ownerId !== id || !Number.isSafeInteger(value.revision))) throw new Error('기기 연결 기록이 올바르지 않습니다.');
    return value;
  }
  function collect(target, id) {
    var cache = id ? cached(id) : null;
    if (cache) M.merge(target, cache.entries);
    var group = prefix + (id || 'unlinked') + ':';
    for (var i = 0; i < localStorage.length; i++) {
      var name = localStorage.key(i);
      if (!name.startsWith(group) || name.endsWith(':cache')) continue;
      var journal = M.restore(JSON.parse(localStorage.getItem(name))); M.merge(target, journal.entries);
    }
    return target;
  }
  function read(id) {
    return collect(M.create(actor), id);
  }
  function persist() {
    // Each tab owns its pending journal. Another tab can never overwrite an unsent edit.
    var entries = {};
    M.pending(meta, remote).forEach(function (row) { if (row.actor === actor) entries[row.key] = { clock: row.clock, actor: row.actor, value: row.value }; });
    localStorage.setItem(key(), JSON.stringify({ version: 1, actor: actor, clock: meta.clock, entries: entries, view: null }));
  }
  function capture(edit, replace) {
    if (!meta || blocked || !KWE.syncWritable()) return;
    var activeOwner = localStorage.getItem(ownerKey) || '';
    if (activeOwner && activeOwner !== owner) {
      if (!/^[a-f0-9]{64}$/.test(activeOwner)) throw new Error('기기 연결 정보가 올바르지 않습니다.');
      var persisted = JSON.parse(localStorage.getItem('kwe_state_v2'));
      if (!KWE.applySaved(M.saved(persisted))) throw new Error('변경된 계정의 목록을 열지 못했습니다.');
      var previous = meta, initial = !owner;
      stopStream(); owner = activeOwner; meta = read(owner); if (initial) M.merge(meta, previous.entries);
      observed = M.materialize(meta).saved; remote = {}; revision = -1;
    }
    collect(meta, owner); meta.actor = actor;
    var previousClock = meta.clock, previousCount = Object.keys(meta.entries).length;
    if (edit) {
      meta.view = observed;
      if (replace) M.replace(meta, KWE.savedState()); else M.observe(meta, KWE.savedState());
      observed = KWE.savedState();
    }
    persist();
    return previousClock !== meta.clock || previousCount !== Object.keys(meta.entries).length;
  }
  function stopStream() { if (stream) stream.close(); stream = null; }
  function openStream() {
    if (!owner || document.hidden || stream || !global.EventSource) return;
    stream = new EventSource(endpoint + '/v1/events');
    stream.onmessage = function (event) {
      try { if (JSON.parse(event.data).revision !== revision) schedule(150); } catch (_) {}
    };
    stream.onerror = function () { stopStream(); schedule(5000); };
  }
  function schedule(delay) {
    if (blocked || !started || !endpoint) return;
    clearTimeout(retryTimer); retryTimer = setTimeout(exchange, delay || 0);
  }
  async function request(path, options) {
    var controller = new AbortController(), timeout = setTimeout(function () { controller.abort(); }, 9000);
    try {
      var response = await fetch(endpoint + path, Object.assign({ mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal }, options || {}));
      if (response.status === 204) return null;
      var value = await response.json();
      if (!response.ok) { var error = new Error(value.error || '맥미니에 연결하지 못했습니다.'); error.status = response.status; throw error; }
      return value;
    } finally { clearTimeout(timeout); }
  }
  function bind(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('맥미니의 연결 정보가 올바르지 않습니다.');
    if (id === owner) return;
    capture(); stopStream();
    if (owner) {
      // A changed Tailscale identity gets its own profile; never upload the former user's list.
      var next = read(id), local = M.materialize(next).saved;
      if (!KWE.applySaved(local)) throw new Error('다른 계정의 목록을 열지 못했습니다. 기존 목록을 유지합니다.');
      meta = next; observed = KWE.savedState();
    }
    owner = id; localStorage.setItem(ownerKey, owner); persist(); remote = {}; revision = -1;
  }
  function accept(value) {
    if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0) throw new Error('맥미니의 동기화 응답이 올바르지 않습니다.');
    bind(value.ownerId); capture(); M.merge(meta, value.entries);
    remote = value.entries; revision = value.revision; persist();
    var previousCache = cached(owner);
    if (!previousCache || previousCache.revision <= value.revision) localStorage.setItem(prefix + owner + ':cache', JSON.stringify(value));
  }
  function apply() {
    var result = M.materialize(meta); overflow = result.overflow;
    if (!KWE.applySaved(result.saved)) throw new Error('동기화한 목록을 이 기기에 보관하지 못했습니다. 백업해 주세요.');
    observed = KWE.savedState(); meta.view = observed; persist();
  }
  function batch(rows) {
    var output = [], size = 0;
    for (var row of rows.slice(0, 200)) {
      var bytes = new TextEncoder().encode(JSON.stringify(row)).length;
      if (size + bytes > 480000) break;
      output.push(row); size += bytes;
    }
    return output;
  }
  async function exchange() {
    if (!endpoint || blocked || !KWE.syncWritable()) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      capture();
      var query = owner && revision >= 0 ? '?owner=' + owner + '&since=' + revision : '';
      var value = await request('/v1/state' + query);
      if (value) accept(value);
      if (!owner) throw new Error('맥미니 연결 계정을 확인하지 못했습니다.');
      for (var n = 0; n < 6; n++) {
        capture(); var rows = M.pending(meta, remote);
        if (!rows.length) break;
        status('맥미니에 ' + rows.length + '개 변경 전송 중', false);
        value = await request('/v1/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerId: owner, operations: batch(rows) }) });
        accept(value);
      }
      capture(); apply();
      var remaining = M.pending(meta, remote).length;
      if (remaining) { again = true; status('이 기기에 저장됨 · 남은 변경 전송 중', false); }
      else { status('맥미니와 동기화됨' + (overflow ? ' · 촬영 준비 ' + overflow + '개 더 보관 중. 목록에서 빼면 다음 말이 나타나요.' : ''), true); openStream(); }
    } catch (error) {
      stopStream();
      if (error.status === 409) { revision = -1; again = true; }
      status(error.status === 401 ? 'Tailscale에서 같은 계정으로 연결해 주세요. 이 기기의 저장 목록은 유지됩니다.' : navigator.onLine === false ? '오프라인 · 이 기기에 저장됨. 연결되면 자동 전송합니다.' : error.message && !['TypeError', 'AbortError'].includes(error.name) ? error.message : '맥미니에 연결하지 못했어요. Tailscale을 켜고 다시 연결하세요. 변경은 이 기기에 저장됩니다.', false);
    } finally { busy = false; if (again) { again = false; schedule(250); } }
  }
  function start() {
    if (started) return; started = true;
    var footer = document.querySelector('footer');
    if (footer && !footer.querySelector('[data-sync-status]')) { var line = document.createElement('p'); line.dataset.syncStatus = ''; line.setAttribute('role', 'status'); footer.appendChild(line); }
    document.querySelectorAll('[data-sync-retry]').forEach(function (button) { button.onclick = function () { schedule(0); }; });
    if (!KWE.syncWritable()) { blocked = true; status('기존 데이터 보호 중 · 원본 백업을 확인한 뒤 동기화하세요.', false); return; }
    try {
      actor = sessionStorage.getItem(actorKey);
      if (!actor) { actor = 'device-' + (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16))).map(function (n) { return n.toString(16).padStart(2, '0'); }).join('')); sessionStorage.setItem(actorKey, actor); }
      owner = localStorage.getItem(ownerKey) || '';
      if (owner && !/^[a-f0-9]{64}$/.test(owner)) throw new Error('기기 연결 정보가 올바르지 않습니다.');
      meta = read(owner); observed = KWE.savedState();
      // Bootstrap imports only unknown positive records. Removals are explicit saved events.
      var seed = M.observe(M.create(actor), observed);
      Object.keys(seed.entries).forEach(function (name) { if (!meta.entries[name]) meta.entries[name] = seed.entries[name]; });
      capture();
    } catch (_) { blocked = true; status('동기화 기록을 읽거나 보관하지 못했어요. 저장 목록을 백업해 주세요.', false); return; }
    global.addEventListener('kwe-sync-change', function () { observed = KWE.savedState(); });
    global.addEventListener('kwe-local-save', function (event) {
      try { if (capture(true, event.detail && event.detail.replace)) { status('이 기기에 저장됨 · 맥미니로 전송 대기', false); schedule(200); } }
      catch (_) { status('동기화 대기 기록을 보관하지 못했어요. 저장 목록을 백업해 주세요.', false); }
    });
    global.addEventListener('online', function () { schedule(0); });
    global.addEventListener('storage', function (event) { if (event.key === ownerKey) schedule(0); });
    global.addEventListener('offline', function () { stopStream(); status('오프라인 · 이 기기에 저장됨. 연결되면 자동 전송합니다.', false); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopStream(); else schedule(0); });
    global.addEventListener('pagehide', function () { stopStream(); clearInterval(timer); clearTimeout(retryTimer); });
    global.addEventListener('pageshow', function (event) { if (event.persisted) { timer = setInterval(function () { if (!document.hidden) schedule(0); }, 15000); schedule(0); } });
    status('맥미니 연결 확인 중', false);
    fetch(KWE.base() + 'data/sync-config.json').then(function (response) { if (!response.ok) throw new Error('동기화 설정을 불러오지 못했습니다.'); return response.json(); }).then(function (config) {
      if (!config.endpoint) { status('이 기기에 저장됨 · 동기화 서버 미설정', false); return; }
      var url = new URL(config.endpoint);
      if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('HTTPS 동기화 서버 주소가 필요합니다.');
      endpoint = url.href.replace(/\/$/, '');
      timer = setInterval(function () { if (!document.hidden) schedule(0); }, 15000); schedule(0);
    }).catch(function (error) { status(error.message + ' 저장 목록은 이 기기에 유지됩니다.', false); });
  }
  global.KWESync = { start: start, connected: function () { return connected; }, retry: function () { schedule(0); } };
})(window);
