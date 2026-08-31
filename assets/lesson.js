/* 레슨 페이지 동작 */
(function () {
  'use strict';
  var E = KWE.esc;
  var id = document.body.dataset.lesson;

  KWE.init('home');

  /* TTS 버튼 */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-say]');
    if (!b) return;
    if (!KWE.ttsSupported) { KWE.toast('이 브라우저는 발음 재생을 지원하지 않습니다'); return; }
    KWE.speak(b.dataset.say);
  });
  if (!KWE.ttsSupported) {
    document.querySelectorAll('[data-say],#play-dialogue').forEach(function (b) { b.style.display = 'none'; });
  }

  /* 대화 전체 듣기 */
  var dlgBtn = document.getElementById('play-dialogue');
  if (dlgBtn) {
    var playing = false;
    dlgBtn.addEventListener('click', function () {
      var lines = Array.prototype.map.call(
        document.querySelectorAll('#dialogue .line .en'),
        function (el) { return { text: el.dataset.t || el.textContent.trim(), el: el.closest('.line') }; });
      if (playing) { playing = false; KWE.stopSpeak(); dlgBtn.textContent = '▶ 전체 듣기'; return; }
      playing = true; dlgBtn.textContent = '⏸ 정지';
      var i = 0;
      (function next() {
        if (!playing || i >= lines.length) {
          playing = false; dlgBtn.textContent = '▶ 전체 듣기';
          lines.forEach(function (l) { l.el.style.opacity = ''; });
          return;
        }
        lines.forEach(function (l, n) { l.el.style.opacity = n === i ? '1' : '.45'; });
        KWE.speak(lines[i].text, { onend: function () { i++; setTimeout(next, 450); } });
      })();
    });
  }

  /* 퀴즈 */
  document.querySelectorAll('.quiz-choices').forEach(function (group) {
    group.addEventListener('click', function (ev) {
      var lab = ev.target.closest('label'); if (!lab) return;
      if (group.dataset.done) return;
      group.dataset.done = '1';
      var ok = lab.dataset.correct === 'true';
      group.querySelectorAll('label').forEach(function (l) {
        if (l.dataset.correct === 'true') l.classList.add('correct');
      });
      if (!ok) lab.classList.add('wrong');
      var d = KWE.day();
      d.quiz = [(d.quiz[0] || 0) + (ok ? 1 : 0), (d.quiz[1] || 0) + 1];
      KWE.save();
    });
  });

  /* 자기 평가 체크박스 저장 */
  var s = KWE.load();
  s.checks = s.checks || {};
  var saved = s.checks[id] || [];
  document.querySelectorAll('#checklist input[type=checkbox]').forEach(function (cb, i) {
    cb.checked = !!saved[i];
    cb.addEventListener('change', function () {
      var st = KWE.load(); st.checks = st.checks || {};
      var arr = st.checks[id] || [];
      arr[i] = cb.checked; st.checks[id] = arr; KWE.save();
    });
  });

  /* 스피킹 타이머 */
  var tb = document.getElementById('timer-btn'), tv = document.getElementById('timer-view'), tid = null;
  if (tb) {
    tb.addEventListener('click', function () {
      if (tid) { clearInterval(tid); tid = null; tb.textContent = '⏱️ 60초 스피킹 타이머'; tv.textContent = ''; return; }
      var left = 60;
      tb.textContent = '⏹ 중지';
      tv.textContent = left + '초 남음 — 지금 소리 내어 말하세요';
      tid = setInterval(function () {
        left--;
        if (left <= 0) {
          clearInterval(tid); tid = null;
          tb.textContent = '⏱️ 60초 스피킹 타이머';
          tv.textContent = '완료! 👏';
          KWE.toast('60초 스피킹 완료');
          return;
        }
        tv.textContent = left + '초 남음';
      }, 1000);
    });
  }

  /* 완료 + 난이도 평가 */
  function renderState() {
    var rec = KWE.load().lessons[id];
    var el = document.getElementById('complete-state');
    if (!el) return;
    if (rec && rec.done) {
      var t = KWE.today();
      var d = KWE.diffDays(t, rec.due);
      el.innerHTML = '✅ <b>완료</b> · 마지막 학습 ' + E(rec.last || rec.first) +
        ' · 다음 복습 <b>' + E(rec.due) + '</b>' +
        (d > 0 ? ' (' + d + '일 뒤)' : d === 0 ? ' (오늘)' : ' (' + (-d) + '일 지남)') +
        ' · 누적 ' + (rec.reps || 0) + '회';
    } else {
      el.innerHTML = '오늘 레슨을 마쳤다면 체감 난이도를 눌러주세요. 난이도에 맞춰 다음 복습 날짜가 정해집니다.';
    }
  }
  document.querySelectorAll('#gradebar button').forEach(function (b) {
    b.addEventListener('click', function () {
      var rec = KWE.completeLesson(id, +b.dataset.g);
      renderState();
      KWE.toast('저장했습니다 — 다음 복습 ' + rec.due);
    });
  });
  renderState();
})();
