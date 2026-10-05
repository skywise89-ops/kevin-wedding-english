"""Generate the offline scene guide from canonical phrases, without copying text."""
import html
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
scenes = json.loads((root / 'data/scenes.json').read_text())['scenes']
phrases = {p['id']: p for p in json.loads((root / 'data/phrases.json').read_text())['phrases']}
lessons = {l['id']: l for l in json.loads((root / 'data/lessons.json').read_text())}
e = lambda text: html.escape(str(text), quote=True)
groups = [('couple', '둘만의 자연스러운 순간'), ('friends', '친구들과 즐겁게'), ('family', '가족과 편안하게')]
sections = []
for group, title in groups:
    cards = []
    for s in (s for s in scenes if s['group'] == group):
        lines = []
        for i, pid in enumerate(s['phrases']):
            p = phrases[pid]
            lines.append(f'''<li class="scene-line" data-phrase-id="{e(pid)}"><span class="sit">{i+1}번째 말</span>
<p class="en" lang="en">{e(p['en'])}</p><p class="ko">{e(p['ko'])}</p>
<div class="sentence-actions"><button class="speak" type="button" data-say="{e(p['en'])}" aria-label="발음 재생: {e(p['en'])}" data-icon="sound"></button><button class="lesson-save" type="button" data-moment-save="{e(pid)}" aria-pressed="false" aria-label="문장 저장: {e(p['en'])}"><i data-icon="star"></i><span>저장</span></button></div></li>''')
        cards.append(f'''<details class="scene-card" id="{e(s['id'])}"><summary><span>{e(s['title'])}<small>{len(s['phrases'])}개의 말 · 순서대로 꺼내 쓰기</small></span></summary>
<div class="scene-body"><ol class="scene-lines">{''.join(lines)}</ol>
<details class="phrase-detail"><summary>쓰는 순간과 배려</summary><p>{e(s['note'])}</p></details>
<div class="scene-actions"><button class="btn primary block" type="button" data-scene-kit="{e(s['id'])}"><i data-icon="kit"></i><span>촬영 준비에 담기</span></button><a class="btn block" href="lessons/{e(lessons[s['lesson']]['filename'])}">이 상황 말하기 연습<span data-icon="arrow"></span></a></div></div></details>''')
    sections.append(f'<section class="scene-group" aria-labelledby="{group}-heading"><h2 id="{group}-heading">{title}</h2>{"".join(cards)}</section>')

data = json.dumps({s['id']: s['phrases'] for s in scenes}, ensure_ascii=False).replace('<', '\\u003c')
page = f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f6f5f0"><meta name="description" content="질문과 작은 동작으로 자연스러운 웨딩 촬영 분위기를 만드는 10가지 상황"><title>분위기 만들기 · Wedding English</title><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="assets/favicon-v3.ico"><link rel="apple-touch-icon" href="assets/icon-180-v3.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Wedding English"><link rel="stylesheet" href="assets/style.css"></head><body>
<a class="skip" href="#main">본문으로 건너뛰기</a><header class="top"><a class="brand" href="index.html"><img src="assets/icon-v3.svg" width="36" height="36" alt=""><span>Wedding English<small>FOR THE MOMENT</small></span></a><div class="hdr-actions"><button class="iconbtn" type="button" data-settings aria-label="설정" data-icon="settings"></button></div></header>
<main id="main" class="wrap moments-wrap"><div class="page-heading"><div><span class="eyebrow">MAKE THE MOMENT</span><h1>분위기 만들기</h1></div></div><p class="scene-intro">상황 하나, 질문 하나.<br>말을 건넨 뒤 대답과 표정을 기다리세요.</p>
<nav class="chips scene-jumps" aria-label="촬영 분위기 선택"><a class="chip" href="#couple-heading">신랑신부</a><a class="chip" href="#friends-heading">친구들</a><a class="chip" href="#family-heading">가족·틈새 순간</a></nav>
<a class="kit-entry" href="field.html#scope=kit"><span data-icon="kit"></span><div><h3>이번 촬영 준비 <span id="moment-kit-count">0 / 24</span></h3><p>모은 말 확인 · 순서 정리 · 현장에서 꺼내기</p></div><span data-icon="arrow"></span></a>
{''.join(sections)}
<a class="btn block" href="field.html">다른 현장 표현 찾기<span data-icon="search"></span></a></main>
<footer><p data-offline role="status">오프라인 준비 상태 확인 중</p><span>표현은 현장에, 기록은 이 기기에.</span></footer>
<script src="assets/model.js"></script><script src="assets/core.js"></script><script type="application/json" id="moment-scenes">{data}</script><script src="assets/scene-release.js"></script></body></html>
'''
(root / 'moments.html').write_text(page)
print(f'Built {len(scenes)} scene guides.')
