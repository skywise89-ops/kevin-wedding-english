import json, re, os, glob
from bs4 import BeautifulSoup

def txt(el):
    return re.sub(r'\s+', ' ', el.get_text(' ', strip=True)).strip()

lessons = []
for path in sorted(glob.glob('lessons/*.html')):
    soup = BeautifulSoup(open(path, encoding='utf-8').read(), 'html.parser')
    fn = os.path.basename(path)
    lid = int(fn[:4])
    badges = [txt(b) for b in soup.select('.badge')]
    m = re.search(r'Week (\d+) · Day (\d+)', badges[0])
    week, day = int(m.group(1)), int(m.group(2))
    weekTitle = badges[1]
    h1 = txt(soup.select_one('h1'))
    m2 = re.match(r'^(\S+)\s+Lesson \d+ — (.+)$', h1)
    emoji, topicKo = m2.group(1), m2.group(2)
    goal = txt(soup.select_one('.wrap > .next'))
    goal = re.sub(r'^오늘 목표:\s*', '', goal)

    # section map by h2
    sections = {}
    for h2 in soup.select('h2'):
        key = txt(h2)
        sib = []
        for n in h2.next_siblings:
            if getattr(n, 'name', None) == 'h2': break
            if getattr(n, 'name', None): sib.append(n)
        sections[key] = sib

    def sec(keyfrag):
        for k, v in sections.items():
            if keyfrag in k: return v
        return []

    why = txt(sec('왜 이 표현')[0]) if sec('왜 이 표현') else ''

    expressions = []
    exp_sec = sec('핵심 표현')
    if exp_sec:
        for tr in exp_sec[0].select('tr')[1:]:
            tds = tr.select('td')
            if len(tds) == 3:
                expressions.append({'situation': txt(tds[0]), 'en': txt(tds[1]), 'nuance': txt(tds[2])})

    glossary = []
    for g in (sec('용어')[0].select('.gloss') if sec('용어') else []):
        glossary.append({'term': txt(g.select_one('b')), 'def': txt(g.select_one('span'))})

    scenarios = []
    for s in sec('시나리오'):
        if 'scn' in (s.get('class') or []):
            p = txt(s.select_one('.prompt')).lstrip('▶ ').strip()
            sm = s.select_one('.sample')
            sample = txt(sm) if sm else ''
            sample = re.sub(r'^예시:\s*', '', sample).strip('"“”')
            scenarios.append({'prompt': p, 'sample': sample})

    dialogue = {'title': '', 'lines': []}
    for k in sections:
        if k.startswith('💬'):
            dialogue['title'] = k.split('—', 1)[1].strip() if '—' in k else ''
    dsec = sec('대화')
    if dsec:
        for ln in dsec[0].select('.line'):
            dialogue['lines'].append({
                'who': txt(ln.select_one('.who')),
                'en': txt(ln.select_one('.en')),
                'ko': txt(ln.select_one('.ko')),
            })

    freetalk = txt(sec('프리토킹')[0]) if sec('프리토킹') else ''

    quiz = []
    qsec = sec('퀴즈')
    if qsec:
        for q in qsec[0].select('.quiz-q'):
            qtext = txt(q.select_one('div'))
            qtext = re.sub(r'^Q\d+\.\s*', '', qtext)
            choices = []
            for lab in q.select('.quiz-choices label'):
                choices.append({'text': txt(lab), 'correct': lab.get('data-correct') == 'true'})
            quiz.append({'q': qtext, 'choices': choices})

    checklist = [txt(li) for li in (sec('자기 평가')[0].select('li') if sec('자기 평가') else [])]

    mission = ''
    mel = soup.select_one('.mission')
    if mel:
        i = mel.select_one('i')
        mission = txt(i).strip('"“”') if i else ''

    nexthint = ''
    for p in soup.select('p.next'):
        nexthint = re.sub(r'^➡️ 다음 레슨 예고:\s*', '', txt(p))

    title = txt(soup.select_one('title'))
    topicEn = ''

    lessons.append({
        'id': lid, 'week': week, 'day': day, 'weekTitle': weekTitle,
        'topicKo': topicKo, 'topicEn': topicEn, 'emoji': emoji, 'filename': fn,
        'review': 'review' in fn or '복습' in topicKo or '종합' in topicKo,
        'goal': goal, 'why': why,
        'expressions': expressions, 'glossary': glossary, 'scenarios': scenarios,
        'dialogue': dialogue, 'freetalk': freetalk, 'quiz': quiz,
        'checklist': checklist, 'mission': mission, 'nextHint': nexthint,
    })

# merge topicEn from old json
old = {l['id']: l for l in json.load(open('data/lessons.json', encoding='utf-8'))}
for l in lessons:
    l['topicEn'] = old.get(l['id'], {}).get('topicEn', '')

json.dump(lessons, open('data/lessons.extracted.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)
print('lessons:', len(lessons))
print('expressions:', sum(len(l['expressions']) for l in lessons))
print('quiz Qs:', sum(len(l['quiz']) for l in lessons))
print('dialogue lines:', sum(len(l['dialogue']['lines']) for l in lessons))
print('scenarios:', sum(len(l['scenarios']) for l in lessons))
print('glossary:', sum(len(l['glossary']) for l in lessons))
for l in lessons:
    miss = [k for k in ['goal','why','freetalk','mission','nextHint'] if not l[k]]
    if miss or not l['expressions'] or not l['quiz']: print('  ! id',l['id'],miss, len(l['expressions']), len(l['quiz']))
