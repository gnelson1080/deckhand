import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceSeries, pctChange } from '../js/lib/price-series.js';

const dates = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10));
const shard = { dates, p: { 'A-1': dates.map((_, i) => (i === 5 ? null : 1 + i / 10)) } };

test('all range drops null days', () => {
  const s = priceSeries(shard, 'A-1', 'all');
  assert.equal(s.length, 39);
  assert.deepEqual(s[0], { date: dates[0], price: 1 });
});
test('7d and 30d ranges are measured back from the latest date', () => {
  assert.equal(priceSeries(shard, 'A-1', '7d').length, 7);
  assert.equal(priceSeries(shard, 'A-1', '30d').length, 30);
  assert.equal(priceSeries(shard, 'A-1', '7d').at(-1).date, dates.at(-1));
});
test('unknown card or empty shard gives an empty series', () => {
  assert.deepEqual(priceSeries(shard, 'NOPE', 'all'), []);
  assert.deepEqual(priceSeries(null, 'A-1', 'all'), []);
  assert.deepEqual(priceSeries({ dates: [], p: {} }, 'A-1', '7d'), []);
});
test('pctChange compares first and last point', () => {
  assert.equal(pctChange([{ price: 2 }, { price: 3 }]), 50);
  assert.equal(pctChange([{ price: 4 }, { price: 3 }]), -25);
  assert.equal(pctChange([{ price: 4 }]), null);
  assert.equal(pctChange([{ price: 0 }, { price: 3 }]), null);
});
