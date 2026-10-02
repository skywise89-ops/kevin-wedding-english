/* A quiet dashboard centered on the next useful action. */
(function () {
  'use strict';
  var E = KWE.esc, I = KWE.icon, lessons = [], filter = 'all';
  KWE.init('home');
  KWE.lessonsJson().then(function (data) {
    lessons = data; var state = KWE.load(), stats = KWE.stats(lessons);
    var last = lessons.find(function (l) { return String(l.id) === state.lastLesson && !(state.lessons[l.id] || {}).done; });
    var l = last || KWE.nextLesson(lessons);
    document.getElementById('today-lesson').innerHTML = '<span class="eyebrow">12 MINUTES · DAY ' + l.day + '</span><h2>' + E(l.topicKo) + '</h2><p>' + E(l.goal || l.topicEn) + '</p><a class="btn" href="lessons/' + E(l.filename) + '">' + (last ? '이어서 학습' : '12분 학습 시작') + I('arrow') + '</a>';
    document.getElementById('progress-counter').textContent = stats.done + ' / ' + stats.total + ' 완료';
    document.getElementById('statgrid').innerHTML = [[stats.done + '/' + stats.total, '완료 레슨'], [stats.activeDays, '학습한 날'], [stats.streak, '연속 학습일'], [state.pins.length, '저장한 표현']].map(function (x) { return '<div class="stat"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('');
    var due = KWE.dueLessons(lessons);
    document.getElementById('review-card').innerHTML = due.length ? '<p class="small muted">' + due.length + '개 레슨이 기다려요. 하나부터 시작하세요.</p><div class="duelist">' + due.slice(0, 3).map(function (x) { return '<a class="due" href="lessons/' + E(x.lesson.filename) + '"><span>' + E(x.lesson.topicKo) + '</span>' + I('arrow') + '</a>'; }).join('') + '</div>' : '<p class="small muted">오늘 복습할 레슨이 없어요. 3분 회상으로 표현을 익혀보세요.</p>';
    var cells = [];
    for (var i = 55; i >= 0; i--) { var d = KWE.addDays(KWE.today(), -i), day = state.days[d]; cells.push('<i class="' + (day && (day.lessons.length || day.cards || day.quiz[1]) ? 'on' : '') + '" title="' + d + '"></i>'); }
    document.getElementById('heat').innerHTML = cells.join('');
    document.getElementById('heat-note').textContent = '최근 8주 · 총 ' + stats.activeDays + '일 학습';
    renderLibrary();
  }).catch(function () { document.getElementById('today-lesson').innerHTML = '<h2>레슨을 준비하지 못했어요</h2><p>첫 준비에는 연결이 필요합니다.</p><button class="btn" type="button" onclick="location.reload()">다시 시도</button>'; });
  var state = KWE.load();
  document.getElementById('kit-title').textContent = state.kitName || '이번 촬영 준비';
  document.getElementById('kit-sub').textContent = state.kit.length ? state.kit.length + '개 표현 준비됨 · 순서대로 꺼내 쓰세요' : '쓸 표현을 미리 모아두세요.';
  if (state.session && state.session.index < state.session.ids.length) { document.querySelector('.review-entry').href = 'practice.html#' + state.session.mode; document.getElementById('quick-sub').textContent = '이전 연습 ' + state.session.index + ' / ' + state.session.ids.length + '개 완료 · 이어서 연습'; }
  function renderLibrary() {
    var query = document.getElementById('lesson-search').value.trim().toLowerCase(), s = KWE.load();
    var rows = lessons.filter(function (l) { return (filter === 'all' || (filter === 'todo' ? !(s.lessons[l.id] || {}).done : String(l.week) === filter)) && (!query || [l.topicKo, l.topicEn, l.goal].concat(l.expressions.map(function (x) { return x.ko + ' ' + x.en + ' ' + x.situation; })).join(' ').toLowerCase().includes(query)); });
    document.getElementById('lesson-list').innerHTML = rows.length ? rows.map(function (l) { var done = (s.lessons[l.id] || {}).done; return '<li><a class="lesson-item" href="lessons/' + E(l.filename) + '"><span class="lesson-number">' + String(l.day).padStart(2, '0') + '</span><div><b>' + E(l.topicKo) + '</b><small>Week ' + l.week + ' · ' + E(l.weekTitle) + (done ? ' · 완료' : '') + '</small></div>' + I(done ? 'check' : 'arrow') + '</a></li>'; }).join('') : '<li class="empty">다른 검색어나 주차를 선택해 보세요.</li>';
  }
  document.getElementById('lesson-search').oninput = renderLibrary;
  document.querySelectorAll('[data-week]').forEach(function (b) { b.onclick = function () { filter = b.dataset.week; document.querySelectorAll('[data-week]').forEach(function (x) { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', x === b); }); renderLibrary(); }; });
})();
