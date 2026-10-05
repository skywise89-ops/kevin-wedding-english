/* Canonical saves and ordered, atomic scene additions to the shooting kit. */
(function () {
  'use strict';
  var scenes = JSON.parse(document.getElementById('moment-scenes').textContent);
  KWE.init('field');
  function sync() {
    document.getElementById('moment-kit-count').textContent = KWE.load().kit.length + ' / 24';
    document.querySelectorAll('[data-moment-save]').forEach(function (button) {
      var saved = KWE.isPinned(button.dataset.momentSave);
      button.classList.toggle('on', saved); button.setAttribute('aria-pressed', saved);
      button.querySelector('span').textContent = saved ? '저장됨' : '저장';
      button.setAttribute('aria-label', (saved ? '저장 해제: ' : '문장 저장: ') + button.closest('.scene-line').querySelector('.en').textContent);
    });
    document.querySelectorAll('[data-scene-kit]').forEach(function (button) {
      var complete = scenes[button.dataset.sceneKit].every(function (id) { return KWE.load().kit.includes(id); });
      button.querySelector('span').textContent = complete ? '촬영 준비에 담겨 있어요' : '촬영 준비에 담기';
    });
  }
  document.addEventListener('click', function (event) {
    var save = event.target.closest('[data-moment-save]');
    if (save) {
      var added = KWE.togglePin(save.dataset.momentSave);
      if (added !== null) { sync(); KWE.toast(added ? '저장한 표현에 추가했습니다 · 현장과 연습에서 꺼내보세요' : '저장한 표현에서 뺐습니다'); }
      return;
    }
    var kit = event.target.closest('[data-scene-kit]');
    if (kit) {
      var count = KWE.addToKit(scenes[kit.dataset.sceneKit]);
      if (count !== null) { sync(); KWE.toast(count ? count + '개의 말을 순서대로 담았습니다' : '이 상황의 말이 모두 담겨 있어요'); }
      return;
    }
    var play = event.target.closest('[data-say]'); if (play) KWE.playButton(play, play.dataset.say);
  });
  function openHash() {
    var target = document.getElementById(location.hash.slice(1));
    if (!target || !target.closest('.scene-group')) return;
    if (target.matches('.scene-card')) target.open = true;
    requestAnimationFrame(function () { target.scrollIntoView({ block: 'start' }); });
  }
  document.querySelectorAll('.scene-card').forEach(function (card) {
    card.addEventListener('toggle', function () { if (!card.open) KWE.stopSpeak(); });
  });
  window.addEventListener('hashchange', openHash);
  window.addEventListener('pageshow', sync);
  var top = document.querySelector('.top');
  if (window.ResizeObserver) new ResizeObserver(function () { document.documentElement.style.setProperty('--header-height', top.offsetHeight + 'px'); }).observe(top);
  sync(); openHash();
})();
