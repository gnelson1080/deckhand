import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchCards, thumb } from '../js/lib/search.js';

const cards = JSON.parse(readFileSync(new URL('../data/cards.json', import.meta.url), 'utf8'));

test('name search is case-insensitive and finds Nami leader', () => {
  const r = searchCards(cards, { q: 'nami' });
  assert.ok(r.some(c => c.id === 'OP11-041'));
});
test('search by card number and by trait', () => {
  assert.equal(searchCards(cards, { q: 'op01-025' })[0].id, 'OP01-025');
  assert.ok(searchCards(cards, { q: 'straw hat crew' }).every(c => c.traits.some(t => /straw hat crew/i.test(t)) || /straw hat crew/i.test(c.name)));
});
test('accent-insensitive search', () => {
  const fake = [{ id: 'X-1', name: 'Pudding Café', traits: [], colors: [], type: 'Character', cost: 1 }];
  assert.equal(searchCards(fake, { q: 'cafe' }).length, 1);
});
test('type + cost range filter returns only matching cards', () => {
  const r = searchCards(cards, { types: ['Event'], costMin: 1, costMax: 2 });
  assert.ok(r.length > 10);
  assert.ok(r.every(c => c.type === 'Event' && c.cost >= 1 && c.cost <= 2));
});
test('cost filter never throws on null-cost leaders and excludes them', () => {
  const r = searchCards(cards, { costMin: 0, costMax: 10 });
  assert.ok(!r.some(c => c.type === 'Leader'));
});
test('color filter matches any selected color', () => {
  const r = searchCards(cards, { colors: ['Purple'] });
  assert.ok(r.length > 50 && r.every(c => c.colors.includes('Purple')));
});
test('set filter matches card number prefix', () => {
  assert.ok(searchCards(cards, { set: 'ST01' }).every(c => c.id.startsWith('ST01-')));
});
test('results sorted by name then id, leaders included when no cost filter', () => {
  const r = searchCards(cards, { q: 'luffy' });
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].name.localeCompare(r[i].name) <= 0 || r[i - 1].name === r[i].name);
  assert.ok(r.some(c => c.type === 'Leader'));
});
test('full search over all cards runs under 20 ms', () => {
  searchCards(cards, { q: 'a' });
  const t = performance.now();
  for (let i = 0; i < 10; i++) searchCards(cards, { q: 'zo', colors: ['Green'] });
  assert.ok((performance.now() - t) / 10 < 20);
});
test('thumb() picks the small TCGplayer image size', () => {
  assert.equal(thumb('https://tcgplayer-cdn.tcgplayer.com/product/1_in_1000x1000.jpg'), 'https://tcgplayer-cdn.tcgplayer.com/product/1_200w.jpg');
  assert.equal(thumb('https://x/y.jpg'), 'https://x/y.jpg');
});

test('popularFirst puts meta-played cards first, most-played first, leaders on top', async () => {
  const { popularFirst } = await import('../js/lib/search.js');
  const cs = [{ id: 'A-1', name: 'A' }, { id: 'B-1', name: 'B' }, { id: 'C-1', name: 'C' }, { id: 'L-1', name: 'L' }];
  const meta = { decks: [
    { leaderId: 'L-1', points: 5, lists: [{ cards: [{ id: 'C-1', count: 4 }] }] },
    { leaderId: 'X-1', points: 1, lists: [{ cards: [{ id: 'C-1', count: 2 }, { id: 'B-1', count: 4 }] }] },
  ] };
  assert.deepEqual(popularFirst(cs, meta).map(c => c.id), ['L-1', 'C-1', 'B-1', 'A-1']);
});
test('popularFirst without meta keeps newest sets first', async () => {
  const { popularFirst } = await import('../js/lib/search.js');
  const cs = [{ id: 'OP01-001', name: 'A' }, { id: 'OP17-001', name: 'B' }, { id: 'ST01-001', name: 'C' }];
  assert.deepEqual(popularFirst(cs, null).map(c => c.id), ['OP17-001', 'OP01-001', 'ST01-001']);
});
