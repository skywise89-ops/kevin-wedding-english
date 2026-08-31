/* Kevin's Wedding English — service worker (오프라인 지원) */
const VERSION = 'kwe-v2.0.0';
const ASSETS = [
  "./",
  "index.html",
  "field.html",
  "practice.html",
  "assets/style.css",
  "assets/core.js",
  "assets/home.js",
  "assets/field.js",
  "assets/practice.js",
  "assets/lesson.js",
  "assets/icon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-180.png",
  "assets/icon-maskable-512.png",
  "manifest.webmanifest",
  "data/lessons.json",
  "data/phrases.json",
  "lessons/0001-arrival-greeting-car-exit.html",
  "lessons/0002-small-talk-dress-honeymoon.html",
  "lessons/0003-breaking-the-ice-reassurance.html",
  "lessons/0004-getting-to-know-the-couple.html",
  "lessons/0005-week-1-review-roleplay.html",
  "lessons/0006-basic-pose-direction.html",
  "lessons/0007-directing-movement-sequences.html",
  "lessons/0008-directing-expressions-eye-contact.html",
  "lessons/0009-micro-adjustment-direction.html",
  "lessons/0010-week-2-review-roleplay.html",
  "lessons/0011-specific-compliments.html",
  "lessons/0012-handling-unexpected-situations.html",
  "lessons/0013-redirecting-heavy-conversations.html",
  "lessons/0014-recovery-strategies.html",
  "lessons/0015-week-3-review-roleplay.html",
  "lessons/0016-wrap-up-thank-you.html",
  "lessons/0017-following-up-on-deliverables.html",
  "lessons/0018-cross-cultural-client-communication.html",
  "lessons/0019-comprehensive-freetalk.html",
  "lessons/0020-4-week-comprehensive-roleplay-self-asses.html"
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ASSETS.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 데이터는 네트워크 우선(최신 레슨 반영), 실패 시 캐시
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // 나머지는 캐시 우선 + 백그라운드 갱신
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit || caches.match('index.html'));
      return hit || net;
    })
  );
});
