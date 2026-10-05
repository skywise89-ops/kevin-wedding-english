/* New URLs may arrive before an installed PWA has activated this release. */
(function () {
  'use strict';
  var lesson = !!document.body.dataset.lesson;
  if (typeof KWE.addToKit !== 'function') {
    KWE.init(lesson ? 'home' : 'field');
    document.getElementById('main').innerHTML = '<div class="empty" id="scene-update-needed"><h1>새 촬영 표현을 준비했어요</h1><p>업데이트 준비가 끝나면 <b>업데이트 적용</b>을 눌러주세요. 저장과 진도는 그대로 유지됩니다.</p><p class="small">연결이 없다면 저장된 홈·현장을 사용할 수 있어요.</p><a class="btn" href="' + KWE.base() + 'index.html">홈 열기</a></div>';
    return;
  }
  var script = document.createElement('script');
  script.src = KWE.base() + 'assets/' + (lesson ? 'lesson.js' : 'moments.js');
  document.body.appendChild(script);
})();
