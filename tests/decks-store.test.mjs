import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';
import { createDecks } from '../js/lib/decks-store.js';

const mem = () => { const m = new Map(); return createStore({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }); };

test('save assigns id and updatedAt; list is newest first', async () => {
  const d = createDecks(mem());
  const a = d.save({ name: 'A', leaderId: 'L', entries: [] });
  await new Promise(r => setTimeout(r, 5));
  const b = d.save({ name: 'B', leaderId: 'L', entries: [] });
  assert.match(a.id, /^d_/);
  assert.ok(a.updatedAt);
  assert.deepEqual(d.list().map(x => x.name), ['B', 'A']);
});
test('saving an existing deck updates it in place', () => {
  const d = createDecks(mem());
  const a = d.save({ name: 'A', leaderId: 'L', entries: [] });
  d.save({ ...a, name: 'A2' });
  assert.equal(d.list().length, 1);
  assert.equal(d.get(a.id).name, 'A2');
});
test('remove and duplicate', () => {
  const d = createDecks(mem());
  const a = d.save({ name: 'A', leaderId: 'L', entries: [{ id: 'X-1', count: 4 }] });
  const c = d.duplicate(a.id);
  assert.notEqual(c.id, a.id);
  assert.equal(c.name, 'A (copy)');
  assert.deepEqual(c.entries, a.entries);
  c.entries[0].count = 1;
  assert.equal(d.get(a.id).entries[0].count, 4, 'duplicate is a deep copy');
  d.remove(a.id);
  assert.deepEqual(d.list().map(x => x.id), [c.id]);
});
test('corrupt stored decks read as an empty list', () => {
  const st = mem(); st.set('decks', { not: 'an array' });
  assert.deepEqual(createDecks(st).list(), []);
  st.set('decks', [{ bogus: true }, null]);
  assert.deepEqual(createDecks(st).list(), []);
});
