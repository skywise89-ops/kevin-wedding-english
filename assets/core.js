/* Kevin's Wedding English — core (state, SRS, TTS, UI helpers)  v2 */
(function (global) {
  'use strict';

  var KEY = 'kwe_state_v2';
  var LEGACY = 'kwe_progress_v1';
  var TODAY_TZ = 'Asia/Seoul';

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
  var DEFAULTS = {
    version: 2,
    lessons: {},                // id -> {done, first, last, reps, ease, interval, due, lapses}
    cards: {},                  // phraseId -> {reps, ease, interval, due}
    pins: [],
    days: {},                   // 'YYYY-MM-DD' -> {lessons:[], quiz:[right,total], cards:n}
    settings: { theme: 'auto', rate: 0.9, voice: '', size: 16, outdoor: false, showKo: true }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var state = null;
  function load() {
    if (state) return state;
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    if (!raw) raw = migrate();
    state = Object.assign(clone(DEFAULTS), raw || {});
    state.settings = Object.assign(clone(DEFAULTS.settings), state.settings || {});
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
    try { localStorage.setItem(KEY, JSON.stringify(load())); }
    catch (e) { console.warn('저장 실패', e); }
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
    c.last = today();
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
    var s = load(), i = s.pins.indexOf(id);
    if (i < 0) s.pins.unshift(id); else s.pins.splice(i, 1);
    save(); return i < 0;
  }

  /* ---------- settings ---------- */
  function set(k, v) { load().settings[k] = v; save(); applyTheme(); }
  function get(k) { return load().settings[k]; }

  function applyTheme() {
    var s = load().settings;
    var t = s.theme || 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    document.body && document.body.classList.toggle('outdoor', !!s.outdoor);
    if (document.body) document.body.style.setProperty('--fsize', (s.size || 16) + 'px');
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
  function speak(text, opts) {
    if (!ttsSupported || !text) return null;
    opts = opts || {};
    try { speechSynthesis.cancel(); } catch (e) { }
    var u = new SpeechSynthesisUtterance(String(text).replace(/…/g, '...'));
    var v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-US'; }
    u.rate = opts.rate || get('rate') || 0.9;
    u.pitch = 1;
    if (opts.onend) u.onend = opts.onend;
    if (opts.onstart) u.onstart = opts.onstart;
    speechSynthesis.speak(u);
    return u;
  }
  function stopSpeak() { try { speechSynthesis.cancel(); } catch (e) { } }

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
    return String(s).toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
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
  function exportJson() {
    var blob = new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kwe-progress-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function importJson(file, done) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result);
        if (!d || typeof d !== 'object' || !d.lessons) throw new Error('형식 오류');
        state = Object.assign(clone(DEFAULTS), d);
        state.settings = Object.assign(clone(DEFAULTS.settings), d.settings || {});
        save(); done(null);
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
      toastEl.className = 'toast';
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
    dataCache[path] = fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' 로드 실패');
      return r.json();
    });
    return dataCache[path];
  }
  function base() {
    // lessons/ 하위 페이지면 한 단계 위
    return /\/lessons\//.test(location.pathname) ? '../' : '';
  }
  function lessonsJson() { return fetchJson(base() + 'data/lessons.json'); }
  function phrasesJson() { return fetchJson(base() + 'data/phrases.json'); }

  function mountTabs(activeName) {
    if (document.querySelector('.tabbar')) return;
    var b = base();
    var tabs = [
      { id: 'home', href: b + 'index.html', ic: '🏠', label: '홈' },
      { id: 'field', href: b + 'field.html', ic: '⚡', label: '현장' },
      { id: 'practice', href: b + 'practice.html', ic: '🎧', label: '연습' }
    ];
    var nav = document.createElement('nav');
    nav.className = 'tabbar';
    nav.setAttribute('aria-label', '주요 메뉴');
    nav.innerHTML = tabs.map(function (t) {
      return '<a href="' + t.href + '"' + (t.id === activeName ? ' class="active" aria-current="page"' : '') +
        '><span class="ic" aria-hidden="true">' + t.ic + '</span>' + t.label + '</a>';
    }).join('');
    document.body.appendChild(nav);
  }

  function mountThemeBtn() {
    var host = document.querySelector('.hdr-actions');
    if (!host) return;
    var btn = document.createElement('button');
    btn.className = 'iconbtn';
    btn.type = 'button';
    var icons = { auto: '🌗', dark: '🌙', light: '☀️' };
    var labels = { auto: '시스템 설정', dark: '다크 모드', light: '라이트 모드' };
    function sync() { var t = get('theme') || 'auto'; btn.textContent = icons[t]; btn.title = '테마: ' + labels[t]; btn.setAttribute('aria-label', '테마 변경 — 현재 ' + labels[t]); }
    btn.addEventListener('click', function () { cycleTheme(); sync(); toast('테마: ' + labels[get('theme')]); });
    sync();
    host.appendChild(btn);
  }

  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register(base() + 'sw.js').catch(function () { });
  }

  function init(page) {
    load(); applyTheme();
    mountTabs(page);
    mountThemeBtn();
    registerSW();
  }

  global.KWE = {
    ymd: ymd, today: today, addDays: addDays, diffDays: diffDays,
    load: load, save: save, day: day, streak: streak, stats: stats,
    completeLesson: completeLesson, resetLesson: resetLesson,
    dueLessons: dueLessons, nextLesson: nextLesson, schedule: schedule,
    isPinned: isPinned, togglePin: togglePin,
    get: get, set: set, applyTheme: applyTheme, cycleTheme: cycleTheme,
    speak: speak, stopSpeak: stopSpeak, ttsSupported: ttsSupported, enVoices: enVoices,
    listen: listen, srSupported: srSupported, scoreSpeech: scoreSpeech,
    exportJson: exportJson, importJson: importJson,
    esc: esc, toast: toast, pad4: pad4,
    lessonsJson: lessonsJson, phrasesJson: phrasesJson, base: base,
    init: init
  };
})(window);
