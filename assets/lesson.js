/* Lesson continuity and small, explicit learning actions. */
(function () {
  'use strict';
  var E = KWE.esc, id = document.body.dataset.lesson;
  KWE.init('home');
  var state = KWE.load();
  var sentences = JSON.parse(document.getElementById('lesson-sentences').textContent);
  function syncSaved() {
    document.querySelectorAll('[data-sentence-save]').forEach(function (button) {
      var p = sentences[button.dataset.sentenceSave], saved = KWE.isPinned(p.id);
      button.classList.toggle('on', saved); button.setAttribute('aria-pressed', saved);
      button.setAttribute('aria-label', (saved ? '저장 해제: ' : '문장 저장: ') + p.en);
      button.querySelector('span').textContent = saved ? '저장됨' : '저장';
    });
  }
  syncSaved();
  if (!(state.lessons[id] || {}).done) { state.lastLesson = id; KWE.save(); }
  if (!location.hash && state.positions[id]) requestAnimationFrame(function () { window.scrollTo(0, state.positions[id]); });
  var positionTimer;
  function savePosition() { state.positions[id] = window.scrollY; KWE.save(); }
  window.addEventListener('scroll', function () { clearTimeout(positionTimer); positionTimer = setTimeout(savePosition, 200); }, { passive: true });
  window.addEventListener('pagehide', savePosition);
  document.addEventListener('click', function (event) {
    var save = event.target.closest('[data-sentence-save]');
    if (save) {
      var added = KWE.toggleSentence(sentences[save.dataset.sentenceSave]);
      if (added !== null) { syncSaved(); KWE.toast(added ? '저장한 표현에 추가했습니다 · 현장과 연습에서 꺼내보세요' : '저장한 표현에서 뺐습니다'); }
      return;
    }
    var button = event.target.closest('[data-say]'); if (button) KWE.playButton(button, button.dataset.say);
  });
  var dialogueButton = document.getElementById('play-dialogue'), playing = false, dialogueTimer, dialogueIndex = 0;
  var lines = Array.from(document.querySelectorAll('#dialogue .line .en'));
  function stopDialogue() {
    playing = false; clearTimeout(dialogueTimer);
    if (dialogueButton) dialogueButton.textContent = '전체 듣기';
    lines.forEach(function (line) { line.closest('.line').style.opacity = ''; });
  }
  if (dialogueButton) dialogueButton.onclick = function () {
    if (playing) { stopDialogue(); KWE.stopSpeak(); return; }
    playing = true; dialogueIndex = 0; dialogueButton.textContent = '듣기 중지';
    function next() {
      if (!playing || dialogueIndex >= lines.length) { stopDialogue(); return; }
      lines.forEach(function (line, n) { line.closest('.line').style.opacity = n === dialogueIndex ? '1' : '.6'; });
      KWE.speak(lines[dialogueIndex].dataset.t, {
        onend: function () { if (!playing) return; dialogueIndex++; dialogueTimer = setTimeout(next, 450); },
        onstop: stopDialogue, onerror: stopDialogue
      });
    }
    next();
  };
  function leave() { stopDialogue(); KWE.stopSpeak(); }
  window.addEventListener('pagehide', leave);
  document.addEventListener('visibilitychange', function () { if (document.hidden) leave(); });
  state.quizAnswers[id] = state.quizAnswers[id] || [];
  document.querySelectorAll('.quiz-choices').forEach(function (group, index) {
    var labels = Array.from(group.querySelectorAll('label'));
    var feedback = document.createElement('p'); feedback.className = 'small'; feedback.setAttribute('role', 'status'); group.after(feedback);
    function showAnswer(chosen) {
      if (!labels[chosen]) return;
      group.dataset.done = '1';
      var correct = labels[chosen].dataset.correct === 'true';
      labels.forEach(function (label) { if (label.dataset.correct === 'true') label.classList.add('correct'); label.querySelector('input').disabled = true; });
      labels[chosen].querySelector('input').checked = true;
      if (!correct) labels[chosen].classList.add('wrong');
      feedback.textContent = correct ? '맞아요. 이 표현을 소리 내어 말해보세요.' : '정답: ' + labels.find(function (label) { return label.dataset.correct === 'true'; }).querySelector('span').textContent;
      var saveAnswer = group.parentElement.querySelector('.quiz-save'); if (saveAnswer) saveAnswer.hidden = false;
    }
    if (Number.isInteger(state.quizAnswers[id][index])) showAnswer(state.quizAnswers[id][index]);
    group.addEventListener('click', function (event) {
      var label = event.target.closest('label'); if (!label || group.dataset.done) return;
      var chosen = labels.indexOf(label); state.quizAnswers[id][index] = chosen; showAnswer(chosen);
      var d = KWE.day(); d.quiz[0] += label.dataset.correct === 'true' ? 1 : 0; d.quiz[1]++; KWE.save();
    });
  });
  state.checks[id] = state.checks[id] || [];
  document.querySelectorAll('#checklist input').forEach(function (checkbox, index) {
    checkbox.checked = !!state.checks[id][index];
    checkbox.onchange = function () { state.checks[id][index] = checkbox.checked; KWE.save(); };
  });
  var timerButton = document.getElementById('timer-btn'), timerView = document.getElementById('timer-view'), timer;
  function stopTimer() { clearInterval(timer); timer = null; if (timerButton) timerButton.textContent = '60초 소리 내기'; }
  if (timerButton) timerButton.onclick = function () {
    if (timer) { stopTimer(); timerView.textContent = ''; return; }
    var end = Date.now() + 60000;
    timerButton.textContent = '타이머 중지'; timerView.textContent = '60초 · 지금 소리 내어 말해보세요';
    timer = setInterval(function () { var left = Math.max(0, Math.ceil((end - Date.now()) / 1000)); if (!left) { stopTimer(); timerView.textContent = '60초 완료'; } else timerView.textContent = left + '초 남음'; }, 250);
  };
  window.addEventListener('pagehide', stopTimer);
  function renderState() {
    var record = state.lessons[id], target = document.getElementById('complete-state');
    target.innerHTML = record && record.done ? '<b>완료</b> · 마지막 학습 ' + E(record.last || record.first) + ' · 다음 복습 <b>' + E(record.due) + '</b>' : '오늘 레슨을 마쳤다면 직접 느낀 난이도를 골라주세요. 다음 복습일이 저장됩니다.';
  }
  document.querySelectorAll('#gradebar button').forEach(function (button) { button.onclick = function () { var record = KWE.completeLesson(id, +button.dataset.g); renderState(); KWE.toast('학습 저장 · 다음 복습 ' + record.due); }; });
  renderState();
})();
