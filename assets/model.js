/* Pure data rules shared by the browser and node:test. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KWEModel = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var defaults = {
    version: 3, lessons: {}, cards: {}, pins: [], sentences: {}, kit: [], kitName: '이번 촬영',
    days: {}, checks: {}, positions: {}, quizAnswers: {}, lastLesson: '', session: null,
    settings: { theme: 'auto', rate: 0.9, voice: '', size: 18, outdoor: false, showKo: true, outdoorPrevious: null }
  };
  function object(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function fail() { throw new Error('백업 형식 또는 값이 올바르지 않습니다. 원본은 변경하지 않았습니다.'); }
  function date(x) {
    if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
    var d = new Date(x + 'T12:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === x;
  }
  function strings(x, max) {
    if (!Array.isArray(x) || x.length > max || x.some(function (s) { return typeof s !== 'string' || s.length > 150 || !s.length; })) fail();
    return Array.from(new Set(x));
  }
  function safeKeys(x, max) {
    if (!object(x) || Object.keys(x).length > max) fail();
    if (Object.keys(x).some(function (k) { return ['__proto__', 'constructor', 'prototype'].indexOf(k) >= 0; })) fail();
  }
  function records(x) {
    safeKeys(x, 2000);
    Object.keys(x).forEach(function (id) {
      var c = x[id]; safeKeys(c, 20);
      if (c.reps > 0 && (!Number.isFinite(c.ease) || !Number.isInteger(c.interval) || !date(c.due))) fail();
      if (c.done === true && !date(c.first)) fail();
      Object.keys(c).forEach(function (k) {
        var v = c[k];
        if (['first', 'last', 'due'].indexOf(k) >= 0 && !date(v)) fail();
        if (['reps', 'interval', 'lapses'].indexOf(k) >= 0 && (!Number.isInteger(v) || v < 0 || v > 100000)) fail();
        if (k === 'ease' && (!Number.isFinite(v) || v < 1 || v > 5)) fail();
        if (k === 'done' && typeof v !== 'boolean') fail();
        if (k === 'lastGrade' && ![1, 3, 4, 5].includes(v)) fail();
        if (['first', 'last', 'due', 'reps', 'interval', 'lapses', 'ease', 'done', 'lastGrade'].indexOf(k) < 0) fail();
      });
    });
  }
  function normalize(raw) {
    safeKeys(raw, 30);
    if (raw.version != null && ![2, 3].includes(raw.version)) throw new Error('지원하지 않는 백업 버전입니다. 원본을 보관해 주세요.');
    if (!object(raw.lessons)) fail();
    var d = JSON.parse(JSON.stringify(defaults));
    records(raw.lessons); d.lessons = raw.lessons;
    if (raw.cards != null) { records(raw.cards); d.cards = raw.cards; }
    if (raw.pins != null) d.pins = strings(raw.pins, 1000);
    if (raw.sentences != null) {
      safeKeys(raw.sentences, 500);
      Object.keys(raw.sentences).forEach(function (id) {
        var p = raw.sentences[id]; safeKeys(p, 10);
        if (!/^lesson-sentence-[a-f0-9]{24}$/.test(id) || p.id !== id || p.src !== 'saved-lesson') fail();
        if (typeof p.en !== 'string' || !p.en.trim() || p.en.length > 2000 || typeof p.situation !== 'string' || !p.situation.trim() || p.situation.length > 2000) fail();
        if (typeof p.cat !== 'string' || !/^[a-z0-9-]{1,50}$/.test(p.cat)) fail();
        ['ko', 'note'].forEach(function (key) { if (typeof p[key] !== 'string' || p[key].length > 2000) fail(); });
        if (!Array.isArray(p.lessons) || !p.lessons.length || p.lessons.length > 20 || p.lessons.some(function (n) { return !Number.isInteger(n) || n < 1 || n > 20; })) fail();
        if (Object.keys(p).some(function (key) { return !['id', 'en', 'ko', 'cat', 'situation', 'note', 'lessons', 'src'].includes(key); })) fail();
      }); d.sentences = raw.sentences;
    }
    if (raw.kit != null) d.kit = strings(raw.kit, 24);
    if (raw.kitName != null) { if (typeof raw.kitName !== 'string' || raw.kitName.length > 40) fail(); d.kitName = raw.kitName; }
    if (raw.days != null) {
      safeKeys(raw.days, 15000);
      Object.keys(raw.days).forEach(function (key) {
        var day = raw.days[key];
        if (!date(key) || !object(day) || !Array.isArray(day.lessons) || day.lessons.length > 100 || day.lessons.some(function (n) { return !Number.isInteger(n) || n < 1 || n > 1000; })) fail();
        if (!Number.isInteger(day.cards) || day.cards < 0 || day.cards > 100000) fail();
        if (!Array.isArray(day.quiz) || day.quiz.length !== 2 || day.quiz.some(function (n) { return !Number.isInteger(n) || n < 0 || n > 100000; }) || day.quiz[0] > day.quiz[1]) fail();
      }); d.days = raw.days;
    }
    ['checks', 'quizAnswers'].forEach(function (key) {
      if (raw[key] == null) return;
      safeKeys(raw[key], 1000);
      Object.values(raw[key]).forEach(function (arr) {
        if (!Array.isArray(arr) || arr.length > 100 || arr.some(function (v) { return key === 'checks' ? typeof v !== 'boolean' && v !== null : v !== null && (!Number.isInteger(v) || v < 0 || v > 20); })) fail();
      }); d[key] = raw[key];
    });
    if (raw.positions != null) {
      safeKeys(raw.positions, 1000);
      if (Object.values(raw.positions).some(function (n) { return !Number.isFinite(n) || n < 0 || n > 1000000; })) fail();
      d.positions = raw.positions;
    }
    if (raw.lastLesson != null) { if (typeof raw.lastLesson !== 'string' || !/^\d{0,4}$/.test(raw.lastLesson)) fail(); d.lastLesson = raw.lastLesson; }
    if (raw.settings != null) {
      safeKeys(raw.settings, 20); var s = raw.settings;
      if (s.theme != null && !['auto', 'light', 'dark'].includes(s.theme)) fail();
      if (s.rate != null && (!Number.isFinite(s.rate) || s.rate < 0.6 || s.rate > 1.2)) fail();
      if (s.size != null && (!Number.isFinite(s.size) || s.size < 15 || s.size > 32)) fail();
      if (s.voice != null && (typeof s.voice !== 'string' || s.voice.length > 500)) fail();
      ['outdoor', 'showKo'].forEach(function (k) { if (s[k] != null && typeof s[k] !== 'boolean') fail(); });
      if (s.outdoorPrevious != null && (!object(s.outdoorPrevious) || !['auto', 'light', 'dark'].includes(s.outdoorPrevious.theme) || !Number.isFinite(s.outdoorPrevious.size) || s.outdoorPrevious.size < 15 || s.outdoorPrevious.size > 32)) fail();
      Object.keys(d.settings).forEach(function (k) { if (s[k] !== undefined) d.settings[k] = s[k]; });
    }
    if (raw.session != null) {
      var se = raw.session; safeKeys(se, 10);
      if (!['quick', 'flash', 'saved', 'hard', 'kit'].includes(se.mode) || !date(se.date)) fail();
      strings(se.ids, 20);
      if (!Number.isInteger(se.index) || se.index < 0 || se.index > se.ids.length || typeof se.revealed !== 'boolean' || !Number.isInteger(se.right) || se.right < 0 || se.right > se.ids.length) fail();
      d.session = se;
    }
    return d;
  }
  function compact(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9가-힣]/g, ''); }
  function search(phrases, query, category) {
    var q = compact(query), tokens = String(query || '').trim().toLowerCase().split(/\s+/).map(compact).filter(Boolean);
    return phrases.map(function (p, i) {
      if (category && category !== 'all' && p.cat !== category) return null;
      var fields = [p.en, p.ko, p.situation].concat(p.keywords || []);
      var exact = fields.some(function (s) { return compact(s) === q; });
      var hay = compact(fields.concat([p.nuance, p.note]).join(' '));
      if (q && !exact && !hay.includes(q) && !tokens.every(function (t) { return hay.includes(t); })) return null;
      var score = (exact ? 1000 : q && compact(p.situation).includes(q) ? 500 : q && compact(p.ko).includes(q) ? 400 : q && hay.includes(q) ? 300 : 100) + (p.priority || 0);
      return { phrase: p, score: score, order: i };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score || a.order - b.order; }).map(function (x) { return x.phrase; });
  }
  function deck(phrases, state, mode, today) {
    var due = function (p) { return !state.cards[p.id] || !state.cards[p.id].due || state.cards[p.id].due <= today; };
    var rows = phrases.filter(function (p) {
      if (mode === 'saved') return state.pins.includes(p.id);
      if (mode === 'kit') return state.kit.includes(p.id);
      if (mode === 'hard') { var c = state.cards[p.id] || {}; return c.lapses > 0 || c.lastGrade === 1 || c.lastGrade === 3; }
      return due(p);
    });
    rows.sort(function (a, b) {
      if (mode === 'kit') return (due(a) ? 0 : 1) - (due(b) ? 0 : 1) || state.kit.indexOf(a.id) - state.kit.indexOf(b.id);
      var ca = state.cards[a.id], cb = state.cards[b.id];
      return (due(a) ? 0 : 1) - (due(b) ? 0 : 1) || (ca ? 0 : 1) - (cb ? 0 : 1) || String(ca && ca.due || '').localeCompare(String(cb && cb.due || '')) || (b.priority || 0) - (a.priority || 0);
    });
    return rows.slice(0, mode === 'quick' ? 5 : 10).map(function (p) { return p.id; });
  }
  return { defaults: defaults, normalize: normalize, search: search, deck: deck, date: date };
});
