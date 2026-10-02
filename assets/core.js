/* Kevin's Wedding English — core (state, SRS, TTS, UI helpers)  v2 */
(function (global) {
  'use strict';

  var KEY = 'kwe_state_v2';
  var LEGACY = 'kwe_progress_v1';

  /* ---------- date helpers (로컬 자정 기준) ---------- */
  function ymd(d) {
    d = d || new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function parseYmd(s) { var a = String(s).split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function addDays(s, n) { var d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
  function diffDays(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }
  function today() { return ymd(); }

  /* ---------- state ---------- */
  var DEFAULTS = KWEModel.defaults;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var state = null, storageBlocked = false;
  function load() {
    if (state) return state;
    var raw = null, text;
    try {
      text = localStorage.getItem(KEY);
      raw = text ? KWEModel.normalize(JSON.parse(text)) : migrate();
      if (raw) raw = KWEModel.normalize(raw);
    } catch (e) {
      storageBlocked = true;
      setTimeout(function () { toast('저장 데이터를 읽지 못했습니다. 설정에서 원본 백업을 내려받아 주세요.'); }, 500);
    }
    state = raw || clone(DEFAULTS);
    return state;
  }
  function migrate() {
    var old = null;
    try { old = JSON.parse(localStorage.getItem(LEGACY)); } catch (e) { }
    if (!old) return null;
    var s = clone(DEFAULTS);
    Object.keys(old).forEach(function (id) {
      var r = old[id];
      if (!r || !r.completed) return;
      var d = r.date || today();
      s.lessons[id] = { done: true, first: d, last: d, reps: 1, ease: 2.5, interval: 1, due: addDays(d, 1), lapses: 0 };
      if (!s.days[d]) s.days[d] = { lessons: [], quiz: [0, 0], cards: 0 };
      s.days[d].lessons.push(Number(id));
    });
    return s;
  }
  function save() {
    if (storageBlocked) { toast('기존 데이터 보호 중입니다. 설정에서 백업 후 복원해 주세요.'); return false; }
    try { localStorage.setItem(KEY, JSON.stringify(load())); return true; }
    catch (e) { toast('저장 공간을 사용할 수 없습니다. 변경 내용을 백업해 주세요.'); return false; }
  }

  /* ---------- day log / streak ---------- */
  function day(d) {
    var s = load(); d = d || today();
    if (!s.days[d]) s.days[d] = { lessons: [], quiz: [0, 0], cards: 0 };
    return s.days[d];
  }
  function streak() {
    var s = load(), cur = 0, longest = 0, run = 0;
    var keys = Object.keys(s.days).filter(function (k) { return active(s.days[k]); }).sort();
    if (!keys.length) return { current: 0, longest: 0, days: 0 };
    for (var i = 0; i < keys.length; i++) {
      run = (i > 0 && diffDays(keys[i - 1], keys[i]) === 1) ? run + 1 : 1;
      if (run > longest) longest = run;
    }
    var t = today(), last = keys[keys.length - 1];
    if (last === t || last === addDays(t, -1)) {
      cur = 1;
      for (var j = keys.length - 1; j > 0; j--) {
        if (diffDays(keys[j - 1], keys[j]) === 1) cur++; else break;
      }
    }
    return { current: cur, longest: longest, days: keys.length };
  }
  function active(d) { return d && (d.lessons.length || d.cards || (d.quiz && d.quiz[1])); }

  /* ---------- SRS (SM-2 lite) ---------- */
  // grade: 1 다시, 3 어려움, 4 보통, 5 쉬움
  function schedule(card, grade) {
    var c = card || { reps: 0, ease: 2.5, interval: 0, lapses: 0 };
    if (grade < 3) {
      c.reps = 0; c.interval = 1; c.lapses = (c.lapses || 0) + 1;
    } else {
      c.reps = (c.reps || 0) + 1;
      c.interval = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.max(1, Math.round(c.interval * c.ease));
    }
    c.ease = Math.min(2.8, Math.max(1.3, (c.ease || 2.5) + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))));
    c.ease = Math.round(c.ease * 100) / 100;
    c.due = addDays(today(), c.interval);
    c.last = today(); c.lastGrade = grade;
    return c;
  }

  function completeLesson(id, grade) {
    var s = load(); id = String(id);
    grade = grade || 4;
    var rec = s.lessons[id] || { done: false, first: today(), reps: 0, ease: 2.5, interval: 0, lapses: 0 };
    if (!rec.first) rec.first = today();
    rec = Object.assign(rec, schedule(rec, grade));
    rec.done = true;
    s.lessons[id] = rec;
    var d = day();
    if (d.lessons.indexOf(Number(id)) < 0) d.lessons.push(Number(id));
    save();
    return rec;
  }
  function resetLesson(id) { var s = load(); delete s.lessons[String(id)]; save(); }

  function dueLessons(lessons) {
    var s = load(), t = today(), out = [];
    lessons.forEach(function (l) {
      var r = s.lessons[String(l.id)];
      if (!r || !r.done || !r.due) return;
      var over = diffDays(r.due, t);
      if (over >= 0) out.push({ lesson: l, rec: r, overdue: over });
    });
    out.sort(function (a, b) { return b.overdue - a.overdue || a.lesson.id - b.lesson.id; });
    return out;
  }
  function nextLesson(lessons) {
    var s = load();
    var todo = lessons.filter(function (l) { return !(s.lessons[String(l.id)] || {}).done; });
    if (todo.length) return todo[0];
    // 한 사이클 끝 → 가장 오래된 복습 대상, 없으면 Day 1
    var due = dueLessons(lessons);
    return due.length ? due[0].lesson : lessons[0];
  }
  function stats(lessons) {
    var s = load(), done = 0, byWeek = { 1: 0, 2: 0, 3: 0, 4: 0 };
    lessons.forEach(function (l) {
      if ((s.lessons[String(l.id)] || {}).done) { done++; byWeek[l.week] = (byWeek[l.week] || 0) + 1; }
    });
    var st = streak();
    return {
      done: done, total: lessons.length, pct: lessons.length ? Math.round(done / lessons.length * 100) : 0,
      byWeek: byWeek, streak: st.current, longest: st.longest, activeDays: st.days,
      due: dueLessons(lessons).length, pins: load().pins.length
    };
  }

  /* ---------- pins ---------- */
  function isPinned(id) { return load().pins.indexOf(id) >= 0; }
  function togglePin(id) {
    var s = load(), before = load().pins.slice(), i = s.pins.indexOf(id);
    if (i < 0) s.pins.unshift(id); else s.pins.splice(i, 1);
    if (!save()) { s.pins = before; return null; } return i < 0;
  }
  function toggleSentence(p) {
    if (!p || p.src !== 'saved-lesson') return p && p.id ? togglePin(p.id) : null;
    var sentence;
    try { sentence = KWEModel.normalize({ lessons: {}, sentences: { [p.id]: p } }).sentences[p.id]; }
    catch (e) { toast('이 문장을 저장하지 못했습니다. 다시 열어 주세요.'); return null; }
    var s = load(), before = s.sentences[p.id];
    if (!before && Object.keys(s.sentences).length >= 500) { toast('레슨 문장을 더 보관할 공간이 없습니다. 백업 후 정리해 주세요.'); return null; }
    s.sentences[p.id] = sentence;
    var result = togglePin(p.id);
    if (result === null) { if (before) s.sentences[p.id] = before; else delete s.sentences[p.id]; }
    return result;
  }
  function toggleKit(id) {
    var s = load(), before = load().kit.slice(), i = s.kit.indexOf(id);
    if (i < 0) {
      if (s.kit.length >= 24) { toast('촬영 준비는 최대 24개입니다. 기존 표현을 빼고 담아 주세요.'); return null; }
      s.kit.push(id);
    } else s.kit.splice(i, 1);
    if (!save()) { s.kit = before; return null; } return i < 0;
  }
  function toggleOutdoor() {
    var s = load().settings;
    if (!s.outdoor) { s.outdoorPrevious = { theme: s.theme, size: s.size }; s.theme = 'light'; s.size = Math.max(22, s.size); s.outdoor = true; }
    else {
      s.outdoor = false;
      if (s.outdoorPrevious) { s.theme = s.outdoorPrevious.theme; s.size = s.outdoorPrevious.size; }
      s.outdoorPrevious = null;
    }
    save(); applyTheme(); return s.outdoor;
  }

  /* ---------- settings ---------- */
  function set(k, v) {
    var s = load().settings;
    if (s.outdoor && ['theme', 'size'].includes(k) && s.outdoorPrevious) s.outdoorPrevious[k] = v;
    else s[k] = v;
    save(); applyTheme();
  }
  function get(k) { return load().settings[k]; }

  function applyTheme() {
    var s = load().settings;
    var t = s.theme || 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    document.body && document.body.classList.toggle('outdoor', !!s.outdoor);
    if (document.body) document.body.style.setProperty('--fsize', (s.size || 18) + 'px');
    if (global.getComputedStyle) { var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = getComputedStyle(document.body).getPropertyValue('--bg').trim(); }
    global.dispatchEvent && global.dispatchEvent(new Event('kwe-settings-change'));
  }
  function cycleTheme() {
    var order = ['auto', 'dark', 'light'], cur = get('theme') || 'auto';
    set('theme', order[(order.indexOf(cur) + 1) % order.length]);
    return get('theme');
  }

  /* ---------- TTS ---------- */
  var voices = [], voiceReady = false;
  function loadVoices() {
    if (!('speechSynthesis' in global)) return [];
    voices = speechSynthesis.getVoices() || [];
    voiceReady = voices.length > 0;
    return voices;
  }
  if ('speechSynthesis' in global) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }
  function enVoices() {
    return loadVoices().filter(function (v) { return /^en(-|_)/i.test(v.lang); });
  }
  function pickVoice() {
    var want = get('voice'), list = enVoices();
    if (!list.length) return null;
    var found = want && list.filter(function (v) { return v.voiceURI === want; })[0];
    if (found) return found;
    var pref = ['Samantha', 'Karen', 'Daniel', 'Google US English', 'Microsoft Aria'];
    for (var i = 0; i < pref.length; i++) {
      var m = list.filter(function (v) { return v.name.indexOf(pref[i]) >= 0; })[0];
      if (m) return m;
    }
    return list[0];
  }
  var ttsSupported = ('speechSynthesis' in global) && ('SpeechSynthesisUtterance' in global);
  var speechToken = 0, speechEnd = null, speechTimer = null;
  function speak(text, opts) {
    opts = opts || {};
    if (!ttsSupported || !text) { opts.onerror && opts.onerror('unsupported'); toast('이 기기에서는 음성 재생을 사용할 수 없습니다. 문장을 읽어 주세요.'); return null; }
    stopSpeak(); var token = ++speechToken;
    var u = new SpeechSynthesisUtterance(String(text).replace(/…/g, '...'));
    var v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-US'; }
    u.rate = opts.rate || get('rate') || 0.9;
    u.pitch = 1;
    var audio = document.getElementById('audio-status'), finished = false;
    if (audio) { audio.hidden = false; audio.querySelector('span').textContent = '음성 준비 중'; }
    function finish(kind, event) {
      if (token !== speechToken || finished) return;
      finished = true; clearTimeout(speechTimer); speechEnd = null;
      if (audio) audio.hidden = true;
      if (kind === 'error') { opts.onerror && opts.onerror(event); toast('음성을 재생하지 못했습니다. 기기 음성 설정과 연결을 확인해 주세요.'); }
      else if (kind === 'stop') { opts.onstop && opts.onstop(); }
      else opts.onend && opts.onend();
    }
    speechEnd = function () { finish('stop'); };
    u.onend = function () { finish('end'); };
    u.onerror = function (e) { finish('error', e.error); };
    u.onstart = function () {
      if (token !== speechToken) return;
      clearTimeout(speechTimer);
      if (audio) audio.querySelector('span').textContent = '발음 재생 중';
      opts.onstart && opts.onstart();
    };
    speechTimer = setTimeout(function () { finish('error', 'start-timeout'); stopSpeak(); }, 10000);
    try { speechSynthesis.speak(u); } catch (e) { finish('error', 'failed'); }
    return u;
  }
  function stopSpeak() {
    if (speechEnd) speechEnd();
    speechToken++; clearTimeout(speechTimer);
    try { if (ttsSupported) speechSynthesis.cancel(); } catch (e) { }
  }
  function playButton(button, text) {
    if (button.dataset.playing === 'true') { stopSpeak(); return; }
    var label = button.getAttribute('aria-label') || '발음 듣기: ' + text;
    function reset() { button.dataset.playing = 'false'; button.innerHTML = icon('sound'); button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', 'false'); }
    speak(text, {
      onstart: function () { button.dataset.playing = 'true'; button.innerHTML = icon('stop'); button.setAttribute('aria-label', '발음 중지: ' + text); button.setAttribute('aria-pressed', 'true'); },
      onend: reset, onstop: reset, onerror: reset
    });
  }

  /* ---------- speech recognition (섀도잉 채점) ---------- */
  var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
  var srSupported = !!SR;
  function listen(cb, onerr) {
    if (!SR) { onerr && onerr('unsupported'); return null; }
    var r = new SR();
    r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 3;
    r.onresult = function (e) {
      var alts = [];
      for (var i = 0; i < e.results[0].length; i++) alts.push(e.results[0][i].transcript);
      cb(alts);
    };
    r.onerror = function (e) { onerr && onerr(e.error); };
    try { r.start(); } catch (e) { onerr && onerr('start-failed'); }
    return r;
  }
  function words(s) {
    return String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
  }
  function scoreSpeech(target, heard) {
    var t = words(target), h = words(heard), pool = h.slice(), hits = 0, marks = [];
    t.forEach(function (w) {
      var i = pool.indexOf(w);
      if (i < 0) { // 관대한 매칭: 어간
        i = pool.findIndex(function (x) { return x.slice(0, 4) === w.slice(0, 4) && w.length > 3; });
      }
      if (i >= 0) { pool.splice(i, 1); hits++; marks.push({ w: w, hit: true }); }
      else marks.push({ w: w, hit: false });
    });
    return { score: t.length ? Math.round(hits / t.length * 100) : 0, marks: marks };
  }

  /* ---------- backup ---------- */
  function exportJson(original) {
    var text;
    try { text = original === 'recovery' ? localStorage.getItem(KEY + ':recovery') : original ? localStorage.getItem(KEY) || localStorage.getItem(LEGACY) || '{}' : JSON.stringify(load(), null, 2); }
    catch (e) { toast('저장된 원본을 읽지 못했습니다. 현재 데이터를 일반 백업으로 내려받아 주세요.'); return; }
    if (text == null) { toast('복구할 이전 데이터가 없습니다.'); return; }
    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kwe-' + (original === 'recovery' ? 'recovery-' : 'progress-') + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function importJson(file, done) {
    if (file.size > 1048576) { done(new Error('백업은 1MB 이하만 가져올 수 있습니다.')); return; }
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = KWEModel.normalize(JSON.parse(fr.result));
        done(null, d);
      } catch (e) { done(e); }
    };
    fr.onerror = function () { done(new Error('읽기 실패')); };
    fr.readAsText(file);
  }

  /* ---------- ui helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }
  function pad4(n) { return String(n).padStart(4, '0'); }

  var dataCache = {};
  function fetchJson(path) {
    if (dataCache[path]) return dataCache[path];
    dataCache[path] = fetch(path).then(function (r) {
      if (!r.ok) throw new Error(path + ' 로드 실패');
      return r.json();
    }).catch(function (e) { delete dataCache[path]; throw e; });
    return dataCache[path];
  }
  function base() {
    // lessons/ 하위 페이지면 한 단계 위
    return /\/lessons\//.test(location.pathname) ? '../' : '';
  }
  function lessonsJson() { return fetchJson(base() + 'data/lessons.json'); }
  function phrasesJson() {
    return fetchJson(base() + 'data/phrases.json').then(function (data) {
      var s = load(), ids = new Set(data.phrases.map(function (p) { return p.id; }));
      var saved = Object.values(s.sentences).filter(function (p) { return !ids.has(p.id) && (s.pins.includes(p.id) || s.kit.includes(p.id) || s.cards[p.id]); });
      return Object.assign({}, data, { phrases: data.phrases.concat(saved) });
    });
  }

  function mountTabs(activeName) {
    if (document.querySelector('.tabbar')) return;
    var b = base();
    var tabs = [
      { id: 'home', href: b + 'index.html', ic: 'home', label: '홈' },
      { id: 'field', href: b + 'field.html', ic: 'camera', label: '현장' },
      { id: 'practice', href: b + 'practice.html', ic: 'cards', label: '연습' }
    ];
    var nav = document.createElement('nav');
    nav.className = 'tabbar';
    nav.setAttribute('aria-label', '주요 메뉴');
    nav.innerHTML = tabs.map(function (t) {
      return '<a href="' + t.href + '"' + (t.id === activeName ? ' class="active" aria-current="page"' : '') +
        '><span class="ic" aria-hidden="true">' + icon(t.ic) + '</span>' + t.label + '</a>';
    }).join('');
    document.body.appendChild(nav);
  }

  function mountThemeBtn() {
    var host = document.querySelector('.hdr-actions');
    if (!host) return;
    var btn = document.createElement('button');
    btn.className = 'iconbtn';
    btn.type = 'button';
    var icons = { auto: 'theme', dark: 'moon', light: 'sun' };
    var labels = { auto: '시스템 설정', dark: '다크 모드', light: '라이트 모드' };
    function sync() { var t = get('theme') || 'auto'; btn.innerHTML = icon(icons[t]); btn.title = '테마: ' + labels[t]; btn.setAttribute('aria-label', '테마 변경 — 현재 ' + labels[t]); }
    btn.addEventListener('click', function () { cycleTheme(); sync(); toast('테마: ' + labels[get('theme')]); });
    sync(); global.addEventListener('kwe-settings-change', sync);
    host.appendChild(btn);
  }

  function icon(name) {
    var paths = {
      home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
      camera: '<path d="M8 6 10 3h4l2 3h3a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z"/><circle cx="12" cy="13" r="4"/>',
      cards: '<rect x="6" y="5" width="15" height="16" rx="3"/><path d="M3 16V6a3 3 0 0 1 3-3h9M11 11h5M11 15h3"/>',
      sound: '<path d="M11 4 6 8H3v8h3l5 4Z M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
      stop: '<rect x="6" y="6" width="12" height="12" rx="3"/>',
      star: '<path d="m12 3 2.8 5.6 6.2.9-4.5 4.4 1 6.1-5.5-2.9-5.5 2.9 1-6.1L3 9.5l6.2-.9Z"/>',
      kit: '<rect x="3" y="7" width="18" height="14" rx="4"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-8 7 3 3 5-5"/>',
      show: '<rect x="2" y="4" width="20" height="14" rx="3"/><path d="M8 22h8m-4-4v4"/>',
      settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
      search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
      close: '<path d="m6 6 12 12M6 18 18 6"/>',
      arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
      moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
      theme: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
      up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>'
    };
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.cards) + '</svg>';
  }
  function offlineText(text) { document.querySelectorAll('[data-offline]').forEach(function (el) { el.textContent = text; }); }
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') { offlineText('오프라인 저장을 지원하지 않는 환경'); return; }
    var controlled = !!navigator.serviceWorker.controller, applying = false;
    function check(reg) {
      if (!reg.active) { offlineText('오프라인 파일 준비 중'); return; }
      var channel = new MessageChannel();
      var timeout = setTimeout(function () { offlineText('오프라인 준비 상태 확인 필요'); }, 4000);
      channel.port1.onmessage = function (e) {
        clearTimeout(timeout); channel.port1.close();
        offlineText(e.data.ready ? (navigator.onLine ? '오프라인 사용 준비 완료' : '오프라인 · 저장된 전체 콘텐츠 사용 중') : '오프라인 준비 중 · 연결을 유지해 주세요');
      };
      reg.active.postMessage({ type: 'STATUS' }, [channel.port2]);
    }
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (controlled || applying) { stopSpeak(); location.reload(); }
      else { controlled = true; navigator.serviceWorker.getRegistration().then(function (r) { if (r) check(r); }); }
    });
    navigator.serviceWorker.register(base() + 'sw.js', { updateViaCache: 'none' }).then(function (reg) {
      function offer() {
        if (!reg.waiting || !reg.active || document.getElementById('update-banner')) return;
        var banner = document.createElement('div'); banner.className = 'update-banner'; banner.id = 'update-banner';
        banner.innerHTML = '<span>새 버전 준비 완료</span><button class="btn sm" type="button">업데이트 적용</button>';
        banner.querySelector('button').onclick = function () { applying = true; reg.waiting.postMessage({ type: 'ACTIVATE' }); };
        document.body.appendChild(banner);
      }
      offer(); check(reg);
      reg.addEventListener('updatefound', function () {
        var worker = reg.installing;
        worker.addEventListener('statechange', function () { if (worker.state === 'installed') { offer(); check(reg); } });
      });
      ['online', 'offline'].forEach(function (event) { global.addEventListener(event, function () { check(reg); }); });
    }).catch(function () { navigator.serviceWorker.getRegistration().then(function (existing) { if (existing && existing.active) check(existing); else offlineText('오프라인 준비 실패 · 연결 상태에서 다시 열어 주세요'); }); });
  }
  function mountSettings() {
    var dialog = document.createElement('dialog'); dialog.id = 'settings-dlg'; dialog.setAttribute('aria-labelledby', 'settings-title');
    dialog.innerHTML = '<div class="dialog-head"><h2 id="settings-title">설정</h2><button class="iconbtn" type="button" data-close aria-label="설정 닫기">' + icon('close') + '</button></div>' +
      '<section class="settings-section"><h3>발음과 화면</h3><label for="voice-sel">영어 음성</label><select id="voice-sel"></select><p class="small muted">음성 품질은 기기마다 다릅니다. 네트워크 음성은 오프라인에서 재생되지 않을 수 있습니다.</p><label for="rate-range">속도 <output id="rate-val"></output>×</label><input id="rate-range" type="range" min="0.6" max="1.2" step="0.05"><button class="btn" type="button" id="voice-test">음성 확인</button><label for="font-select">현장 글자 크기</label><select id="font-select"><option value="18">기본 · 18px</option><option value="22">크게 · 22px</option><option value="26">더 크게 · 26px</option></select><label for="theme-select">테마</label><select id="theme-select"><option value="auto">시스템 설정</option><option value="light">라이트</option><option value="dark">다크</option></select></section>' +
      '<section class="settings-section"><h3>오프라인과 설치</h3><p data-offline role="status">준비 상태 확인 중</p><p class="small muted">Safari 공유 메뉴에서 ‘홈 화면에 추가’를 선택하세요. 처음 준비가 끝난 뒤 연결 없이 사용할 수 있습니다. 브라우저 저장소 삭제 시 다시 준비해야 합니다.</p></section>' +
      '<section class="settings-section"><h3>내 데이터</h3><p class="small muted">진도·저장한 표현·촬영 준비는 이 브라우저에 보관됩니다. 기기 이동 전 백업해 주세요. 촬영 준비 최대 24개.</p><div class="row"><button class="btn" id="export-btn" type="button">백업 내보내기</button><button class="btn" id="import-btn" type="button">백업 가져오기</button></div><button class="btn ghost" id="raw-btn" type="button">저장된 원본 내려받기</button><button class="btn ghost" id="recovery-btn" type="button" hidden>변경 전 데이터 내려받기</button><input type="file" id="import-file" accept="application/json" hidden><div id="import-preview" role="status"></div><button class="btn danger" id="reset-btn" type="button">데이터 초기화</button></section><p class="tiny muted">Wedding English · v3</p>';
    document.body.appendChild(dialog);
    function fill() {
      try { dialog.querySelector('#recovery-btn').hidden = !localStorage.getItem(KEY + ':recovery'); } catch (e) { dialog.querySelector('#recovery-btn').hidden = true; }
      var voices = enVoices(), sel = dialog.querySelector('#voice-sel');
      sel.innerHTML = '<option value="">기기 기본 영어 음성</option>' + voices.map(function (v) { return '<option value="' + esc(v.voiceURI) + '">' + esc(v.name + ' · ' + v.lang + (v.localService ? ' · 기기 음성' : ' · 연결 필요')) + '</option>'; }).join('');
      sel.value = get('voice');
      dialog.querySelector('#rate-range').value = get('rate'); dialog.querySelector('#rate-val').textContent = get('rate');
      var fontSelect = dialog.querySelector('#font-select');
      if (!Array.from(fontSelect.options).some(function (option) { return +option.value === get('size'); })) fontSelect.insertAdjacentHTML('beforeend', '<option value="' + get('size') + '">사용자 설정 · ' + get('size') + 'px</option>');
      fontSelect.value = get('size'); dialog.querySelector('#theme-select').value = get('theme');
    }
    document.querySelectorAll('[data-settings]').forEach(function (button) { button.onclick = function () { fill(); dialog.showModal(); navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(function (r) { if (r && r.active) { var ch = new MessageChannel(); ch.port1.onmessage = function (e) { offlineText(e.data.ready ? '오프라인 사용 준비 완료' : '오프라인 준비 중'); ch.port1.close(); }; r.active.postMessage({ type: 'STATUS' }, [ch.port2]); } }); }; });
    dialog.querySelector('[data-close]').onclick = function () { dialog.close(); };
    dialog.querySelector('#voice-sel').onchange = function (e) { set('voice', e.target.value); };
    dialog.querySelector('#rate-range').oninput = function (e) { set('rate', +e.target.value); dialog.querySelector('#rate-val').textContent = e.target.value; };
    dialog.querySelector('#font-select').onchange = function (e) { set('size', +e.target.value); };
    dialog.querySelector('#theme-select').onchange = function (e) { set('theme', e.target.value); };
    dialog.querySelector('#voice-test').onclick = function () { speak('Come a little closer to each other.'); };
    dialog.querySelector('#export-btn').onclick = function () { exportJson(false); };
    dialog.querySelector('#raw-btn').onclick = function () { exportJson(true); };
    dialog.querySelector('#recovery-btn').onclick = function () { exportJson('recovery'); };
    dialog.querySelector('#import-btn').onclick = function () { dialog.querySelector('#import-file').click(); };
    dialog.querySelector('#import-file').onchange = function (e) {
      var file = e.target.files[0]; if (!file) return;
      var preview = dialog.querySelector('#import-preview'); preview.textContent = '백업 확인 중…';
      importJson(file, function (error, data) {
        e.target.value = '';
        if (error) { preview.textContent = error.message; return; }
        preview.innerHTML = '<p>가져올 백업: 레슨 ' + Object.keys(data.lessons).length + '개 · 저장 ' + data.pins.length + '개 · 촬영 준비 ' + data.kit.length + '개</p><p class="small">현재 데이터를 이 백업으로 교체합니다. 변경 전 원본은 복구용으로 보관됩니다.</p><button class="btn primary" type="button">확인하고 복원</button><button class="btn ghost" type="button">취소</button>';
        preview.querySelectorAll('button')[1].onclick = function () { preview.textContent = ''; };
        preview.querySelectorAll('button')[0].onclick = function () {
          try {
            localStorage.setItem(KEY + ':recovery', localStorage.getItem(KEY) || '{}');
            localStorage.setItem(KEY, JSON.stringify(data)); state = data; storageBlocked = false; location.reload();
          } catch (err) { preview.textContent = '저장 공간이 부족해 복원하지 못했습니다. 기존 데이터는 유지됩니다.'; }
        };
      });
    };
    dialog.querySelector('#reset-btn').onclick = function () {
      if (!confirm('진도·복습·저장한 표현·촬영 준비를 초기화합니다. 계속할까요?')) return;
      try { localStorage.setItem(KEY + ':recovery', localStorage.getItem(KEY) || '{}'); localStorage.removeItem(KEY); localStorage.removeItem(LEGACY); location.reload(); }
      catch (e) { toast('초기화하지 못했습니다. 원본 백업을 먼저 내려받아 주세요.'); }
    };
  }

  function init(page) {
    load(); applyTheme();
    mountTabs(page);
    mountThemeBtn();
    mountSettings();
    document.querySelectorAll('[data-icon]').forEach(function (el) { el.innerHTML = icon(el.dataset.icon); });
    var audio = document.createElement('div'); audio.id = 'audio-status'; audio.className = 'audio-status'; audio.hidden = true;
    audio.innerHTML = '<span role="status">음성 준비 중</span><button type="button" class="btn sm">중지</button>'; audio.querySelector('button').onclick = stopSpeak; document.body.appendChild(audio);
    global.addEventListener('pagehide', stopSpeak);
    if (global.visualViewport) { var keyboard = function () { document.body.classList.toggle('keyboard-open', global.innerHeight - global.visualViewport.height > 140); }; global.visualViewport.addEventListener('resize', keyboard); }
    registerSW();
    if (global.matchMedia) global.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  }

  global.KWE = {
    ymd: ymd, today: today, addDays: addDays, diffDays: diffDays,
    load: load, save: save, day: day, streak: streak, stats: stats,
    completeLesson: completeLesson, resetLesson: resetLesson,
    dueLessons: dueLessons, nextLesson: nextLesson, schedule: schedule,
    isPinned: isPinned, togglePin: togglePin, toggleSentence: toggleSentence, toggleKit: toggleKit, toggleOutdoor: toggleOutdoor,
    get: get, set: set, applyTheme: applyTheme, cycleTheme: cycleTheme,
    speak: speak, stopSpeak: stopSpeak, playButton: playButton, ttsSupported: ttsSupported, enVoices: enVoices,
    listen: listen, srSupported: srSupported, scoreSpeech: scoreSpeech,
    exportJson: exportJson, importJson: importJson,
    esc: esc, toast: toast, pad4: pad4, icon: icon,
    lessonsJson: lessonsJson, phrasesJson: phrasesJson, base: base,
    init: init
  };
})(window);
