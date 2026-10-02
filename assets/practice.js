/* Short recall sessions, honest speech feedback and cancellable audio. */
(function () {
  'use strict';
  var E = KWE.esc, I = KWE.icon, lessons = [], phrases = [], byId = {}, categories = {};
  var stage = document.getElementById('stage'), menu = document.getElementById('menu');
  var cleanup = function () {}, generation = 0;
  KWE.init('practice');
  Promise.all([KWE.lessonsJson(), KWE.phrasesJson()]).then(function (data) {
    lessons = data[0]; phrases = data[1].phrases;
    phrases.forEach(function (p) { byId[p.id] = p; });
    data[1].categories.forEach(function (c) { categories[c.id] = c.label; });
    route();
  }).catch(function () { menu.innerHTML = '<div class="empty"><h1>연습을 준비하지 못했어요</h1><p>첫 준비에는 연결이 필요합니다.</p><button class="btn" type="button" onclick="location.reload()">다시 시도</button></div>'; });
  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', function () { generation++; cleanup(); KWE.stopSpeak(); });
  function header(title, sub) {
    return '<div class="practice-head"><a href="practice.html" class="btn ghost">연습 메뉴</a><span class="small muted">' + E(sub || '') + '</span></div><h1 class="practice-title">' + E(title) + '</h1>';
  }
  function route() {
    generation++; cleanup(); cleanup = function () {}; KWE.stopSpeak();
    if (!phrases.length) return;
    var mode = location.hash.slice(1);
    menu.hidden = !!mode; stage.hidden = !mode;
    if (!mode) {
      stage.innerHTML = '';
      var session = KWE.load().session;
      var link = document.querySelector('.practice-hero');
      link.href = '#' + (session ? session.mode : 'quick');
      document.getElementById('resume-label').textContent = session ? '이어서 연습 · ' + session.index + ' / ' + session.ids.length + '개 완료' : '짧은 복습 시작';
      var state = KWE.load(), due = phrases.filter(function (p) { var c = state.cards[p.id]; return c && c.due <= KWE.today(); }).length;
      document.getElementById('menu-stats').textContent = '복습할 표현 ' + due + '개 · 새 표현도 조금씩 함께 연습해요.';
      return;
    }
    if (['quick', 'flash', 'saved', 'hard', 'kit'].includes(mode)) recall(mode);
    else if (mode === 'quiz') quiz();
    else if (mode === 'shadow') shadow();
    else if (mode === 'listen') listen();
    else location.hash = '';
    window.scrollTo(0, 0);
  }
  function empty(title, text, link, label) {
    stage.innerHTML = header(title) + '<div class="empty"><h2>' + E(text) + '</h2><a class="btn primary" href="' + link + '">' + E(label) + '</a></div>';
  }
  function recall(mode) {
    var labels = { quick: '3분 회상', flash: '10장 복습', saved: '저장한 표현', hard: '어려웠던 표현', kit: '촬영 준비 리허설' };
    var state = KWE.load(), session = state.session;
    if (!session || session.mode !== mode || session.index >= session.ids.length) {
      session = { mode: mode, date: KWE.today(), ids: KWEModel.deck(phrases, state, mode, KWE.today()), index: 0, revealed: false, right: 0 };
      state.session = session; KWE.save();
    }
    if (session.ids.some(function (id) { return !byId[id]; })) { state.session = null; KWE.save(); empty(labels[mode], '일부 표현이 바뀌었어요. 새 세트로 시작하세요.', 'practice.html#quick', '짧은 복습 시작'); return; }
    if (!session.ids.length) {
      state.session = null; KWE.save();
      empty(labels[mode], mode === 'kit' ? '촬영 준비에 표현을 담아주세요.' : mode === 'saved' ? '자주 쓸 말을 먼저 저장하세요.' : mode === 'hard' ? '아직 어려움으로 기록한 표현이 없어요.' : '오늘 복습을 마쳤어요.', mode === 'kit' ? 'field.html#scope=kit' : mode === 'saved' ? 'field.html' : 'practice.html#saved', mode === 'kit' ? '촬영 준비 열기' : mode === 'saved' ? '표현 찾아 저장하기' : '저장한 표현 연습'); return;
    }
    function draw(focus) {
      KWE.stopSpeak();
      var p = byId[session.ids[session.index]];
      if (!p) {
        var total = session.ids.length, right = session.right;
        state.session = null; KWE.save();
        stage.innerHTML = header('오늘의 한 걸음, 완료') + '<div class="finish-panel"><span class="eyebrow">WORDS YOU CAN USE</span><h2>' + total + '개 표현을<br>입 밖으로 꺼냈어요.</h2><p>바로 떠올린 표현 ' + right + '개.<br>막혔던 표현은 짧은 간격으로 다시 만나요.</p><a class="btn primary block" href="field.html">현장에서 꺼내 보기</a><button class="btn block" id="again" type="button">한 세트 더</button></div>';
        document.getElementById('again').onclick = function () { recall(mode); }; return;
      }
      stage.innerHTML = header(labels[mode], (session.index + 1) + ' / ' + session.ids.length) + '<div class="progressbar" aria-label="' + session.index + '개 완료"><div style="width:' + (session.index / session.ids.length * 100) + '%"></div></div>' +
        '<section class="recall-card"><span class="eyebrow">' + E(categories[p.cat]) + '</span><h2>' + E(p.situation) + '</h2><p class="recall-prompt">' + E(p.ko) + '</p>' +
        (session.revealed ? '<div class="recall-answer"><p lang="en">' + E(p.en) + '</p><button class="btn" id="say" type="button">' + I('sound') + '발음 듣기</button>' + (p.note || p.nuance ? '<p class="small muted">' + E(p.note || p.nuance) + '</p>' : '') + '</div>' : '<p class="small muted">영어를 떠올린 뒤 소리 내어 말해보세요.</p>') + '</section>' +
        (session.revealed ? '<h2 class="grade-label">직접 느낀 난이도를 골라주세요</h2><div class="gradebar">' + [[1, '다시', '막혔어요'], [3, '어려움', '힌트가 필요해요'], [4, '보통', '떠올렸어요'], [5, '쉬움', '바로 나왔어요']].map(function (g) { return '<button type="button" data-grade="' + g[0] + '">' + g[1] + '<small>' + g[2] + '</small></button>'; }).join('') + '</div><p class="small muted">완료한 표현과 다음 복습일은 바로 저장됩니다.</p>' : '<button class="btn primary block" id="reveal" type="button">영어 확인</button>') + '<p class="tiny muted">지금 나가도 이 카드부터 이어서 연습할 수 있어요.</p>';
      var reveal = document.getElementById('reveal');
      if (reveal) reveal.onclick = function () { session.revealed = true; KWE.save(); draw(); document.getElementById('say').focus({ preventScroll: true }); };
      var say = document.getElementById('say'); if (say) say.onclick = function () { KWE.speak(p.en); };
      stage.querySelectorAll('[data-grade]').forEach(function (b) { b.onclick = function () {
        var grade = +b.dataset.grade;
        state.cards[p.id] = KWE.schedule(state.cards[p.id], grade);
        KWE.day().cards++; if (grade >= 4) session.right++;
        session.index++; session.revealed = false; KWE.save(); draw(true);
      }; });
      if (focus && reveal) reveal.focus({ preventScroll: true });
    }
    draw();
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function quiz() {
    var pool = [];
    lessons.forEach(function (l) { (l.quiz || []).forEach(function (q) { pool.push({ q: q, lesson: l }); }); });
    var set = shuffle(pool).slice(0, 5), index = 0, right = 0;
    function draw() {
      var item = set[index];
      if (!item) { stage.innerHTML = header('상황 퀴즈 완료') + '<div class="finish-panel"><h2>' + right + ' / ' + set.length + '</h2><p>다음 촬영에서 어떤 말을 쓸지 떠올려보세요.</p><a class="btn primary" href="practice.html">연습 메뉴로</a></div>'; return; }
      var options = shuffle(item.q.choices.slice()), answered = false;
      stage.innerHTML = header('상황 퀴즈', (index + 1) + ' / ' + set.length) + '<div class="card"><span class="eyebrow">' + E(item.lesson.topicKo) + '</span><h2>' + E(item.q.q) + '</h2><div class="quiz-choices">' + options.map(function (c, i) { return '<button class="choice" data-choice="' + i + '" type="button">' + E(c.text) + '</button>'; }).join('') + '</div><p id="feedback" role="status"></p></div><button class="btn primary block" id="next" type="button" disabled>다음 문제</button>';
      stage.querySelectorAll('[data-choice]').forEach(function (button) { button.onclick = function () {
        if (answered) return; answered = true;
        var correct = options[+button.dataset.choice].correct;
        if (correct) right++;
        var d = KWE.day(); d.quiz[0] += correct ? 1 : 0; d.quiz[1]++; KWE.save();
        stage.querySelectorAll('[data-choice]').forEach(function (b) { b.disabled = true; if (options[+b.dataset.choice].correct) b.classList.add('correct'); });
        if (!correct) button.classList.add('wrong');
        document.getElementById('feedback').textContent = correct ? '맞아요. 이 상황에서 꺼내 말해보세요.' : '이 상황에는 “' + options.find(function (c) { return c.correct; }).text + '”가 맞아요.';
        document.getElementById('next').disabled = false; document.getElementById('next').focus();
      }; });
      document.getElementById('next').onclick = function () { index++; draw(); };
    }
    draw();
  }
  function shadow() {
    var token = generation, deck = KWEModel.deck(phrases, KWE.load(), KWE.load().pins.length ? 'saved' : 'quick', KWE.today()).map(function (id) { return byId[id]; });
    if (!deck.length) deck = phrases.slice(0, 5);
    var index = 0, recognition = null;
    cleanup = function () { if (recognition) { recognition.abort(); recognition = null; } };
    function draw() {
      cleanup(); KWE.stopSpeak(); var p = deck[index];
      if (!p) { stage.innerHTML = header('따라 말하기 완료') + '<div class="finish-panel"><h2>내 목소리로<br>익힌 ' + deck.length + '개 표현.</h2><a class="btn primary" href="practice.html">연습 메뉴로</a></div>'; return; }
      stage.innerHTML = header('듣고 따라 말하기', (index + 1) + ' / ' + deck.length) + '<section class="recall-card"><span class="eyebrow">' + E(p.situation) + '</span><h2 class="en" lang="en">' + E(p.en) + '</h2><p class="ko">' + E(p.ko) + '</p><button class="btn" id="play" type="button">' + I('sound') + '먼저 듣기</button></section><p class="small muted">듣고, 내 속도로 따라 말해보세요. 음성인식은 들린 단어를 확인하는 보조 기능이며 발음 평가가 아닙니다.</p>' +
        (KWE.srSupported && navigator.onLine ? '<button class="btn block" id="mic" type="button">' + I('mic') + '인식 문장 확인</button>' : '<p class="small muted">현재 환경에서는 음성인식 없이 연습합니다.</p>') + '<div id="recognition-result" role="status" aria-live="polite"></div><button class="btn primary block" id="next" type="button">따라 말했어요 · 다음</button>';
      document.getElementById('play').onclick = function () { KWE.speak(p.en); };
      var mic = document.getElementById('mic');
      if (mic) mic.onclick = function () {
        cleanup(); KWE.stopSpeak(); mic.disabled = true;
        var result = document.getElementById('recognition-result'); result.textContent = '듣고 있어요. 지금 말해보세요.';
        recognition = KWE.listen(function (alternatives) {
          if (token !== generation || !document.getElementById('recognition-result')) return;
          mic.disabled = false;
          var best = alternatives.map(function (text) { return { text: text, score: KWE.scoreSpeech(p.en, text).score }; }).sort(function (a, b) { return b.score - a.score; })[0];
          result.innerHTML = '<p><b>인식된 문장</b><br>' + E(best.text) + '</p><p class="small muted">단어 일치 ' + best.score + '% · 주변 소음과 인식 오류의 영향을 받습니다. 발음 정확도 점수가 아닙니다.</p>';
        }, function (error) {
          if (token !== generation) return;
          mic.disabled = false; result.textContent = error === 'not-allowed' ? '마이크 권한을 사용할 수 없어요. 듣고 직접 확인하며 계속 연습하세요.' : '인식하지 못했어요. 듣고 직접 확인하며 계속 연습하세요.';
        });
        if (recognition) recognition.onend = function () { if (token === generation) { mic.disabled = false; if (result.textContent === '듣고 있어요. 지금 말해보세요.') result.textContent = '인식된 말이 없어요. 다시 시도하거나 직접 확인하세요.'; } };
      };
      document.getElementById('next').onclick = function () { index++; draw(); };
    }
    draw();
  }
  function listen() {
    var state = KWE.load(), source = state.kit.length ? 'kit' : state.pins.length ? 'saved' : 'all';
    var deck = [], index = 0, playing = false, timer = null, token = generation;
    function stop() { playing = false; clearTimeout(timer); KWE.stopSpeak(); }
    cleanup = stop;
    document.addEventListener('visibilitychange', visible);
    function visible() { if (document.hidden) { stop(); if (token === generation) draw(); } }
    var oldCleanup = cleanup; cleanup = function () { oldCleanup(); document.removeEventListener('visibilitychange', visible); };
    function select() { deck = phrases.filter(function (p) { return source === 'all' || (source === 'kit' ? state.kit : state.pins).includes(p.id); }); if (source === 'kit') deck.sort(function (a, b) { return state.kit.indexOf(a.id) - state.kit.indexOf(b.id); }); index = 0; }
    function draw() {
      var p = deck[index];
      stage.innerHTML = header('이어 듣기', deck.length ? (index + 1) + ' / ' + deck.length : '') + '<label for="listen-source">들을 표현</label><select id="listen-source"><option value="kit">촬영 준비</option><option value="saved">저장한 표현</option><option value="all">전체 표현</option></select>' +
        (p ? '<section class="recall-card"><span class="eyebrow">' + E(p.situation) + '</span><h2 class="en" lang="en">' + E(p.en) + '</h2><p class="ko">' + E(p.ko) + '</p></section><div class="listen-controls"><button class="btn" id="prev" type="button" aria-label="이전 표현">이전</button><button class="btn primary" id="toggle" type="button">' + (playing ? '중지' : '이어 듣기') + '</button><button class="btn" id="next" type="button" aria-label="다음 표현">다음</button></div>' : '<div class="empty">모아둔 표현이 없어요. 전체 표현을 선택하거나 현장에서 담아주세요.</div>') + '<p class="small muted">화면을 켜둔 채 사용하세요. 화면을 잠그거나 다른 앱으로 이동하면 재생을 멈춥니다. 기기 음성에 따라 연결이 필요할 수 있습니다.</p>';
      var sel = document.getElementById('listen-source'); sel.value = source; sel.onchange = function () { stop(); source = sel.value; select(); draw(); };
      if (!p) return;
      document.getElementById('toggle').onclick = function () { if (playing) { stop(); draw(); } else { playing = true; draw(); step(); } };
      function move(n) { var resume = playing; stop(); index = (index + n + deck.length) % deck.length; playing = resume; draw(); if (playing) step(); }
      document.getElementById('prev').onclick = function () { move(-1); };
      document.getElementById('next').onclick = function () { move(1); };
    }
    function step() {
      if (!playing || token !== generation) return;
      KWE.speak(deck[index].en, {
        onend: function () { if (!playing || token !== generation) return; timer = setTimeout(function () { if (!playing || token !== generation) return; if (index === deck.length - 1) { stop(); draw(); KWE.toast('선택한 표현을 모두 들었습니다'); } else { index++; draw(); step(); } }, 650); },
        onerror: function () { stop(); draw(); }, onstop: function () { if (playing) { playing = false; clearTimeout(timer); if (token === generation) draw(); } }
      });
    }
    select(); draw();
  }
})();
