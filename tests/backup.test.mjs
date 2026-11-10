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
