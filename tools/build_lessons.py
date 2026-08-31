# -*- coding: utf-8 -*-
"""data/lessons.json → lessons/*.html (정적 생성)"""
import json, html, os

L = json.load(open('data/lessons.json', encoding='utf-8'))
by_id = {l['id']: l for l in L}
e = lambda s: html.escape(s or '', quote=True)

def is_en(text):
    letters = [c for c in (text or '') if c.isalpha()]
    if not letters: return False
    ascii_n = sum(1 for c in letters if ord(c) < 128)
    return ascii_n / len(letters) > 0.6

def say(text, label='🔊'):
    if not is_en(text): return ''
    return f'<button class="speak" type="button" data-say="{e(text)}" aria-label="발음 재생">{label}</button>'

TPL = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="{desc}">
<meta name="theme-color" content="#070f1b">
<title>Lesson {pid} · {topic} · Kevin's Wedding English</title>
<link rel="manifest" href="../manifest.webmanifest">
<link rel="icon" href="../assets/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../assets/icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="stylesheet" href="../assets/style.css">
</head>
<body data-lesson="{id}">
<header class="top">
  <div class="brand">📸 <a href="../index.html">Kevin's Wedding English</a></div>
  <div class="hdr-actions">
    <a class="iconbtn" href="../field.html" title="현장 모드" aria-label="현장 모드">⚡</a>
  </div>
</header>
<div class="wrap">
  <div>
    <span class="badge">Week {week} · Day {day}</span>
    <span class="badge">{weektitle}</span>
    {reviewbadge}
  </div>
  <h1>{emoji} Lesson {pid} — {topic}</h1>
  <div class="goal">🎯 오늘 목표: {goal}</div>

  <h2>💡 왜 이 표현이 필요한가</h2>
  <div class="card">{why}</div>

  <h2>📋 오늘의 핵심 표현 <span class="h2n">{nexp}개</span></h2>
  <div class="card">{expressions}</div>

  {glossary}

  <h2>🗣️ 시나리오 연습</h2>
  {scenarios}

  <h2>💬 실전 대화 <button class="btn sm ghost" type="button" id="play-dialogue">▶ 전체 듣기</button></h2>
  <div class="card dialogue" id="dialogue">{dialogue}</div>

  <h2>🎤 프리토킹 프롬프트</h2>
  <div class="card">{freetalk}
    <div class="row" style="margin-top:12px">
      <button class="btn sm" type="button" id="timer-btn">⏱️ 60초 스피킹 타이머</button>
      <span id="timer-view" class="small muted"></span>
    </div>
  </div>

  <h2>🧪 퀴즈</h2>
  <div class="card">{quiz}</div>

  <h2>📋 자기 평가</h2>
  <div class="card"><ul class="check" id="checklist">{checklist}</ul></div>

  <h2>🎯 오늘의 미션</h2>
  <div class="mission">
    소리 내어 30~45초 — <i>“{mission}”</i> {missionsay}
  </div>

  <h2>✅ 학습 완료</h2>
  <div class="card" id="complete-card">
    <div class="small muted" id="complete-state">오늘 레슨을 마쳤다면 체감 난이도를 눌러주세요. 난이도에 맞춰 다음 복습 날짜가 정해집니다.</div>
    <div class="gradebar" id="gradebar">
      <button type="button" data-g="1">다시<small>내일 또</small></button>
      <button type="button" data-g="3">어려움<small>짧은 간격</small></button>
      <button type="button" data-g="4">보통<small>표준</small></button>
      <button type="button" data-g="5">쉬움<small>긴 간격</small></button>
    </div>
  </div>

  <p class="next">➡️ 다음 예고: {nexthint}</p>

  <div class="navrow">
    <span>{prev}</span>
    <span>{next}</span>
  </div>
</div>
<script src="../assets/core.js"></script>
<script src="../assets/lesson.js"></script>
</body>
</html>
"""

os.makedirs('lessons', exist_ok=True)
for i, l in enumerate(L):
    prev_l = L[i-1] if i > 0 else None
    next_l = L[i+1] if i < len(L)-1 else None

    expressions = ''.join(
        f'<div class="exprow" data-phrase="{e(x["en"])}">'
        f'<div class="body"><div class="sit">{e(x["situation"])}</div>'
        f'<div class="en">{e(x["en"])}</div>'
        f'<div class="ko">{e(x.get("ko",""))}</div>'
        f'<div class="nu">{e(x["nuance"])}</div></div>'
        f'<div class="acts">{say(x["en"])}</div></div>'
        for x in l['expressions'])

    glossary = ''
    if l['glossary']:
        glossary = ('<h2>📝 용어</h2><div class="card">' + ''.join(
            f'<div class="gloss"><b>{e(g["term"])}</b><span>{e(g["def"])}</span></div>'
            for g in l['glossary']) + '</div>')

    scenarios = ''.join(
        f'<div class="scn"><div class="prompt">▶ {e(s["prompt"])}</div>'
        + (f'<div class="sample">예시: <i>“{e(s["sample"])}”</i> {say(s["sample"])}</div>' if s['sample'] else '')
        + '</div>' for s in l['scenarios'])

    dialogue = ''.join(
        f'<div class="line"><div class="who">{e(d["who"])}</div>'
        f'<div class="body"><div class="en" data-t="{e(d["en"])}">{e(d["en"])} {say(d["en"])}</div>'
        f'<div class="ko">{e(d["ko"])}</div></div></div>'
        for d in l['dialogue']['lines'])

    quiz = ''
    for qi, q in enumerate(l['quiz']):
        choices = ''.join(
            f'<label data-correct="{"true" if c["correct"] else "false"}">'
            f'<input type="radio" name="q{l["id"]}-{qi}"><span>{e(c["text"])}</span></label>'
            for c in q['choices'])
        quiz += (f'<div class="quiz-q"><div class="q">Q{qi+1}. {e(q["q"])}</div>'
                 f'<div class="quiz-choices">{choices}</div></div>')
    if not quiz:
        quiz = '<div class="small muted">이 레슨에는 퀴즈가 없습니다.</div>'

    checklist = ''.join(
        f'<li><label><input type="checkbox" data-ck="{ci}"><span>{e(c)}</span></label></li>'
        for ci, c in enumerate(l['checklist']))

    html_out = TPL.format(
        id=l['id'], pid=f"{l['id']:04d}", topic=e(l['topicKo']), emoji=e(l['emoji']),
        week=l['week'], day=l['day'], weektitle=e(l['weekTitle']),
        reviewbadge='<span class="badge">🔁 복습</span>' if l['review'] else '',
        goal=e(l['goal']), why=e(l['why']),
        nexp=len(l['expressions']), expressions=expressions,
        glossary=glossary, scenarios=scenarios, dialogue=dialogue,
        freetalk=e(l['freetalk']), quiz=quiz, checklist=checklist,
        mission=e(l['mission']), missionsay=say(l['mission']),
        nexthint=e(l['nextHint']),
        desc=e(f"{l['topicKo']} — {l['goal']}"),
        prev=(f'<a class="btn sm" href="{e(prev_l["filename"])}">← Lesson {prev_l["id"]:04d}</a>' if prev_l else '<a class="btn sm" href="../index.html">🏠 홈</a>'),
        next=(f'<a class="btn sm" href="{e(next_l["filename"])}">Lesson {next_l["id"]:04d} →</a>' if next_l else '<a class="btn sm" href="../index.html">🏠 처음으로</a>'),
    )
    open(os.path.join('lessons', l['filename']), 'w', encoding='utf-8').write(html_out)

print('built', len(L), 'lesson pages')
