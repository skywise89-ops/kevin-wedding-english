# -*- coding: utf-8 -*-
"""lessons.extracted.json + 한국어 해석/카테고리 → data/lessons.json (v2) + data/phrases.json"""
import json, re, unicodedata

CATS = [
  ("arrival",   "도착·첫인사",     "🚗"),
  ("rapport",   "스몰토크·라포",   "💬"),
  ("pose",      "포즈 디렉팅",     "🧍"),
  ("movement",  "동작·연출",       "🚶"),
  ("expression","표정·시선",       "😊"),
  ("micro",     "미세 조정",       "🎚️"),
  ("praise",    "칭찬·자신감",     "👏"),
  ("group",     "가족·단체",       "👨‍👩‍👧"),
  ("trouble",   "돌발 상황",       "🌧️"),
  ("recovery",  "못 알아들었을 때","🔁"),
  ("logistics", "이동·시간 안내",  "⏱️"),
  ("wrap",      "마무리·감사",     "🏁"),
  ("after",     "결과물·후기",     "📩"),
  ("culture",   "문화·배려",       "🌍"),
]

# EN -> (ko, category)
KO = {
"You made it! You both look amazing already.": ("오셨네요! 두 분 다 벌써 너무 멋져요.", "arrival"),
"Watch your step — let me get that door for you.": ("발밑 조심하세요 — 제가 문 잡아드릴게요.", "arrival"),
"I love the colour palette today.": ("오늘 색감 조합이 정말 좋네요.", "arrival"),
"How are you both feeling — excited, nervous, a bit of both?": ("두 분 지금 기분 어떠세요 — 설레세요, 긴장되세요, 아니면 둘 다요?", "arrival"),
"We've got a beautiful couple of hours ahead — let's start easy.": ("앞으로 두어 시간 좋은 시간 보낼 거예요 — 편한 것부터 시작할게요.", "arrival"),
"That lace detail on the sleeve is beautiful.": ("소매 레이스 디테일이 정말 예뻐요.", "rapport"),
"Did you choose the fabric, or was it a designer's pick?": ("원단은 직접 고르신 거예요, 아니면 디자이너가 골라준 거예요?", "rapport"),
"Where are you two headed for the honeymoon?": ("신혼여행은 어디로 가세요?", "rapport"),
"Oh, that's such a good choice — you'll love it.": ("오, 진짜 잘 고르셨어요 — 분명 좋아하실 거예요.", "rapport"),
"Speaking of travel — let's get a shot with that breeze.": ("여행 얘기 나온 김에 — 저 바람 부는 데서 한 컷 갈게요.", "rapport"),
"You're doing great — this already looks so natural.": ("정말 잘하고 계세요 — 벌써 아주 자연스러워요.", "praise"),
"There's no wrong way to do this, just relax.": ("여기엔 틀린 방법이 없어요, 편하게 하세요.", "praise"),
"Take a breath, drop your shoulders — perfect.": ("숨 한 번 쉬고, 어깨 툭 내려주세요 — 완벽해요.", "expression"),
"You can stop smiling like it's a passport photo.": ("여권 사진처럼 웃지 않으셔도 돼요.", "expression"),
"Let's try that again, even better this time.": ("한 번만 더 가볼게요, 이번엔 더 좋게.", "pose"),
"So how did you two actually meet?": ("그런데 두 분은 어떻게 만나셨어요?", "rapport"),
"That's such a good story — tell me more.": ("이야기 진짜 좋은데요 — 더 들려주세요.", "rapport"),
"What was your first impression of each other?": ("서로 첫인상은 어땠어요?", "rapport"),
"Look at him/her while you tell me that part.": ("그 얘기 하실 때 서로 바라보면서 해주세요.", "expression"),
"That smile right there — that's the one I wanted.": ("방금 그 미소 — 제가 원하던 게 딱 그거예요.", "praise"),
"Turn and face each other, just like that.": ("서로 마주 보세요, 딱 그렇게요.", "pose"),
"Hold hands, and let your arms relax.": ("손 잡으시고, 팔에 힘 빼주세요.", "pose"),
"Come a little closer to each other.": ("서로 조금만 더 가까이 와주세요.", "pose"),
"Angle your body slightly toward me.": ("몸을 저 쪽으로 살짝만 틀어주세요.", "pose"),
"Hold right there — that's it, don't move.": ("거기서 그대로 — 네 그거예요, 움직이지 마세요.", "pose"),
"Walk toward me slowly, nice and natural.": ("저를 향해 천천히 걸어오세요, 자연스럽게요.", "movement"),
"Can you walk back and do that one more time?": ("다시 뒤로 가서 한 번만 더 해주실 수 있을까요?", "movement"),
"Play with the bouquet a little, look down at it.": ("부케를 살짝 만지작거리면서 내려다봐 주세요.", "movement"),
"A bit slower this time, like you're not rushing.": ("이번엔 조금 더 천천히요, 서두르지 않는 느낌으로.", "movement"),
"On three, start walking — one, two, three.": ("셋 하면 걸어오세요 — 하나, 둘, 셋.", "movement"),
"Look at him, not at the camera.": ("카메라 말고 신랑분을 봐주세요.", "expression"),
"Think of something that makes you both laugh.": ("두 분이 같이 웃었던 일 하나 떠올려 보세요.", "expression"),
"Just look into each other's eyes for a second.": ("잠깐만 서로 눈을 마주 봐주세요.", "expression"),
"Soften your expression a little, more relaxed.": ("표정 조금만 풀어주세요, 더 편하게요.", "expression"),
"Right there, hold that look.": ("바로 거기요, 그 표정 유지해주세요.", "expression"),
"Tilt your chin down just a little.": ("턱만 아주 살짝 내려주세요.", "micro"),
"Look slightly to your left, just a touch.": ("시선만 왼쪽으로 아주 조금요.", "micro"),
"Shift your weight onto your back foot a bit.": ("무게 중심을 뒷발로 살짝 옮겨주세요.", "micro"),
"A tiny bit more — perfect, right there.": ("아주 조금만 더 — 완벽해요, 거기요.", "micro"),
"Not too much — just a fraction.": ("너무 많이는 말고 — 아주 살짝만요.", "micro"),
"Turn and face each other, hold hands.": ("서로 마주 보고, 손 잡아주세요.", "pose"),
"That angle you just found is perfect for you.": ("방금 나온 그 각도가 두 분한테 딱이에요.", "praise"),
"Your smile just now was so genuine.": ("방금 그 미소 정말 진짜 같았어요.", "praise"),
"The way you're holding the bouquet looks effortless.": ("부케 잡으신 모습이 아주 자연스러워요.", "praise"),
"You two work so well together in front of the camera.": ("두 분 카메라 앞에서 호흡이 정말 좋으세요.", "praise"),
"You're getting so much more comfortable already.": ("벌써 훨씬 편해지셨어요.", "praise"),
"It looks like it might rain — let's move to plan B.": ("비가 올 것 같은데 — 플랜 B로 옮길게요.", "trouble"),
"We can shift to the covered area and keep shooting.": ("지붕 있는 쪽으로 옮겨서 계속 찍으면 돼요.", "trouble"),
"We're running a little behind — let's speed through the next few shots.": ("일정이 조금 밀렸어요 — 다음 몇 컷은 빠르게 갈게요.", "trouble"),
"No stress — we'll still get everything we need.": ("걱정 마세요 — 필요한 건 다 담을 수 있어요.", "trouble"),
"Let's prioritise the shots you care about most.": ("두 분이 제일 중요하게 생각하는 컷부터 갈게요.", "trouble"),
"That sounds like a lot — I hear you.": ("많이 힘드셨겠어요 — 무슨 말씀인지 알아요.", "recovery"),
"Let's take a little break from that and focus on this moment.": ("그 얘긴 잠깐 접어두고, 지금 이 순간에 집중해볼까요.", "recovery"),
"Right now, it's just you two — let's enjoy this part.": ("지금은 두 분뿐이에요 — 이 시간 그냥 즐기세요.", "recovery"),
"Whatever happens later, today is about celebrating this.": ("나중 일이 어떻든, 오늘은 이걸 축하하는 날이에요.", "recovery"),
"Let's talk about something fun — favourite song from today's playlist?": ("재밌는 얘기 해봐요 — 오늘 플레이리스트 중에 제일 좋아하는 곡은요?", "rapport"),
"Sorry, could you say that one more time?": ("죄송해요, 한 번만 더 말씀해 주시겠어요?", "recovery"),
"Could you say that a little slower for me?": ("조금만 천천히 말씀해 주시겠어요?", "recovery"),
"Sorry, could you say that a little slower for me?": ("죄송해요, 조금만 천천히 말씀해 주시겠어요?", "recovery"),
"Just to make sure — did you mean the garden or the beach?": ("확인차 여쭤볼게요 — 정원 말씀이세요, 해변 말씀이세요?", "recovery"),
"Sorry, what I meant to say was...": ("죄송해요, 제가 말하려던 건요…", "recovery"),
"Got it, that makes sense now — thank you.": ("아 이해했어요, 이제 알겠네요 — 감사합니다.", "recovery"),
"That's a wrap — you two did amazing today.": ("오늘 촬영 끝났습니다 — 두 분 정말 잘해주셨어요.", "wrap"),
"My favourite moment was when you both laughed by the fountain.": ("오늘 제일 좋았던 순간은 분수대 앞에서 두 분이 같이 웃던 때예요.", "wrap"),
"I'll send a few previews within a couple of days.": ("이삼 일 안에 미리보기 몇 장 보내드릴게요.", "wrap"),
"Thank you for trusting me with your day.": ("오늘 하루를 저에게 맡겨주셔서 감사합니다.", "wrap"),
"I hope today felt as special as it looked.": ("오늘이 보이는 만큼이나 특별하게 느껴지셨길 바라요.", "wrap"),
"Your gallery is ready — I've linked it below.": ("갤러리 준비됐어요 — 아래 링크 넣어드렸습니다.", "after"),
"Let me know what you think once you've had a look.": ("보시고 어떠신지 알려주세요.", "after"),
"Do these capture the day the way you imagined?": ("생각하셨던 그날의 느낌이 잘 담겼나요?", "after"),
"If you loved them, a short review would mean a lot to me.": ("마음에 드셨다면 짧은 후기 하나 남겨주시면 정말 큰 힘이 돼요.", "after"),
"If there's anything you'd like adjusted, just let me know.": ("수정하고 싶으신 부분 있으면 편하게 말씀해 주세요.", "after"),
"Are you comfortable with closer poses, or would you prefer more space?": ("가까운 포즈도 괜찮으세요, 아니면 조금 떨어진 게 편하세요?", "culture"),
"Is there a tradition from your culture you'd like us to capture?": ("두 분 문화에서 꼭 담고 싶은 전통이 있을까요?", "culture"),
"How would you like me to refer to you both in photos — first names is fine?": ("사진에서 두 분을 어떻게 불러드리면 될까요 — 이름으로 불러도 괜찮을까요?", "culture"),
"Just let me know if anything feels uncomfortable, and we'll adjust.": ("불편한 게 있으면 언제든 말씀해 주세요, 바로 조정할게요.", "culture"),
"I love learning about different wedding traditions — tell me more.": ("다양한 결혼 문화 배우는 걸 좋아해요 — 더 얘기해 주세요.", "culture"),
"You made it! How are you feeling today?": ("오셨네요! 오늘 기분 어떠세요?", "arrival"),
"Turn and face each other, hold right there.": ("서로 마주 보시고, 거기서 그대로요.", "pose"),
"That was such a genuine smile.": ("방금 그거 진짜 진심 어린 미소였어요.", "praise"),
"No stress — we'll figure it out together.": ("걱정 마세요 — 같이 해결하면 돼요.", "trouble"),
}

