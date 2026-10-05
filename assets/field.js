/* Field search, shooting kit and an explicit read-aloud surface. */
(function () {
  'use strict';
  var E = KWE.esc, I = KWE.icon, data, byId = {}, category = 'all', scope = 'all', q = '', expanded = false;
  var input = document.getElementById('q'), results = document.getElementById('results');
  var view = { q: '', category: 'all', scope: 'all', scroll: 0, expanded: false };
  try { view = Object.assign(view, JSON.parse(sessionStorage.getItem('kwe-field-view') || '{}')); } catch (e) { }
  function hashView() {
    var params = new URLSearchParams(location.hash.slice(1));
    if (params.has('q')) { view.q = params.get('q'); view.category = 'all'; view.scope = 'all'; view.scroll = 0; view.expanded = false; }
    if (params.has('scope')) { view.scope = params.get('scope'); view.q = ''; view.category = 'all'; view.scroll = 0; view.expanded = false; }
  }
  hashView(); q = String(view.q || '').slice(0, 300); scope = ['all', 'saved', 'kit'].includes(view.scope) ? view.scope : 'all'; category = view.category || 'all';
  expanded = view.expanded === true; input.value = q; KWE.init('field');
  function persist() {
    view = { q: q, category: category, scope: scope, scroll: window.scrollY, expanded: expanded };
    try { sessionStorage.setItem('kwe-field-view', JSON.stringify(view)); } catch (e) { }
  }
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', function () { if (document.hidden) persist(); });
  function resetView() { q = ''; input.value = ''; category = 'all'; scope = 'all'; expanded = false; render(); }
  KWE.phrasesJson().then(function (d) {
    data = d; data.phrases.forEach(function (p) { byId[p.id] = p; });
    if (!data.categories.some(function (c) { return c.id === category; })) category = 'all';
    render(); requestAnimationFrame(function () { window.scrollTo(0, Number(view.scroll) || 0); });
  }).catch(function () {
    results.innerHTML = '<div class="empty"><h2>표현을 불러오지 못했어요</h2><p>첫 오프라인 준비 전에는 연결이 필요합니다.</p><button class="btn" type="button" id="retry">다시 시도</button></div>';
    document.getElementById('retry').onclick = function () { location.reload(); };
  });
  function action(name, label, id, active) {
    return '<button class="iconbtn' + (active ? ' on' : '') + '" type="button" data-' + name + '="' + E(id) + '" aria-label="' + E(label) + '"' + (['star', 'kit'].includes(name) ? ' aria-pressed="' + !!active + '"' : '') + '>' + I(name === 'play' ? 'sound' : name) + '</button>';
  }
  function card(p) {
    var pinned = KWE.isPinned(p.id), inKit = KWE.load().kit.includes(p.id);
    var more = p.note || p.nuance || p.shortEn || p.politeEn;
    return '<article class="phrase" data-id="' + E(p.id) + '"><div class="sit">' + E(p.situation) + '</div><h2 class="en" lang="en">' + E(p.en) + '</h2>' +
      (KWE.get('showKo') ? '<p class="ko">' + E(p.ko) + '</p>' : '') +
      '<div class="phrase-actions">' + action('play', '발음 듣기: ' + p.en, p.id) + action('show', '영어 크게 보기: ' + p.situation, p.id) + action('star', pinned ? '저장 해제: ' + p.situation : '표현 저장: ' + p.situation, p.id, pinned) + action('kit', inKit ? '촬영 준비에서 빼기: ' + p.situation : '촬영 준비에 담기: ' + p.situation, p.id, inKit) + '</div>' +
      (more ? '<details class="phrase-detail"><summary>말투와 사용 팁</summary><p>' + E(p.note || p.nuance || '') + '</p>' +
      (p.shortEn ? '<div class="variant"><span>짧게</span><p lang="en">' + E(p.shortEn) + '</p></div>' : '') +
      (p.politeEn ? '<div class="variant"><span>부드럽게</span><p lang="en">' + E(p.politeEn) + '</p></div>' : '') + '</details>' : '') +
      (scope === 'kit' ? '<div class="kit-order"><span class="small muted">촬영 순서 ' + (KWE.load().kit.indexOf(p.id) + 1) + '</span><button class="iconbtn" data-move="' + E(p.id) + '" data-direction="-1" aria-label="앞 순서로: ' + E(p.situation) + '" type="button"' + (KWE.load().kit.indexOf(p.id) === 0 ? ' disabled' : '') + '>' + I('up') + '</button><button class="iconbtn" data-move="' + E(p.id) + '" data-direction="1" aria-label="뒤 순서로: ' + E(p.situation) + '" type="button"' + (KWE.load().kit.indexOf(p.id) === KWE.load().kit.length - 1 ? ' disabled' : '') + '>' + I('down') + '</button></div>' : '') + '</article>';
  }
  function render() {
    if (!data) return;
    KWE.stopSpeak();
    var state = KWE.load();
    document.getElementById('saved-count').textContent = state.pins.length;
    document.getElementById('kit-count').textContent = state.kit.length;
    document.querySelectorAll('[data-scope]').forEach(function (b) { var on = b.dataset.scope === scope; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
    document.getElementById('cats').innerHTML = [{ id: 'all', label: '모든 상황' }].concat(data.categories).map(function (c) { return '<button class="chip' + (c.id === category ? ' active' : '') + '" data-cat="' + c.id + '" type="button" aria-pressed="' + (c.id === category) + '">' + E(c.label) + '</button>'; }).join('');
    document.getElementById('category-label').textContent = category === 'all' ? '모든 상황' : data.categories.find(function (c) { return c.id === category; }).label;
    document.getElementById('clear-search').hidden = !q;
    document.getElementById('quick-search').hidden = !!q || scope !== 'all';
    document.getElementById('moments-entry').hidden = !!q || scope !== 'all';
    document.getElementById('kit-tools').hidden = scope !== 'kit';
    document.getElementById('kit-name').value = state.kitName;
    var ko = document.getElementById('ko-btn'); ko.setAttribute('aria-pressed', KWE.get('showKo')); ko.textContent = KWE.get('showKo') ? '한국어 표시 중' : '한국어 숨김';
    var out = document.getElementById('outdoor-btn'); out.setAttribute('aria-pressed', KWE.get('outdoor')); out.classList.toggle('on', KWE.get('outdoor'));
    var source = data.phrases.filter(function (p) { return scope === 'all' || (scope === 'saved' ? state.pins : state.kit).includes(p.id); });
    var rows = KWEModel.search(source, q, category);
    if (scope === 'kit' && !q) rows.sort(function (a, b) { return state.kit.indexOf(a.id) - state.kit.indexOf(b.id); });
    var limited = scope === 'all' && category === 'all' && !q && !expanded;
    document.getElementById('result-count').textContent = limited ? '자주 쓰는 표현 8개 · 전체 ' + rows.length + '개' : rows.length + '개 표현';
    document.getElementById('show-all').hidden = !limited;
    if (limited) rows = rows.slice(0, 8);
    results.innerHTML = rows.length ? rows.map(card).join('') : '<div class="empty"><h2>' + (scope === 'kit' && !state.kit.length ? '촬영 전에 말을 모아두세요' : scope === 'saved' && !state.pins.length ? '자주 쓸 말을 저장하세요' : '맞는 표현을 찾지 못했어요') + '</h2><p>' + (q || category !== 'all' ? '검색어를 줄이거나 다른 상황을 선택해 보세요.' : '표현의 ' + (scope === 'kit' ? '가방' : '별') + ' 버튼을 눌러 모아둘 수 있어요.') + '</p><button class="btn" id="reset-view" type="button">전체 표현으로</button>' + (scope === 'kit' && !state.kit.length ? '<button class="btn primary" id="starter-kit" type="button">기본 디렉팅 6개 담기</button>' : '') + '</div>';
    var reset = document.getElementById('reset-view'); if (reset) reset.onclick = resetView;
    var starter = document.getElementById('starter-kit'); if (starter) starter.onclick = function () { KWEModel.search(data.phrases, '', 'all').slice(0, 6).forEach(function (p) { if (!state.kit.includes(p.id)) KWE.toggleKit(p.id); }); render(); KWE.toast('기본 표현 6개를 담았습니다'); };
  }
  var debounce;
  input.addEventListener('input', function () { clearTimeout(debounce); q = input.value.trim().slice(0, 300); expanded = false; persist(); debounce = setTimeout(function () { render(); persist(); }, 60); });
  document.getElementById('clear-search').onclick = function () { input.value = ''; q = ''; render(); input.focus(); persist(); };
  document.getElementById('show-all').onclick = function () { expanded = true; render(); persist(); };
  document.getElementById('ko-btn').onclick = function () { KWE.set('showKo', !KWE.get('showKo')); render(); };
  document.getElementById('outdoor-btn').onclick = function () { var on = KWE.toggleOutdoor(); render(); KWE.toast(on ? '야외 모드 켬' : '이전 화면 설정으로 돌아왔습니다'); };
  document.getElementById('kit-name').addEventListener('input', function (e) { KWE.load().kitName = e.target.value.trim().slice(0, 40); KWE.save(); });
  document.addEventListener('click', function (e) {
    var scopeButton = e.target.closest('[data-scope]'); if (scopeButton) { scope = scopeButton.dataset.scope; render(); persist(); return; }
    var cat = e.target.closest('[data-cat]'); if (cat) { category = cat.dataset.cat; document.querySelector('.category-picker').open = false; render(); document.querySelector('.category-picker summary').focus({ preventScroll: true }); persist(); return; }
    var query = e.target.closest('[data-query]'); if (query) { q = query.dataset.query; input.value = q; scope = 'all'; category = 'all'; render(); persist(); return; }
    var star = e.target.closest('[data-star]'), kit = e.target.closest('[data-kit]');
    if (star || kit) {
      var b = star || kit, id = b.dataset[star ? 'star' : 'kit'];
      var added = star ? KWE.togglePin(id) : KWE.toggleKit(id);
      render();
      if (added === null) return;
      var replacement = results.querySelector('[data-' + (star ? 'star' : 'kit') + '="' + id + '"]');
      if (replacement) replacement.focus({ preventScroll: true });
      else document.querySelector('[data-scope="' + scope + '"]').focus({ preventScroll: true });
      KWE.toast((star ? '저장한 표현' : '촬영 준비') + (added ? '에 추가했습니다' : '에서 뺐습니다')); return;
    }
    var move = e.target.closest('[data-move]'); if (move) {
      var ids = KWE.load().kit, pos = ids.indexOf(move.dataset.move), next = pos + +move.dataset.direction;
      if (next >= 0 && next < ids.length) { var temp = ids[next]; ids[next] = ids[pos]; ids[pos] = temp; KWE.save(); render(); var moved = results.querySelector('[data-move="' + move.dataset.move + '"][data-direction="' + move.dataset.direction + '"]'); if (moved && !moved.disabled) moved.focus({ preventScroll: true }); }
      return;
    }
    var play = e.target.closest('[data-play]'); if (play) { KWE.playButton(play, byId[play.dataset.play].en); return; }
    var show = e.target.closest('[data-show]'); if (show) {
      var p = byId[show.dataset.show]; document.getElementById('show-text').textContent = p.en; document.getElementById('show-speak').onclick = function () { KWE.speak(p.en); }; document.getElementById('show-dialog').showModal(); KWE.stopSpeak();
    }
  });
  var showDialog = document.getElementById('show-dialog');
  document.getElementById('close-show').onclick = function () { showDialog.close(); };
  showDialog.addEventListener('close', KWE.stopSpeak);
  window.addEventListener('hashchange', function () { view = { q: '', scope: 'all', category: 'all', scroll: 0, expanded: false }; hashView(); q = view.q || ''; scope = view.scope || 'all'; category = 'all'; expanded = false; input.value = q; render(); persist(); });
  var top = document.querySelector('.top');
  if (window.ResizeObserver) new ResizeObserver(function () { document.documentElement.style.setProperty('--header-height', top.offsetHeight + 'px'); }).observe(top);
})();
