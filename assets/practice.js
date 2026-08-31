/* 연습 — 플래시카드 / 통합 퀴즈 / 섀도잉 / 듣기 */
(function () {
  'use strict';
  var E = KWE.esc;
  var lessons = [], phrases = [], catLabel = {};
  var stage = document.getElementById('stage'), menu = document.getElementById('menu');

  KWE.init('practice');

  Promise.all([KWE.lessonsJson(), KWE.phrasesJson()]).then(function (r) {
    lessons = r[0]; phrases = r[1].phrases;
    r[1].categories.forEach(function (c) { catLabel[c.id] = c.emoji + ' ' + c.label; });
    menuStats();
    route();
  }).catch(function (e) {
    menu.innerHTML = '<div class="empty">데이터를 불러오지 못했습니다 — ' + E(e.message) + '</div>';
  });

  document.querySelectorAll('.mode').forEach(function (b) {
    b.addEventListener('click', function () { location.hash = b.dataset.mode; });
  });
  window.addEventListener('hashchange', route);

  function route() {
    var m = location.hash.replace('#', '');
    KWE.stopSpeak();
    if (!m) { menu.hidden = false; stage.hidden = true; stage.innerHTML = ''; menuStats(); return; }
    menu.hidden = true; stage.hidden = false;
    if (m === 'flash') flash();
    else if (m === 'quiz') quiz();
    else if (m === 'shadow') shadow();
    else if (m === 'listen') listen();
    else location.hash = '';
  }
  function back() { location.hash = ''; }
  function header(title, sub) {
    return '<div class="spread" style="margin-bottom:10px"><h1 style="font-size:19px;margin:0">' + title + '</h1>' +
      '<button class="btn sm ghost" type="button" onclick="location.hash=\'\'">✕ 종료</button></div>' +
      (sub ? '<div class="tiny muted" style="margin-bottom:12px">' + sub + '</div>' : '');
  }

  function menuStats() {
    var s = KWE.load();
    var t = KWE.today();
    var dueCards = phrases.filter(function (p) {
      var c = s.cards[p.id]; return !c || KWE.diffDays(c.due, t) >= 0;
    }).length;
    var d = s.days[t] || { quiz: [0, 0], cards: 0 };
    document.getElementById('menu-stats').innerHTML =
      '<div class="spread small"><span>오늘 볼 카드</span><b>' + dueCards + '장</b></div>' +
      '<div class="spread small" style="margin-top:6px"><span>오늘 연습한 카드</span><b>' + (d.cards || 0) + '장</b></div>' +
      '<div class="spread small" style="margin-top:6px"><span>오늘 퀴즈</span><b>' + (d.quiz[1] ? d.quiz[0] + ' / ' + d.quiz[1] : '—') + '</b></div>';
  }

  /* ---------------- 플래시카드 ---------------- */
  function flash() {
    var s = KWE.load(), t = KWE.today();
    var deck = phrases.filter(function (p) {
      var c = s.cards[p.id]; return !c || KWE.diffDays(c.due, t) >= 0;
    });
    shuffle(deck);
    deck = deck.slice(0, 20);
    if (!deck.length) {
      stage.innerHTML = header('🃏 플래시카드') +
        '<div class="empty">오늘 볼 카드를 모두 마쳤습니다 👏<br><span class="tiny">내일 다시 꺼내드릴게요.</span></div>' +
        '<button class="btn block" type="button" onclick="location.hash=\'\'">메뉴로</button>';
      return;
    }
    var i = 0, revealed = false, right = 0;

    function draw() {
      if (i >= deck.length) {
        stage.innerHTML = header('🃏 플래시카드 완료') +
          '<div class="card"><div class="score">' + right + ' / ' + deck.length + '</div>' +
          '<div class="tiny muted" style="text-align:center;margin-top:6px">바로 떠올린 카드</div></div>' +
          '<button class="btn primary block" type="button" onclick="location.reload()">한 세트 더</button>' +
          '<button class="btn block ghost" style="margin-top:8px" type="button" onclick="location.hash=\'\'">메뉴로</button>';
        return;
      }
      var p = deck[i];
      stage.innerHTML = header('🃏 플래시카드', catLabel[p.cat] + ' · ' + (i + 1) + ' / ' + deck.length) +
        '<div class="flash" id="cardbox">' +
        '<div class="front">' + E(p.ko) + '</div>' +
        (revealed ? '<div class="back">' + E(p.en) + '</div>' : '') +
        '<div class="hint">' + (revealed ? '얼마나 쉬웠나요?' : '탭하면 정답이 보입니다') + '</div>' +
        '</div>' +
        (revealed
          ? '<div class="gradebar">' +
          gbtn(1, '다시', '1일 뒤') + gbtn(3, '어려움', '짧게') + gbtn(4, '보통', '표준') + gbtn(5, '쉬움', '길게') +
          '</div>' +
          (KWE.ttsSupported ? '<button class="btn block ghost sm" style="margin-top:8px" id="say">🔊 발음 듣기</button>' : '')
          : '<button class="btn primary block" style="margin-top:12px" id="reveal">정답 보기</button>');

      var box = document.getElementById('cardbox');
      box.addEventListener('click', function () { if (!revealed) { revealed = true; draw(); } });
      var rv = document.getElementById('reveal');
      if (rv) rv.addEventListener('click', function () { revealed = true; draw(); });
      var say = document.getElementById('say');
      if (say) say.addEventListener('click', function () { KWE.speak(p.en); });
      stage.querySelectorAll('[data-g]').forEach(function (b) {
        b.addEventListener('click', function () {
          var g = +b.dataset.g;
          var st = KWE.load();
          st.cards[p.id] = KWE.schedule(st.cards[p.id], g);
          KWE.day().cards = (KWE.day().cards || 0) + 1;
          KWE.save();
          if (g >= 4) right++;
          if (g === 1) deck.push(p);
          i++; revealed = false; draw();
        });
      });
      if (revealed && KWE.ttsSupported) KWE.speak(p.en);
    }
    function gbtn(g, label, sub) {
      return '<button type="button" data-g="' + g + '">' + label + '<small>' + sub + '</small></button>';
    }
    draw();
  }

  /* ---------------- 통합 퀴즈 ---------------- */
  function quiz() {
    var pool = [];
    lessons.forEach(function (l) {
      (l.quiz || []).forEach(function (q) {
        pool.push({ q: q.q, choices: q.choices, lesson: l });
      });
    });
    shuffle(pool);
    var set = pool.slice(0, 10);
    if (!set.length) { stage.innerHTML = header('🧪 퀴즈') + '<div class="empty">문제가 없습니다.</div>'; return; }
    var i = 0, right = 0, answered = false;

    function draw() {
      if (i >= set.length) {
        var pct = Math.round(right / set.length * 100);
        var d = KWE.day(); d.quiz = [(d.quiz[0] || 0) + right, (d.quiz[1] || 0) + set.length]; KWE.save();
        stage.innerHTML = header('🧪 퀴즈 완료') +
          '<div class="card"><div class="score">' + right + ' / ' + set.length + '</div>' +
          '<div class="tiny muted" style="text-align:center;margin-top:6px">정답률 ' + pct + '%</div></div>' +
          '<button class="btn primary block" type="button" onclick="location.reload()">한 세트 더</button>' +
          '<button class="btn block ghost" style="margin-top:8px" type="button" onclick="location.hash=\'\'">메뉴로</button>';
        return;
      }
      var it = set[i];
      var choices = it.choices.slice(); shuffle(choices);
      stage.innerHTML = header('🧪 통합 퀴즈', 'Lesson ' + KWE.pad4(it.lesson.id) + ' · ' + E(it.lesson.topicKo)) +
        '<div class="card"><div class="quiz-q"><div class="q">' + E(it.q) + '</div>' +
        '<div class="quiz-choices" id="ch">' + choices.map(function (c, n) {
          return '<label data-correct="' + (c.correct ? 'true' : 'false') + '" tabindex="0">' +
            '<input type="radio" name="c" tabindex="-1"><span>' + E(c.text) + '</span></label>';
        }).join('') + '</div></div></div>' +
        '<div class="qcount">' + (i + 1) + ' / ' + set.length + ' · 현재 ' + right + '점</div>' +
        '<button class="btn primary block" style="margin-top:12px" id="nx" disabled>다음 →</button>';

      answered = false;
      var ch = document.getElementById('ch');
      ch.addEventListener('click', function (ev) {
        var lab = ev.target.closest('label'); if (!lab || answered) return;
        answered = true;
        var ok = lab.dataset.correct === 'true';
        if (ok) right++;
        ch.querySelectorAll('label').forEach(function (l) {
          if (l.dataset.correct === 'true') l.classList.add('correct');
        });
        if (!ok) lab.classList.add('wrong');
        document.getElementById('nx').disabled = false;
        document.getElementById('nx').focus();
      });
      document.getElementById('nx').addEventListener('click', function () { i++; draw(); });
    }
    draw();
  }

  /* ---------------- 섀도잉 ---------------- */
  function shadow() {
    if (!KWE.srSupported) {
      stage.innerHTML = header('🎙️ 섀도잉') +
        '<div class="empty">이 브라우저는 음성 인식을 지원하지 않습니다.<br>' +
        '<span class="tiny">데스크톱 Chrome 또는 Android Chrome에서 사용해 주세요. 그동안은 듣기 연속재생을 활용하세요.</span></div>' +
        '<button class="btn block" type="button" onclick="location.hash=\'listen\'">🔊 듣기 연속재생으로</button>';
      return;
    }
    var pins = KWE.load().pins;
    var deck = phrases.slice();
    if (pins.length >= 5) deck = phrases.filter(function (p) { return pins.indexOf(p.id) >= 0; });
    shuffle(deck); deck = deck.slice(0, 10);
    var i = 0, total = 0, rec = null;

    function draw(result) {
      var p = deck[i];
      if (!p) {
        stage.innerHTML = header('🎙️ 섀도잉 완료') +
          '<div class="card"><div class="score">' + Math.round(total / deck.length) + '%</div>' +
          '<div class="tiny muted" style="text-align:center;margin-top:6px">평균 일치율</div></div>' +
          '<button class="btn primary block" type="button" onclick="location.reload()">한 세트 더</button>' +
          '<button class="btn block ghost" style="margin-top:8px" type="button" onclick="location.hash=\'\'">메뉴로</button>';
        return;
      }
      stage.innerHTML = header('🎙️ 섀도잉', catLabel[p.cat] + ' · ' + (i + 1) + ' / ' + deck.length) +
        '<div class="card"><div style="font-size:18px;font-weight:650;line-height:1.5">' + E(p.en) + '</div>' +
        '<div class="small muted" style="margin-top:6px">' + E(p.ko) + '</div>' +
        (result ? '<div class="heard">' + result.marks.map(function (m) {
          return '<w class="' + (m.hit ? 'hit' : 'miss') + '">' + E(m.w) + '</w>';
        }).join(' ') + '</div><div class="score" style="margin-top:10px;font-size:26px">' + result.score + '%</div>' : '') +
        '</div>' +
        '<div class="row" style="gap:8px;margin-top:10px">' +
        '<button class="btn block" type="button" id="play">🔊 듣기</button>' +
        '<button class="btn primary block" type="button" id="mic">🎙️ 말하기</button>' +
        '</div>' +
        '<div id="recstate"></div>' +
        (result ? '<button class="btn block ghost" style="margin-top:10px" id="next">다음 →</button>' : '');

      document.getElementById('play').addEventListener('click', function () { KWE.speak(p.en); });
      document.getElementById('mic').addEventListener('click', function () {
        document.getElementById('recstate').innerHTML =
          '<div class="rec"><span class="recdot"></span><span class="small muted">듣고 있어요… 지금 말하세요</span></div>';
        rec = KWE.listen(function (alts) {
          var best = { score: -1 };
          alts.forEach(function (a) { var s = KWE.scoreSpeech(p.en, a); if (s.score > best.score) best = s; });
          total += best.score;
          draw(best);
        }, function (err) {
          document.getElementById('recstate').innerHTML =
            '<div class="tiny muted" style="text-align:center;margin-top:8px">' +
            (err === 'not-allowed' ? '마이크 권한이 필요합니다.' : '인식 실패 (' + E(err) + ') — 다시 시도해 주세요.') + '</div>';
        });
      });
      var nx = document.getElementById('next');
      if (nx) nx.addEventListener('click', function () { i++; draw(null); });
    }
    draw(null);
  }

  /* ---------------- 듣기 연속재생 ---------------- */
  function listen() {
    if (!KWE.ttsSupported) {
      stage.innerHTML = header('🔊 듣기') + '<div class="empty">이 브라우저는 음성 재생을 지원하지 않습니다.</div>';
      return;
    }
    var pins = KWE.load().pins;
    var deck = pins.length ? phrases.filter(function (p) { return pins.indexOf(p.id) >= 0; }) : phrases.slice();
    var i = 0, playing = false;

    function draw() {
      var p = deck[i];
      stage.innerHTML = header('🔊 듣기 연속재생', (pins.length ? '즐겨찾기 ' : '전체 ') + deck.length + '개 · ' + (i + 1) + '번째') +
        '<div class="card" style="text-align:center;padding:24px 16px">' +
        '<div class="tiny" style="color:var(--accent2);font-weight:700">' + E(p.situation) + '</div>' +
        '<div style="font-size:19px;font-weight:650;margin-top:8px;line-height:1.45">' + E(p.en) + '</div>' +
        '<div class="small muted" style="margin-top:8px">' + E(p.ko) + '</div></div>' +
        '<div class="row" style="gap:8px;margin-top:10px">' +
        '<button class="btn block" type="button" id="prev">← 이전</button>' +
        '<button class="btn primary block" type="button" id="toggle">' + (playing ? '⏸ 정지' : '▶ 자동 재생') + '</button>' +
        '<button class="btn block" type="button" id="nxt">다음 →</button></div>' +
        '<div class="tiny muted" style="text-align:center;margin-top:10px">즐겨찾기한 표현이 있으면 그것만 재생합니다</div>';

      document.getElementById('prev').addEventListener('click', function () { i = (i - 1 + deck.length) % deck.length; draw(); if (playing) step(); });
      document.getElementById('nxt').addEventListener('click', function () { i = (i + 1) % deck.length; draw(); if (playing) step(); });
      document.getElementById('toggle').addEventListener('click', function () {
        playing = !playing; draw();
        if (playing) step(); else KWE.stopSpeak();
      });
    }
    function step() {
      var p = deck[i];
      KWE.speak(p.en, {
        onend: function () {
          if (!playing) return;
          setTimeout(function () {
            if (!playing) return;
            i = (i + 1) % deck.length; draw(); step();
          }, 900);
        }
      });
    }
    draw();
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
})();
