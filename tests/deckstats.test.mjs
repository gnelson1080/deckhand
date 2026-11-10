import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckStats } from '../js/lib/deckstats.js';

const cards = new Map([
  ['A', { id: 'A', type: 'Character', cost: 1, counter: 1000, price: 0.5 }],
  ['B', { id: 'B', type: 'Character', cost: 5, counter: 2000, price: 2 }],
  ['C', { id: 'C', type: 'Event', cost: 1, counter: null, price: null }],
  ['D', { id: 'D', type: 'Character', cost: 12, counter: null, price: 1 }],
]);

test('totals, counters and price', () => {
  const s = deckStats([{ id: 'A', count: 4 }, { id: 'B', count: 3 }, { id: 'C', count: 2 }], cards);
  assert.equal(s.total, 9);
  assert.equal(s.counters, 7);
  assert.equal(s.counterPower, 10000);
  assert.equal(s.price, 8);
  assert.equal(s.byType.Event.length, 1);
});
test('cost curve buckets costs, capping at 10+, always shows 0..7', () => {
  const s = deckStats([{ id: 'A', count: 4 }, { id: 'C', count: 2 }, { id: 'D', count: 1 }], cards);
  assert.equal(s.curve.find(x => x.cost === 1).count, 6);
  assert.equal(s.curve.find(x => x.cost === 10).count, 1);
  assert.ok(s.curve.length >= 8);
});
test('unknown card ids are counted but not crash', () => {
  const s = deckStats([{ id: 'ZZ', count: 2 }], cards);
  assert.equal(s.total, 2);
  assert.equal(s.byType.Other.length, 1);
});
