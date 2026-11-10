// Deckhand service worker: the app works offline after the first visit.
// - App files (precached): cache first, refreshed in the background.
// - data/*.json: network first, cached copy when offline.
// - Card images: cache first, at most 400 kept.
const VERSION = 'c8dd1db235';
const SHELL = `deckhand-shell-${VERSION}`;
const DATA = 'deckhand-data';
const IMAGES = 'deckhand-images';
const MAX_IMAGES = 400;
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/app-icon.svg',
  'assets/fonts/alfa-slab-one-400.woff2',
  'assets/fonts/atkinson-hyperlegible-400-italic.woff2',
  'assets/fonts/atkinson-hyperlegible-400.woff2',
  'assets/fonts/atkinson-hyperlegible-700.woff2',
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
  'css/fonts.css',
  'css/motion.css',
  'css/tokens.css',
  'js/app.js',
  'js/data.js',
  'js/game/ai.js',
  'js/game/cards/index.js',
  'js/game/effects.js',
  'js/game/engine.js',
  'js/game/pool-data.js',
  'js/game/rng.js',
  'js/icons.js',
  'js/lib/backup.js',
  'js/lib/board.js',
  'js/lib/deck.js',
  'js/lib/decks-store.js',
  'js/lib/deckstats.js',
  'js/lib/price-series.js',
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
  'js/ui/price-chart.js',
  'js/ui/quiz.js',
  'js/ui/rich-text.js',
  'js/ui/sheet.js',
  'js/views/about.js',
  'js/views/build.js',
  'js/views/card.js',
  'js/views/cards.js',
  'js/views/deck.js',
  'js/views/decks.js',
  'js/views/glossary.js',
  'js/views/learn.js',
  'js/views/lesson.js',
  'js/views/meta.js'
];

// Only cache real, successful answers of the expected kind. Captive-portal login pages,
// errors and redirects must never replace a good cached copy.
function cacheable(res, kind, url = '') {
  if (!res || !res.ok || res.redirected || res.type === 'opaque') return false;
  const type = (res.headers && res.headers.get && res.headers.get('Content-Type')) || '';
  if (kind === 'data') return type.includes('json');
  if (kind === 'shell') {
    const path = new URL(url || 'https://x/', 'https://x/').pathname;
    const isPage = path.endsWith('/') || path.endsWith('.html');
    return isPage || !type.includes('text/html');
  }
  if (kind === 'image') return type.startsWith('image/');
  if (kind === 'font') return true;
  return false;
}

// Try the network, but answer from the cache if it takes longer than `ms` or fails.
function networkFirst(getNetwork, getCached, ms = 3500) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(async () => finish(await getCached()), ms);
    getNetwork().then(r => { clearTimeout(timer); finish(r); })
      .catch(async () => { clearTimeout(timer); finish((await getCached()) || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } })); });
  });
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('deckhand-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
const put = (name, req, res) => caches.open(name).then(c => c.put(req, res)).catch(() => {});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin && url.pathname.includes('/data/')) {
    e.respondWith(networkFirst(
      () => fetch(req).then(res => { if (cacheable(res, 'data')) put(DATA, req, res.clone()); return res; }),
      () => caches.match(req),
    ));
    return;
  }
  if (req.destination === 'image' && url.origin !== location.origin) {
    e.respondWith(caches.open(IMAGES).then(async c => {
      const hit = await c.match(req.url);
      if (hit) return hit;
      // Ask for a CORS copy (TCGplayer's CDN allows it) so the cached size is real, not padded.
      let res;
      try { res = await fetch(new Request(req.url, { mode: 'cors', credentials: 'omit' })); } catch { res = null; }
      if (res && cacheable(res, 'image')) { put(IMAGES, req.url, res.clone()).then(() => trim(IMAGES, MAX_IMAGES)); return res; }
      return fetch(req);
    }).catch(() => fetch(req)));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => { if (cacheable(res, 'shell', req.url)) put(SHELL, req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
