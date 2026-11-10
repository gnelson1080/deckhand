import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCards } from '../scripts/lib/normalize-cards.mjs';

const raw = JSON.parse(readFileSync(new URL('./fixtures/optcg-set.json', import.meta.url)));
const st = JSON.parse(readFileSync(new URL('./fixtures/optcg-st.json', import.meta.url)));
const byId = new Map(normalizeCards([...raw, ...st]).map(c => [c.id, c]));

test('groups alt art records under one card id', () => {
  const c = byId.get('OP01-077');
  assert.equal(c.name, 'Perona');
  assert.equal(c.altImgs.length, 1);
  assert.match(c.img, /OP01-077\.jpg$/);
});

test('leader has null cost and numeric life', () => {
  const c = byId.get('OP11-041');
  assert.equal(c.type, 'Leader');
  assert.equal(c.cost, null);
  assert.equal(c.life, 4);
  assert.deepEqual(c.colors, ['Blue', 'Yellow']);
});

test('event has null power and numeric cost', () => {
  const c = [...byId.values()].find(x => x.type === 'Event');
  assert.equal(c.power, null);
  assert.equal(typeof c.cost, 'number');
});

test('NULL attribute becomes null; traits split on slash', () => {
  const c = byId.get('OP03-098');
  assert.equal(c.attribute, null);
  assert.ok(Array.isArray(c.traits));
});

test('zero counter normalizes to null; starter deck cards are merged', () => {
  assert.ok(byId.has(st[0].card_set_id));
  for (const c of byId.values()) assert.notEqual(c.counter, 0);
});
