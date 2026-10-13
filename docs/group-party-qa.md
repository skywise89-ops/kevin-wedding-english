# Group layout and party directing — v3.6.0

Verified: 2026-10-13 KST. Adds four back-row face-visibility cues and twelve party prompts, with five ordered situation guides. Total: 178 field expressions, 15 guides, 26 lessons.

- Family/group lesson 21 includes face visibility, individual positioning, situation recall, dialogue and an additional quiz. The original six expressions and existing quiz/checklist indices remain intact.
- New supplemental lesson 26 covers uninterrupted dancing, copying a friend's dance move, a one-second group pose and cheering around the couple. It includes six core expressions, four situations, the twelve-line dialogue, quiz and recall prompts.
- Home/field link to the situation guide. Korean queries such as `뒷줄`, `사이사이`, `얼굴 가려`, `춤 멈추지마`, `시그니처 댄스` and `파티 포즈` return relevant directing lines. The primary back-row cue also has short and polite variants.
- All prior 162 phrase records and 14 categories compare equal to v3.5.1. All prior 25 lesson URLs and 10 situation sequences are retained. Existing lessons except the deliberately expanded lesson 21 compare equal at the data level. Storage, sync, review and voice code are unchanged.
- `npm test`: 44 checks passed, including search relevance, shared canonical saves and existing data protections.
- `npm run test:browser`: 361 assertions passed across Chromium and WebKit. New cues are searchable offline, can be saved and prepared as an ordered collection, and share saved state with lessons 21/26. Existing search, speech-control state, learning, backup, themes, layouts and atomic service-worker updates passed. Normal flows had no JavaScript errors or failed resource requests.
- Build includes 63 hashed offline assets. The added lesson uses the existing GitHub Pages relative paths and worker update flow.

Browser testing used desktop engines with mobile viewports. Physical iPhone Safari/PWA, VoiceOver and real speech-engine behavior were not tested. Speech-control tests use simulated synthesis callbacks. The prior limitation verifying public-page access to the private Mac mini API remains; this content update does not change that connection.

Local evidence (ignored in Git): `artifacts/unit-results.txt`, `artifacts/browser-results.json`, `artifacts/group-party-content-check.json`, `artifacts/group-back-row-gaps-webkit.png`, `artifacts/party-keep-dancing-webkit.png`, `artifacts/party-group-pose-webkit.png`. Deployment bytes and outcome are recorded after publishing.
