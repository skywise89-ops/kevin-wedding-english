# Extended kiss and cheering directing — v3.7.0

Verified: 2026-10-16 KST.

Adds **가까이서 키스·오래오래 환호하기** as an eight-line situation guide. It reuses the existing couple-readiness and kiss-cheering IDs and adds six canonical expressions: announcing the kiss, a playful last-chance line, shouting/hands-up, kissing until cheering stops, a long cheer, and the actual start cue. Instructions finish before the start cue. The use note describes a playful setup agreed with the couple, with the kiss ending at their comfortable length.

The original short kiss-cheering guide remains. Lesson 24 retains its six core expressions and adds the new scenario, full dialogue, glossary, quiz and checklist item. Existing quiz/checklist indices are preserved. New cues can be found with `가까이서 키스`, `마지막 기회`, `소리 질러도`, `환호 멈출 때까지`, `오래오래 환호` and `키스 시작`.

- `npm test`: 45 checks passed.
- `npm run test:browser`: 377 assertions passed across desktop Chromium and WebKit with mobile viewports. The eight-line routine fits an offline kit containing prior shared expressions without duplicates, preserving the 24-item limit. The new line saves to the same ID in field and lesson 24, synthesis receives the apostrophe correctly and exposes playing state, and the appended quiz preserves prior answers and completed progress. Layout checks include 320px. Normal flows had no JavaScript errors or failed resource requests.
- All prior **178 phrase records**, **15 scene records**, **26 lesson URLs** and 14 categories compare equal or remain present. Lesson 24's existing core expressions, mission, dialogue prefix and quiz/checklist indices are unchanged. Other lesson records compare equal.
- Total: **184 field expressions**, **16 situation guides**, **47 unique situation expressions** (49 displayed lines, including two shared IDs), **26 lessons**, **63 hashed offline assets**.
- Storage, sync, speech implementation, service-worker template, dependencies and icons are unchanged.

Physical iPhone Safari/PWA, VoiceOver and real device speech were not tested. Synthesis-state tests use simulated callbacks. No new claim is made about the prior private Mac mini connection limitation.

Ignored local evidence: `artifacts/kiss-long-unit-results.txt`, `artifacts/browser-results.json`, `artifacts/kiss-long-content-check.json`, `artifacts/kiss-long-start-webkit.png`, `artifacts/kiss-long-cheer-webkit.png`. Public deployment and byte verification are recorded separately after publishing.
