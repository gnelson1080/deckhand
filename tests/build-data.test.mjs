import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildData } from '../scripts/fetch-data.mjs';

const fx = n => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const pages = {
  '/decks': fx('limitless-decks.html'),
  '/cards/': fx('limitless-card.html'),
  '/decks/list/': fx('limitless-list.html'),
  '/decks/': fx('limitless-archetype.html'),
};
const fakeText = async url => {
  const path = new URL(url).pathname;
  if (path === '/decks') return pages['/decks'];
  for (const k of ['/cards/', '/decks/list/', '/decks/']) if (path.startsWith(k)) return pages[k];
  throw new Error('unexpected ' + url);
};
const fakeJSON = async url => url.includes('tcgplayer') ? (() => { throw new Error('tcg down'); })() : url.includes('allSTCards') ? JSON.parse(fx('optcg-st.json')) : JSON.parse(fx('optcg-set.json'));
const opts = extra => ({ fetchText: fakeText, fetchJSON: fakeJSON, delayMs: 0, maxDecks: 2, listsPerDeck: 1, log: () => {}, ...extra });

test('falls back to Limitless meta when TCGplayer fails; missing card filled from Limitless page', async () => {
  const { cards, meta } = await buildData(opts());
  const ids = new Set(cards.map(c => c.id));
  assert.equal(meta.decks.length, 2);
  const listIds = meta.decks[0].lists[0].cards.map(c => c.id);
  for (const id of listIds) assert.ok(ids.has(id), `missing ${id}`);
  const filled = cards.find(c => c.id === 'OP14-102');
  assert.equal(filled.name, 'Nami');
  assert.ok(filled.img);
  assert.equal(meta.format, 'OP16');
});

test('a failing card source keeps the previous cards', async () => {
  const prev = { cards: [{ id: 'X-1', name: 'Old' }], meta: null };
  const { cards, updated } = await buildData(opts({ fetchJSON: async () => { throw new Error('down'); }, prev, prevUpdated: { cards: '2026-01-01' } }));
  assert.ok(cards.some(c => c.id === 'X-1'));
  assert.equal(updated.cards, '2026-01-01');
});

test('a failing meta source keeps the previous meta', async () => {
  const prevMeta = { format: 'OLD', decks: [] };
  const { meta } = await buildData(opts({ fetchText: async () => { throw new Error('down'); }, prev: { cards: [], meta: prevMeta } }));
  assert.equal(meta.format, 'OLD');
});

const tcgIndex = JSON.parse(fx('tcg-decks.json'));
const tcgDeck = JSON.parse(fx('tcg-deck.json'));
const tcgJSON = async url => {
  if (url.includes('/content/decks/')) return new URL(url).searchParams.get('offset') === '0' ? tcgIndex : { result: [] };
  if (url.includes('/deck/one%20piece/')) return tcgDeck;
  return fakeJSON(url);
};

test('TCGplayer is the primary meta source and adds product links + missing cards', async () => {
  const { cards, meta } = await buildData(opts({ fetchJSON: tcgJSON, fetchText: async () => { throw new Error('limitless should not be needed for meta'); } }));
  assert.equal(meta.source, 'TCGplayer');
  assert.equal(meta.decks[0].leaderId, 'OP13-001');
  assert.deepEqual(meta.decks[0].colors, ['Green', 'Red']);
  const byId = new Map(cards.map(c => [c.id, c]));
  for (const l of meta.decks[0].lists) for (const c of l.cards) assert.ok(byId.has(c.id), `missing ${c.id}`);
  assert.match(byId.get('OP13-001').tcgUrl, /tcgplayer\.com\/product\//);
});

test('optcgapi card data is kept when TCGplayer is also present', async () => {
  const { cards } = await buildData(opts({ fetchJSON: tcgJSON, fetchText: async () => { throw new Error('x'); } }));
  const perona = cards.find(c => c.id === 'OP01-077');
  assert.equal(perona.name, 'Perona');
  assert.match(perona.img, /optcgapi/);
});