# 현장 전용 추가 표현 (레슨엔 없지만 실제 촬영에서 반드시 필요한 것)
FIELD = [
 ("arrival","자기소개","Hi! I'm Kevin — I'll be your photographer today.","안녕하세요, 오늘 촬영 맡은 케빈입니다."),
 ("arrival","첫 대면","So nice to finally meet you in person.","이렇게 직접 뵙게 되어 반갑습니다."),
 ("arrival","여유 주기","Take your time — we're not in a rush at all.","천천히 하세요, 전혀 급하지 않아요."),
 ("arrival","배려","Can I get you some water before we start?","시작하기 전에 물 좀 갖다 드릴까요?"),
 ("arrival","동선 안내","We'll start right here, then move to the garden.","여기서 시작해서 정원으로 이동할게요."),
 ("logistics","시간 안내","We have about thirty minutes left.","30분 정도 남았어요."),
 ("logistics","이동 확인","It's a five-minute walk — is that okay in those shoes?","5분 정도 걸어야 하는데, 그 신발로 괜찮으세요?"),
 ("logistics","빛 활용","Let's use this light while we have it.","빛 좋을 때 여기서 찍고 갈게요."),
 ("logistics","추가 장소 제안","Do you mind if we do one more spot? It's just around the corner.","한 곳만 더 가도 될까요? 바로 근처예요."),
 ("logistics","소품 부탁","Could you hold this for a second?","이것 좀 잠깐 들어주시겠어요?"),
 ("logistics","부케 맡기기","Can someone hold the bouquet for a moment?","혹시 부케 잠깐 들어주실 분 계실까요?"),
 ("logistics","순서 안내","Two more here, then we'll head inside.","여기서 두 컷만 더 찍고 안으로 들어갈게요."),
 ("pose","접촉 동의","Is it okay if I adjust your collar?","깃 좀 정리해 드려도 될까요?"),
 ("pose","드레스 정리","I'll just fix the back of your dress — is that alright?","드레스 뒷자락만 정리할게요, 괜찮으실까요?"),
 ("pose","기본 자세","Chin up a touch, shoulders back.","턱 살짝 들고, 어깨 뒤로요."),
 ("pose","손 힘 빼기","Relax your hands — soft fingers, don't grip.","손에 힘 빼주세요 — 부드럽게, 꽉 쥐지 마시고요."),
 ("pose","발 위치","Step in with your left foot.","왼발을 한 발짝 앞으로 내주세요."),
 ("pose","호흡","Big breath in… and out. Perfect.","숨 크게 들이쉬고… 내쉬고. 좋아요."),
 ("pose","이마 맞대기","Foreheads together, close your eyes.","이마 맞대시고, 눈 감아주세요."),
 ("pose","이마 키스","Give her a little kiss on the forehead.","이마에 살짝 입맞춤해 주세요."),
 ("movement","속삭이기","Whisper something only she can hear.","신부분만 들리게 뭔가 속삭여 주세요."),
 ("movement","포옹 연출","Walk in and hug her like you haven't seen her all day.","걸어가서, 하루 종일 못 본 사람처럼 안아주세요."),
 ("movement","제자리 유지","Stay there, I'm just moving around you.","그대로 계세요, 제가 돌면서 찍을게요."),
 ("expression","웃음 유도","Laugh at how awkward this is — that's allowed.","어색한 게 웃기면 그냥 웃으셔도 돼요."),
 ("expression","시선 전환","Don't look at me — look at each other.","저 말고 서로를 봐주세요."),
 ("expression","카메라 응시","Eyes to me… now.","이제 저를 봐주세요… 지금이요."),
 ("group","가족 호출","Could we get the immediate family for the next one?","다음 컷은 직계 가족분들 모셔도 될까요?"),
 ("group","간격 좁히기","Everyone squeeze in — closer than feels normal.","다들 조금씩 붙어주세요 — 생각보다 더 가까이요."),
 ("group","줄 정리","Back row, one step to your left please.","뒷줄, 왼쪽으로 한 걸음만 이동해 주세요."),
 ("group","시선 통일","Everyone look at my hand, not the phones.","다들 휴대폰 말고 제 손을 봐주세요."),
 ("group","단체 마무리","Perfect — one more, in case someone blinked.","좋습니다 — 눈 감으신 분 있을 수 있으니 한 장만 더요."),
 ("group","리스트 확인","Who else do we need a photo with? Let's do those first.","같이 찍어야 할 분 더 계실까요? 그것부터 할게요."),
 ("trouble","비 대기","Let's give it five minutes and see if the rain passes.","5분만 기다려 보고 비가 그치는지 볼게요."),
 ("trouble","빛 부족","The light's going fast — let's grab the two shots that matter most.","해가 빨리 지고 있어요 — 제일 중요한 두 컷만 먼저 갈게요."),
 ("trouble","기다림","Whenever you're ready, no rush at all.","준비되시면 말씀하세요, 전혀 급하지 않아요."),
 ("trouble","문제 없음","No problem at all — that happens all the time.","전혀 문제없어요, 흔히 있는 일이에요."),
 ("recovery","영어 양해","Sorry, my English isn't perfect — could you say that differently?","제가 영어가 완벽하진 않아서요 — 다르게 한 번만 말씀해 주시겠어요?"),
 ("recovery","의미 확인","Do you mean the first location or the second one?","첫 번째 장소 말씀이세요, 두 번째 말씀이세요?"),
 ("recovery","적어달라 요청","Could you type it for me? Just to be sure.","혹시 적어주실 수 있을까요? 확실히 하려고요."),
 ("recovery","요약 확인","Let me make sure I understood — you'd like more family photos, right?","제가 제대로 이해했는지 확인할게요 — 가족 사진을 더 원하신다는 거죠?"),
 ("wrap","마지막 확인","That's everything on my list — anything you'd like before we finish?","제 리스트는 다 끝났어요 — 마치기 전에 더 원하시는 거 있을까요?"),
 ("wrap","작별 인사","Enjoy the rest of your day — it's been a real pleasure.","남은 하루도 즐겁게 보내세요 — 정말 즐거웠습니다."),
 ("wrap","축하 인사","Congratulations again — seriously, you two were great.","다시 한번 축하드려요 — 진심으로 두 분 정말 좋았어요."),
 ("after","일정 안내","You'll get the full gallery in about three weeks.","전체 갤러리는 3주쯤 뒤에 받아보실 거예요."),
 ("after","공유 요청","Feel free to share them — a tag would be lovely.","마음껏 공유하셔도 돼요 — 태그해 주시면 더 좋고요."),
 ("praise","확정 칭찬","That was perfect — don't change a thing.","방금 완벽했어요 — 그대로 계세요."),
 ("praise","전체 칭찬","You two are naturals in front of the camera.","두 분 카메라 앞에서 타고나셨어요."),
 ("culture","필수 인물 확인","Please tell me if there's anyone I must not miss in the photos.","사진에 꼭 들어가야 할 분이 있으면 미리 말씀해 주세요."),
]

