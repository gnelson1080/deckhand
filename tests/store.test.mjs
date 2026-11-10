import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';

const memory = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; };

test('round-trips JSON values under a namespaced key', () => {
  const s = memory(); const st = createStore(s);
  st.set('progress', { completed: [1, 2], quiz: { 1: 3 } });
  assert.deepEqual(st.get('progress'), { completed: [1, 2], quiz: { 1: 3 } });
  assert.ok(s.getItem('deckhand:progress'));
});
test('returns fallback for missing or corrupt values', () => {
  const s = memory(); s.setItem('deckhand:theme', '{bad'); const st = createStore(s);
  assert.equal(st.get('theme', null), null);
  assert.equal(st.get('nothing', 7), 7);
});
test('never throws when storage throws (private mode)', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const st = createStore(bad);
  assert.doesNotThrow(() => st.set('seenIntro', true));
  assert.equal(st.get('seenIntro', false), true, 'remembers for this session in memory');
});
test('works with no storage at all', () => {
  const st = createStore(undefined);
  st.set('x', 1);
  assert.equal(st.get('x', 0), 1);
});
