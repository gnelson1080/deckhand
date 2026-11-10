import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, readBackup, describeBackup } from '../js/lib/backup.js';

const data = {
  progress: { completed: [1, 2, 3], quiz: { 1: 3, 2: 2, 3: 3 } },
  decks: [{ id: 'd_1', name: 'Luffy é', leaderId: 'OP13-001', entries: [{ id: 'OP07-022', count: 4 }], updatedAt: '2026-11-10T00:00:00Z' }],
  theme: 'dark',
};

test('round-trips progress, decks and theme (including non-ASCII names)', () => {
  const code = makeBackup(data);
  assert.match(code, /^DH1\.[A-Za-z0-9_-]+$/);
  const r = readBackup(code);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, data);
});
test('tolerates spaces and line breaks around and inside the code', () => {
  const code = makeBackup(data);
  const messy = `\n  ${code.slice(0, 20)}\n${code.slice(20)}  \n`;
  assert.equal(readBackup(messy).ok, true);
});
test('truncated code gives a clear error', () => {
  const r = readBackup(makeBackup(data).slice(0, 30));
  assert.equal(r.ok, false);
  assert.match(r.error, /incomplete|damaged/i);
});
test('unknown version or prefix is rejected', () => {
  assert.match(readBackup('DH9.abc').error, /Deckhand backup/i);
  assert.match(readBackup('hello').error, /Deckhand backup/i);
  assert.equal(readBackup('').ok, false);
});
test('wrong shapes are rejected', () => {
  const bad = 'DH1.' + Buffer.from(JSON.stringify({ v: 1, progress: { completed: 'x' }, decks: [] })).toString('base64url');
  assert.equal(readBackup(bad).ok, false);
  const bad2 = 'DH1.' + Buffer.from(JSON.stringify({ v: 1, progress: { completed: [], quiz: {} }, decks: [{ nope: 1 }] })).toString('base64url');
  assert.equal(readBackup(bad2).ok, false);
});
test('describeBackup summarizes in plain words', () => {
  assert.equal(describeBackup(data), '3 lessons done, 1 deck');
});

const enc = obj => 'DH1.' + Buffer.from(JSON.stringify(obj)).toString('base64url');
test('quiz scores must be whole numbers 0-3 (no HTML smuggled into progress)', () => {
  const r = readBackup(enc({ v: 1, progress: { completed: [1], quiz: { 1: '<img src=x onerror=alert(1)>' } }, decks: [] }));
  assert.equal(r.ok, false);
  assert.equal(readBackup(enc({ v: 1, progress: { completed: [1], quiz: { 1: 7 } }, decks: [] })).ok, false);
});
test('completed lessons must be unique ids from 1 to 50', () => {
  assert.equal(readBackup(enc({ v: 1, progress: { completed: [1, 1], quiz: {} }, decks: [] })).ok, false);
  assert.equal(readBackup(enc({ v: 1, progress: { completed: [0], quiz: {} }, decks: [] })).ok, false);
});
test('deck ids must look like real deck ids and be unique', () => {
  const d = id => ({ id, name: 'x', leaderId: null, entries: [] });
  assert.equal(readBackup(enc({ v: 1, progress: { completed: [], quiz: {} }, decks: [d('new')] })).ok, false);
  assert.equal(readBackup(enc({ v: 1, progress: { completed: [], quiz: {} }, decks: [d('d_a1'), d('d_a1')] })).ok, false);
  assert.equal(readBackup(enc({ v: 1, progress: { completed: [], quiz: {} }, decks: [d('d_a1')] })).ok, true);
});
test('makeBackup output always passes readBackup, even with odd counts', () => {
  const code = makeBackup({ progress: { completed: [], quiz: {} }, decks: [{ id: 'd_x', name: 'n', leaderId: null, entries: [{ id: 'A-1', count: 0 }, { id: 'B-1', count: 198 }] }] });
  const r = readBackup(code);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.data.decks[0].entries, [{ id: 'B-1', count: 99 }]);
});
