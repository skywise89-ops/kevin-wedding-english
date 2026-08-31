/* 현장 모드 — 표현 치트시트 */
(function () {
  'use strict';
  var E = KWE.esc;
  var DATA = { categories: [], phrases: [] };
  var cat = 'all', q = '';
  var byId = {};

  KWE.init('field');
  syncSize(); syncKo(); syncOutdoor();

  KWE.phrasesJson().then(function (d) {
    DATA = d;
    d.phrases.forEach(function (p) { byId[p.id] = p; });
    renderCats();
    render();
  }).catch(function (e) {
    document.getElementById('results').innerHTML = '<div class="empty">표현을 불러오지 못했습니다 — ' + E(e.message) + '</div>';
  });

  function renderCats() {
    var counts = {};
    DATA.phrases.forEach(function (p) { counts[p.cat] = (counts[p.cat] || 0) + 1; });
    var html = '<button class="chip active" type="button" data-cat="all">전체 ' + DATA.phrases.length + '</button>';
    html += DATA.categories.map(function (c) {
      return '<button class="chip" type="button" data-cat="' + c.id + '">' + c.emoji + ' ' + E(c.label) +
        ' <span style="opacity:.6">' + (counts[c.id] || 0) + '</span></button>';
    }).join('');
    var host = document.getElementById('cats');
    host.innerHTML = html;
    host.addEventListener('click', function (ev) {
      var b = ev.target.closest('.chip'); if (!b) return;
      host.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active'); cat = b.dataset.cat; render();
      b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      var resHost = document.getElementById('results');
      var top = resHost.getBoundingClientRect().top + window.scrollY - 170;
      if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  }

  function match(p) {
    if (cat !== 'all' && p.cat !== cat) return false;
    if (!q) return true;
    return (p.en + ' ' + p.ko + ' ' + p.situation + ' ' + (p.nuance || '')).toLowerCase().indexOf(q) >= 0;
  }

  function card(p) {
    var pinned = KWE.isPinned(p.id);
    var showKo = KWE.get('showKo') !== false;
    return '<article class="phrase" data-id="' + E(p.id) + '" tabindex="0" role="button" aria-label="발음 재생: ' + E(p.en) + '">' +
      '<div class="body">' +
      '<div class="sit">' + E(p.situation) + '</div>' +
      '<div class="en">' + E(p.en) + '</div>' +
      (showKo ? '<div class="ko">' + E(p.ko) + '</div>' : '') +
      (p.nuance ? '<div class="nu">' + E(p.nuance) + '</div>' : '') +
      '</div>' +
      '<div class="acts">' +
      '<button class="pbtn pin' + (pinned ? ' on' : '') + '" type="button" data-pin="' + E(p.id) + '" aria-label="' + (pinned ? '즐겨찾기 해제' : '즐겨찾기') + '">' + (pinned ? '★' : '☆') + '</button>' +
      (KWE.ttsSupported ? '<button class="pbtn say" type="button" data-say="' + E(p.id) + '" aria-label="발음 재생">🔊</button>' : '') +
      '</div></article>';
  }

  function render() {
    var host = document.getElementById('results');
    var rows = DATA.phrases.filter(match);

    // 즐겨찾기
    var pins = KWE.load().pins.map(function (id) { return byId[id]; }).filter(Boolean);
    var pw = document.getElementById('pinned-wrap');
    pw.hidden = pins.length === 0;
    document.getElementById('pin-count').textContent = pins.length ? pins.length + '개' : '';
    document.getElementById('pinned').innerHTML = pins.map(card).join('');

    if (!rows.length) {
      host.innerHTML = '<div class="empty">일치하는 표현이 없습니다.<br><span class="tiny">다른 단어로 검색하거나 카테고리를 바꿔보세요.</span></div>';
      return;
    }
    if (q || cat !== 'all') {
      host.innerHTML = '<div class="tiny muted" style="margin-bottom:8px">' + rows.length + '개 표현</div>' +
        rows.map(card).join('');
      return;
    }
    // 전체 보기 → 카테고리별 그룹
    host.innerHTML = DATA.categories.map(function (c) {
      var g = rows.filter(function (p) { return p.cat === c.id; });
      if (!g.length) return '';
      return '<section class="catgroup"><h3>' + c.emoji + ' ' + E(c.label) + ' · ' + g.length + '</h3>' +
        g.map(card).join('') + '</section>';
    }).join('');
  }

  /* ---- interactions ---- */
  document.addEventListener('click', function (ev) {
    var pin = ev.target.closest('[data-pin]');
    if (pin) {
      ev.stopPropagation();
      var on = KWE.togglePin(pin.dataset.pin);
      KWE.toast(on ? '즐겨찾기에 추가' : '즐겨찾기에서 제거');
      render();
      return;
    }
    var say = ev.target.closest('[data-say]');
    if (say) { ev.stopPropagation(); play(say.dataset.say, say.closest('.phrase')); return; }
    var ph = ev.target.closest('.phrase');
    if (ph) play(ph.dataset.id, ph);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === '/' && document.activeElement.tagName !== 'INPUT') {
      ev.preventDefault(); document.getElementById('q').focus();
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      var ph = ev.target.closest && ev.target.closest('.phrase');
      if (ph && ev.target === ph) { ev.preventDefault(); play(ph.dataset.id, ph); }
    }
  });

  var speakingEl = null;
  function play(id, el) {
    var p = byId[id]; if (!p) return;
    if (!KWE.ttsSupported) { KWE.toast('이 브라우저는 발음 재생을 지원하지 않습니다'); return; }
    if (speakingEl) speakingEl.classList.remove('speaking');
    speakingEl = el; el && el.classList.add('speaking');
    KWE.speak(p.en, {
      onend: function () { el && el.classList.remove('speaking'); if (speakingEl === el) speakingEl = null; }
    });
  }

  var qEl = document.getElementById('q');
  var t;
  qEl.addEventListener('input', function () {
    clearTimeout(t);
    t = setTimeout(function () { q = qEl.value.trim().toLowerCase(); render(); }, 90);
  });

  /* ---- view toggles ---- */
  var SIZES = [15, 17, 20, 23];
  function syncSize() {
    var s = KWE.get('size') || 16;
    document.body.style.setProperty('--fsize', s + 'px');
    var b = document.getElementById('size-btn');
    if (b) b.title = '글자 크기 ' + s + 'px';
  }
  document.getElementById('size-btn').addEventListener('click', function () {
    var cur = KWE.get('size') || 16;
    var i = SIZES.indexOf(cur); i = (i + 1) % SIZES.length;
    KWE.set('size', SIZES[i]); syncSize(); KWE.toast('글자 크기 ' + SIZES[i] + 'px');
  });

  function syncKo() {
    var on = KWE.get('showKo') !== false;
    document.getElementById('ko-btn').classList.toggle('on', on);
  }
  document.getElementById('ko-btn').addEventListener('click', function () {
    KWE.set('showKo', KWE.get('showKo') === false); syncKo(); render();
    KWE.toast(KWE.get('showKo') !== false ? '한국어 해석 표시' : '영어만 표시');
  });

  function syncOutdoor() {
    var on = !!KWE.get('outdoor');
    document.body.classList.toggle('outdoor', on);
    document.getElementById('outdoor-btn').classList.toggle('on', on);
  }
  document.getElementById('outdoor-btn').addEventListener('click', function () {
    var on = !KWE.get('outdoor');
    KWE.set('outdoor', on);
    if (on) { KWE.set('theme', 'light'); KWE.set('size', 20); }
    else { KWE.set('theme', 'auto'); KWE.set('size', 16); }
    syncOutdoor(); syncSize();
    KWE.toast(on ? '야외 고대비 모드 켬' : '야외 모드 끔');
  });
})();