def norm(s):
    return unicodedata.normalize('NFKC', s).strip()

lessons = json.load(open('data/lessons.extracted.json', encoding='utf-8'))

missing = []
for l in lessons:
    for e in l['expressions']:
        hit = KO.get(e['en'])
        if not hit:
            missing.append(e['en']); continue
        e['ko'], e['cat'] = hit
if missing:
    print('MISSING KO:'); [print(' ', m) for m in missing]; raise SystemExit(1)

json.dump(lessons, open('data/lessons.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)

# ---- phrases.json ----
def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip('-')
    return s[:48]

seen = {}
phrases = []
for l in lessons:
    for e in l['expressions']:
        key = slug(e['en'])
        if key in seen:
            seen[key]['lessons'].append(l['id'])
            continue
        p = {'id': key, 'en': e['en'], 'ko': e['ko'], 'cat': e['cat'],
             'situation': re.sub(r'\s*\(Day\d+\)|\s*표현 예시|\s*대표 표현', '', e['situation']).strip() or e['situation'],
             'nuance': e['nuance'], 'lessons': [l['id']], 'src': 'lesson'}
        seen[key] = p
        phrases.append(p)

for cat, sit, en, ko in FIELD:
    key = slug(en)
    if key in seen: continue
    p = {'id': key, 'en': en, 'ko': ko, 'cat': cat, 'situation': sit,
         'nuance': '', 'lessons': [], 'src': 'field'}
    seen[key] = p; phrases.append(p)

order = {c[0]: i for i, c in enumerate(CATS)}
phrases.sort(key=lambda p: (order[p['cat']], p['src'] != 'lesson'))

out = {'categories': [{'id': c, 'label': l, 'emoji': e} for c, l, e in CATS], 'phrases': phrases}
json.dump(out, open('data/phrases.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)

from collections import Counter
cnt = Counter(p['cat'] for p in phrases)
print('phrases:', len(phrases))
for c, l, e in CATS: print(f'  {l:14s} {cnt[c]}')
