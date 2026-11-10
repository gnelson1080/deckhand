// Deckhand service worker: the app works offline after the first visit.
// - App files (precached): cache first, refreshed in the background.
// - data/*.json: network first, cached copy when offline.
// - Card images: cache first, at most 400 kept.
const VERSION = '6b420939e2';
const SHELL = `deckhand-shell-${VERSION}`;
const DATA = 'deckhand-data';
const IMAGES = 'deckhand-images';
const MAX_IMAGES = 400;
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/app-icon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable.png',
  'assets/icon.svg',
  'content/deck-guides/OP09-062.json',
  'content/deck-guides/OP13-001.json',
  'content/deck-guides/OP13-004.json',
  'content/deck-guides/OP14-020.json',
  'content/deck-guides/ST30-001.json',
  'content/glossary.json',
  'content/lessons/01.json',
  'content/lessons/02.json',
  'content/lessons/03.json',
  'content/lessons/04.json',
  'content/lessons/05.json',
  'content/lessons/06.json',
  'content/lessons/07.json',
  'content/lessons/08.json',
  'content/lessons/09.json',
  'content/lessons/10.json',
  'content/lessons/11.json',
  'content/lessons/index.json',
  'css/base.css',
  'css/components.css',
  'css/motion.css',
  'css/tokens.css',
  'js/app.js',
  'js/data.js',
  'js/icons.js',
  'js/lib/board.js',
  'js/lib/deckstats.js',
  'js/lib/progress.js',
  'js/lib/quiz.js',
  'js/lib/scenarios.js',
  'js/lib/search.js',
  'js/router.js',
  'js/store.js',
  'js/ui/card-callout.js',
  'js/ui/charts.js',
  'js/ui/define.js',
  'js/ui/fx.js',
  'js/ui/miniboard.js',
  'js/ui/quiz.js',
  'js/ui/rich-text.js',
  'js/ui/sheet.js',
  'js/views/about.js',
  'js/views/card.js',
  'js/views/cards.js',
  'js/views/deck.js',
  'js/views/glossary.js',
  'js/views/learn.js',
  'js/views/lesson.js',
  'js/views/meta.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('deckhand-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin && url.pathname.includes('/data/')) {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(DATA).then(c => c.put(req, copy)); return res; })
      .catch(async () => (await caches.match(req)) || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  if (req.destination === 'image' && url.origin !== location.origin) {
    e.respondWith(caches.open(IMAGES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trim(IMAGES, MAX_IMAGES); }
      return res;
    }).catch(() => Response.error()));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
