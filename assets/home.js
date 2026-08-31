/* 홈 대시보드 */
(function () {
  'use strict';
  var E = KWE.esc, P = KWE.pad4;
  var lessons = [];

  KWE.init('home');

  KWE.lessonsJson().then(function (data) {
    lessons = data;
    renderHero();
    renderStats();
    renderReview();
    renderHeat();
    renderLibrary();
  }).catch(function (e) {
    document.getElementById('today-lesson').innerHTML =
      '<div class="tag">오류</div><h1>레슨 데이터를 불러오지 못했습니다</h1>' +
      '<div class="small muted">' + E(e.message) + ' — 페이지를 새로고침해 주세요.</div>';
  });

  KWE.phrasesJson().then(function (d) {
    var el = document.getElementById('phrase-total');
    if (el) el.textContent = d.phrases.length;
  }).catch(function () { });

  function renderHero() {
    var l = KWE.nextLesson(lessons);
    var st = KWE.load().lessons[String(l.id)];
    var isReview = st && st.done;
    var top = l.expressions.slice(0, 2).map(function (e) { return e.en; });
    document.getElementById('today-lesson').innerHTML =
      '<div class="tag">' + (isReview ? '복습 · ' : 'TODAY · ') + 'WEEK ' + l.week + ' DAY ' + l.day + '</div>' +
      '<h1>' + E(l.emoji) + ' ' + E(l.topicKo) + '</h1>' +
      '<div class="small muted">' + E(l.goal || l.topicEn) + '</div>' +
      '<div class="small" style="margin-top:9px;color:var(--muted)">' +
      top.map(function (t) { return '“' + E(t) + '”'; }).join('<br>') + '</div>' +
      '<a class="cta" href="lessons/' + E(l.filename) + '">' +
      (isReview ? '복습 시작' : '12분 학습 시작') + ' →</a>';
  }

  function renderStats() {
    var s = KWE.stats(lessons);
    document.getElementById('statgrid').innerHTML = [
      ['🔥', s.streak, '연속일'],
      ['✅', s.done + '/' + s.total, '완료'],
      ['🔁', s.due, '복습 대기'],
      ['📌', s.pins, '즐겨찾기']
    ].map(function (a) {
      return '<div class="stat"><b>' + a[0] + ' ' + a[1] + '</b><span>' + a[2] + '</span></div>';
    }).join('');

    document.getElementById('progress-counter').textContent = s.done + ' / ' + s.total;
    document.getElementById('progress-bar-fill').style.width = s.pct + '%';
    document.getElementById('week-summary').textContent = s.pct + '% · 최장 ' + s.longest + '일 연속';

    var titles = { 1: '라포', 2: '디렉팅', 3: '칭찬·대처', 4: '마무리' };
    document.getElementById('weekbars').innerHTML = [1, 2, 3, 4].map(function (w) {
      var tot = lessons.filter(function (l) { return l.week === w; }).length;
      return '<div class="weekbar"><div class="n">' + (s.byWeek[w] || 0) + '/' + tot + '</div>' +
        '<div class="lbl">' + titles[w] + '</div></div>';
    }).join('');
  }

  function renderReview() {
    var due = KWE.dueLessons(lessons);
    document.getElementById('due-count').textContent = due.length ? due.length + '개' : '';
    var host = document.getElementById('review-card');
    if (!due.length) {
      var anyDone = Object.keys(KWE.load().lessons).length > 0;
      host.innerHTML = '<div class="empty">' + (anyDone
        ? '오늘 복습할 레슨이 없습니다. 새 레슨을 진행하세요 👌'
        : '레슨을 하나 완료하면 여기에 복습 일정이 쌓입니다.<br>1 → 3 → 7 → 14 → 30일 간격으로 다시 꺼내드려요.') + '</div>';
      return;
    }
    host.innerHTML = '<div class="duelist">' + due.slice(0, 8).map(function (d) {
      var over = d.overdue;
      var label = over === 0 ? '오늘' : 'D+' + over;
      return '<a class="due" href="lessons/' + E(d.lesson.filename) + '">' +
        '<span class="n' + (over > 0 ? ' over' : '') + '">' + label + '</span>' +
        '<span class="t">' + E(d.lesson.emoji) + ' ' + E(d.lesson.topicKo) + '</span>' +
        '<span class="tiny muted">Day ' + d.lesson.day + '</span></a>';
    }).join('') + '</div>' +
      (due.length > 8 ? '<div class="tiny muted" style="margin-top:8px">외 ' + (due.length - 8) + '개</div>' : '');
  }

  function renderHeat() {
    var days = KWE.load().days, t = KWE.today(), cells = [];
    for (var i = 55; i >= 0; i--) {
      var d = KWE.addDays(t, -i);
      var rec = days[d];
      var on = rec && (rec.lessons.length || rec.cards || (rec.quiz && rec.quiz[1]));
      cells.push('<i class="' + (on ? 'on' : '') + (i === 0 ? ' today' : '') + '" title="' + d + (on ? ' · 학습함' : '') + '"></i>');
    }
    document.getElementById('heat').innerHTML = cells.join('');
    var st = KWE.streak();
    document.getElementById('heat-note').textContent =
      '총 ' + st.days + '일 학습 · 현재 ' + st.current + '일 연속 · 최장 ' + st.longest + '일';
  }

  function renderLibrary() {
    var listEl = document.getElementById('lesson-list');
    var searchEl = document.getElementById('lesson-search');
    var chips = document.querySelectorAll('#week-filters .chip');
    var filter = 'all';

    function draw() {
      var q = (searchEl.value || '').trim().toLowerCase();
      var st = KWE.load().lessons;
      var rows = lessons.filter(function (l) {
        var done = !!(st[String(l.id)] || {}).done;
        var fMatch = filter === 'all' || (filter === 'todo' ? !done : String(l.week) === filter);
        if (!fMatch) return false;
        if (!q) return true;
        var hay = [l.topicKo, l.topicEn, l.weekTitle, l.goal].concat(
          l.expressions.map(function (e) { return e.situation + ' ' + e.en + ' ' + (e.ko || ''); })
        ).join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      if (!rows.length) { listEl.innerHTML = '<li class="empty">일치하는 레슨이 없습니다.</li>'; return; }
      listEl.innerHTML = rows.map(function (l) {
        var rec = st[String(l.id)] || {};
        var sub = 'Week ' + l.week + ' Day ' + l.day + ' · ' + l.weekTitle;
        if (rec.done && rec.due) sub += ' · 다음 복습 ' + rec.due;
        return '<li class="lesson-item' + (rec.done ? ' done' : '') + '">' +
          '<div class="emoji" aria-hidden="true">' + E(l.emoji) + '</div>' +
          '<div class="meta"><div class="title">' + (rec.done ? '✅ ' : '') + 'Lesson ' + P(l.id) + ' · ' + E(l.topicKo) + '</div>' +
          '<div class="sub">' + E(sub) + '</div></div>' +
          '<a class="go" href="lessons/' + E(l.filename) + '">' + (rec.done ? '다시' : '시작') + ' →</a></li>';
      }).join('');
    }
    chips.forEach(function (b) {
      b.addEventListener('click', function () {
        chips.forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); filter = b.dataset.week; draw();
      });
    });
    searchEl.addEventListener('input', draw);
    draw();
  }

  /* ---- settings dialog ---- */
  var dlg = document.getElementById('settings-dlg');
  document.getElementById('settings-btn').addEventListener('click', function () {
    fillVoices(); dlg.showModal();
  });
  document.getElementById('close-dlg').addEventListener('click', function () { dlg.close(); });

  function fillVoices() {
    var sel = document.getElementById('voice-sel');
    var vs = KWE.enVoices();
    if (!KWE.ttsSupported || !vs.length) {
      sel.innerHTML = '<option>이 브라우저는 음성 재생을 지원하지 않습니다</option>';
      sel.disabled = true;
    } else {
      var cur = KWE.get('voice');
      sel.disabled = false;
      sel.innerHTML = vs.map(function (v) {
        return '<option value="' + E(v.voiceURI) + '"' + (v.voiceURI === cur ? ' selected' : '') + '>' +
          E(v.name) + ' (' + E(v.lang) + ')</option>';
      }).join('');
    }
    var r = document.getElementById('rate-range');
    r.value = KWE.get('rate') || 0.9;
    document.getElementById('rate-val').textContent = r.value;
  }
  document.getElementById('voice-sel').addEventListener('change', function (e) { KWE.set('voice', e.target.value); });
  document.getElementById('rate-range').addEventListener('input', function (e) {
    document.getElementById('rate-val').textContent = e.target.value;
    KWE.set('rate', parseFloat(e.target.value));
  });
  document.getElementById('voice-test').addEventListener('click', function () {
    KWE.speak('You made it! You both look amazing already.');
  });
  document.getElementById('export-btn').addEventListener('click', function () {
    KWE.exportJson(); KWE.toast('백업 파일을 내려받았습니다');
  });
  document.getElementById('import-btn').addEventListener('click', function () {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    KWE.importJson(f, function (err) {
      if (err) { KWE.toast('불러오기 실패: ' + err.message); return; }
      KWE.toast('진도를 복원했습니다'); setTimeout(function () { location.reload(); }, 700);
    });
  });
  document.getElementById('reset-btn').addEventListener('click', function () {
    if (!confirm('모든 진도와 복습 일정이 삭제됩니다. 계속할까요?')) return;
    localStorage.removeItem('kwe_state_v2'); localStorage.removeItem('kwe_progress_v1');
    location.reload();
  });
})();
