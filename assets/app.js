
const STORAGE_KEY = 'kwe_progress_v1';

function loadProgress(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch(e){ return {}; }
}
function saveProgress(p){ localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
function todayStr(){ return new Date().toISOString().slice(0,10); }

function markComplete(lessonId){
  const p = loadProgress();
  p[lessonId] = { completed: true, date: todayStr() };
  saveProgress(p);
  updateCompleteButton(lessonId);
}
function updateCompleteButton(lessonId){
  const p = loadProgress();
  const btn = document.getElementById('complete-btn');
  if(!btn) return;
  if(p[lessonId] && p[lessonId].completed){
    btn.textContent = '✅ 완료됨 (' + p[lessonId].date + ')';
    btn.disabled = true;
  }
}

function initQuiz(){
  document.querySelectorAll('.quiz-choices').forEach(group => {
    group.querySelectorAll('label').forEach(label => {
      label.addEventListener('click', () => {
        const correct = label.getAttribute('data-correct') === 'true';
        group.querySelectorAll('label').forEach(l => l.classList.remove('correct','wrong'));
        label.classList.add(correct ? 'correct' : 'wrong');
        if(!correct){
          const rightLabel = Array.from(group.querySelectorAll('label')).find(l => l.getAttribute('data-correct') === 'true');
          if(rightLabel) rightLabel.classList.add('correct');
        }
      });
    });
  });
}

// ---- Homepage logic ----
const SRS_INTERVALS = [1,3,7,14,30];

function daysBetween(d1, d2){
  const a = new Date(d1); const b = new Date(d2);
  return Math.round((b - a) / (1000*60*60*24));
}

async function initHome(){
  const res = await fetch('data/lessons.json');
  const lessons = await res.json();
  const progress = loadProgress();

  // progress counter
  const doneCount = Object.values(progress).filter(v => v.completed).length;
  const totalCount = lessons.length;
  const counterEl = document.getElementById('progress-counter');
  if(counterEl) counterEl.textContent = doneCount + ' / ' + totalCount;
  const barEl = document.getElementById('progress-bar-fill');
  if(barEl) barEl.style.width = (totalCount ? (doneCount/totalCount*100) : 0) + '%';

  // today's lesson = first not completed, else last lesson
  let today = lessons.find(l => !(progress[l.id] && progress[l.id].completed));
  if(!today) today = lessons[lessons.length - 1];
  const heroEl = document.getElementById('today-lesson');
  if(heroEl){
    heroEl.innerHTML = `
      <div class="tag">TODAY · Week ${today.week} Day ${today.day}</div>
      <h1>${today.emoji} Lesson ${String(today.id).padStart(4,'0')} — ${today.topicKo}</h1>
      <div style="color:var(--muted);font-size:14px">${today.expressions.map(e=>e.situation).join(' · ')}</div>
      <a class="cta" href="lessons/${today.filename}">12분 학습 시작 →</a>
    `;
  }

  // SRS review section
  const reviewEl = document.getElementById('review-list');
  if(reviewEl){
    const due = [];
    Object.keys(progress).forEach(idStr => {
      const id = Number(idStr);
      const rec = progress[id];
      if(!rec.completed) return;
      const d = daysBetween(rec.date, todayStr());
      if(SRS_INTERVALS.includes(d)){
        const lesson = lessons.find(l => l.id === id);
        if(lesson) due.push({lesson, d});
      }
    });
    if(due.length === 0){
      reviewEl.innerHTML = '<div style="color:var(--muted);font-size:13px">오늘 복습 예정인 레슨이 없습니다.</div>';
    } else {
      reviewEl.innerHTML = due.map(({lesson,d}) =>
        `<a class="review-chip" href="lessons/${lesson.filename}">D+${d} · Lesson ${String(lesson.id).padStart(4,'0')} ${lesson.topicKo}</a>`
      ).join('');
    }
  }

  // lesson library
  renderLibrary(lessons, progress);
}

function renderLibrary(lessons, progress){
  const listEl = document.getElementById('lesson-list');
  const searchEl = document.getElementById('lesson-search');
  const filterBtns = document.querySelectorAll('.filters button');
  let activeWeek = 'all';

  function draw(){
    const q = (searchEl && searchEl.value || '').trim().toLowerCase();
    const filtered = lessons.filter(l => {
      const weekMatch = activeWeek === 'all' || String(l.week) === activeWeek;
      const text = (l.topicKo + ' ' + l.topicEn + ' ' + l.expressions.map(e=>e.situation+' '+e.en).join(' ')).toLowerCase();
      const searchMatch = !q || text.includes(q);
      return weekMatch && searchMatch;
    });
    if(!listEl) return;
    if(filtered.length === 0){
      listEl.innerHTML = '<div style="color:var(--muted);font-size:13px">일치하는 레슨이 없습니다.</div>';
      return;
    }
    listEl.innerHTML = filtered.map(l => {
      const done = progress[l.id] && progress[l.id].completed;
      return `<li class="lesson-item">
        <div class="emoji">${l.emoji}</div>
        <div class="meta">
          <div class="title">Lesson ${String(l.id).padStart(4,'0')} · ${l.topicKo}</div>
          <div class="sub">Week ${l.week} Day ${l.day} · ${l.weekTitle}</div>
        </div>
        ${done ? '<div class="done">✅ 완료</div>' : `<a href="lessons/${l.filename}">시작 →</a>`}
      </li>`;
    }).join('');
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeWeek = btn.getAttribute('data-week');
      draw();
    });
  });
  if(searchEl) searchEl.addEventListener('input', draw);
  draw();
}

if(document.getElementById('today-lesson')){
  document.addEventListener('DOMContentLoaded', initHome);
}
