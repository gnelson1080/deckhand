import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendPrices, shardKey, MAX_DAYS } from '../scripts/lib/prices.mjs';

const cards = [{ id: 'OP14-020', price: 0.16 }, { id: 'OP14-031', price: 10.17 }];

test('shardKey is the card number prefix', () => {
  assert.equal(shardKey('OP14-020'), 'OP14');
  assert.equal(shardKey('P-093'), 'P');
});
test('first run creates a shard', () => {
  const s = appendPrices(null, cards, '2026-11-10');
  assert.deepEqual(s, { dates: ['2026-11-10'], p: { 'OP14-020': [0.16], 'OP14-031': [10.17] } });
});
test('next day appends', () => {
  let s = appendPrices(null, cards, '2026-11-10');
  s = appendPrices(s, [{ id: 'OP14-020', price: 0.2 }, { id: 'OP14-031', price: 9 }], '2026-11-11');
  assert.deepEqual(s.dates, ['2026-11-10', '2026-11-11']);
  assert.deepEqual(s.p['OP14-020'], [0.16, 0.2]);
});
test('same day replaces instead of duplicating', () => {
  let s = appendPrices(null, cards, '2026-11-10');
  s = appendPrices(s, [{ id: 'OP14-020', price: 0.5 }, { id: 'OP14-031', price: 10.17 }], '2026-11-10');
  assert.deepEqual(s.dates, ['2026-11-10']);
  assert.deepEqual(s.p['OP14-020'], [0.5]);
});
test('a new card is left-padded with null; a card missing today gets null', () => {
  let s = appendPrices(null, [cards[0]], '2026-11-10');
  s = appendPrices(s, [cards[1]], '2026-11-11');
  assert.deepEqual(s.p['OP14-031'], [null, 10.17]);
  assert.deepEqual(s.p['OP14-020'], [0.16, null]);
});
test('null price is stored as null, never invented', () => {
  const s = appendPrices(null, [{ id: 'OP14-020', price: null }], '2026-11-10');
  assert.deepEqual(s.p['OP14-020'], [null]);
});
test(`keeps at most ${MAX_DAYS} days`, () => {
  let s = null;
  const d0 = Date.parse('2025-01-01T00:00:00Z');
  for (let i = 0; i < MAX_DAYS + 5; i++) s = appendPrices(s, [cards[0]], new Date(d0 + i * 864e5).toISOString().slice(0, 10));
  assert.equal(s.dates.length, MAX_DAYS);
  assert.equal(s.p['OP14-020'].length, MAX_DAYS);
  assert.equal(s.dates[0], '2025-01-06');
});
test('a corrupt previous shard is replaced by a fresh one', () => {
  const s = appendPrices({ dates: 'nope' }, cards, '2026-11-10');
  assert.deepEqual(s.dates, ['2026-11-10']);
});

test('updatePriceHistory groups cards by set and writes one shard per set', async () => {
  const { updatePriceHistory } = await import('../scripts/lib/prices.mjs');
  const written = {};
  const read = k => (k === 'OP14' ? { dates: ['2026-11-09'], p: { 'OP14-020': [0.1] } } : null);
  updatePriceHistory([{ id: 'OP14-020', price: 0.16 }, { id: 'ST01-001', price: 1 }], '2026-11-10', read, (k, s) => { written[k] = s; });
  assert.deepEqual(Object.keys(written).sort(), ['OP14', 'ST01']);
  assert.deepEqual(written.OP14.p['OP14-020'], [0.1, 0.16]);
});
test('updatePriceHistory survives an unreadable old shard', async () => {
  const { updatePriceHistory } = await import('../scripts/lib/prices.mjs');
  const written = {};
  updatePriceHistory([{ id: 'OP14-020', price: 0.16 }], '2026-11-10', () => { throw new Error('bad json'); }, (k, s) => { written[k] = s; });
  assert.deepEqual(written.OP14.dates, ['2026-11-10']);
});
