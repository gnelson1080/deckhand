import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDeckText, formatDeckText, canAdd, validateDeck, metaHints } from '../js/lib/deck.js';

const C = (id, type, colors, cost = 1, counter = 1000, power = 2000) => [id, { id, name: 'Card ' + id, type, colors, cost: type === 'Leader' ? null : cost, counter, power }];
const cards = new Map([
  C('L-RG', 'Leader', ['Red', 'Green']),
  C('L-B', 'Leader', ['Blue']),
  C('R-1', 'Character', ['Red'], 1),
  C('R-2', 'Character', ['Red'], 2),
  C('G-5', 'Character', ['Green'], 5, null),
  C('RB-3', 'Character', ['Red', 'Blue'], 3),
  C('E-1', 'Event', ['Red'], 1, null, null),
  C('B-1', 'Character', ['Blue'], 1),
]);
const deck = (entries, leaderId = 'L-RG') => ({ id: 'd', name: 'Test', leaderId, entries, updatedAt: '' });

test('format then parse round-trips', () => {
  const d = deck([{ id: 'R-1', count: 4 }, { id: 'G-5', count: 2 }]);
  const text = formatDeckText(d, cards);
  assert.equal(text.split('\n')[0], '1xL-RG');
  const p = parseDeckText(text, cards);
  assert.equal(p.leaderId, 'L-RG');
  assert.deepEqual(p.entries, [{ id: 'R-1', count: 4 }, { id: 'G-5', count: 2 }]);
  assert.deepEqual(p.bad, []);
});
test('parse tolerates messy pasted text and lists bad lines', () => {
  const p = parseDeckText('1xL-RG\r\n\r\n4 R-1 Some Name\n2x R-2\n1xR-2\n3xNOPE-9\nhello world\n', cards);
  assert.equal(p.leaderId, 'L-RG');
  assert.deepEqual(p.entries, [{ id: 'R-1', count: 4 }, { id: 'R-2', count: 3 }]);
  assert.deepEqual(p.bad.map(b => b.line), ['3xNOPE-9', 'hello world']);
  assert.match(p.bad[0].reason, /not found/i);
});
test('canAdd refuses the 5th copy', () => {
  const r = canAdd(deck([{ id: 'R-1', count: 4 }]), cards.get('R-1'), cards);
  assert.equal(r.ok, false); assert.match(r.reason, /4 copies/);
});
test('canAdd refuses a card with a color not on the Leader, naming the color', () => {
  const r = canAdd(deck([]), cards.get('RB-3'), cards);
  assert.equal(r.ok, false); assert.match(r.reason, /Blue/);
});
test('canAdd refuses Leaders, no-leader decks and full decks', () => {
  assert.equal(canAdd(deck([]), cards.get('L-B'), cards).ok, false);
  assert.match(canAdd(deck([], null), cards.get('R-1'), cards).reason, /Leader first/);
  const full = deck([{ id: 'R-1', count: 4 }, { id: 'R-2', count: 4 }, { id: 'E-1', count: 42 }]);
  assert.match(canAdd(full, cards.get('G-5'), cards).reason, /50/);
});
test('canAdd allows a legal card', () => assert.equal(canAdd(deck([]), cards.get('G-5'), cards).ok, true));
test('validateDeck reports count, copies, color, unknown and no-leader problems', () => {
  const v = validateDeck(deck([{ id: 'R-1', count: 5 }, { id: 'B-1', count: 1 }, { id: 'GONE-1', count: 2 }]), cards);
  const codes = v.problems.map(p => p.code).sort();
  assert.deepEqual(codes, ['color', 'copies', 'count', 'unknown']);
  assert.equal(v.total, 8);
  assert.equal(v.ok, false);
  assert.ok(validateDeck(deck([], null), cards).problems.some(p => p.code === 'no-leader'));
});
test('a legal 50-card deck validates ok', () => {
  const v = validateDeck(deck([{ id: 'R-1', count: 4 }, { id: 'R-2', count: 4 }, { id: 'E-1', count: 42 }]), cards);
  // 42 copies of E-1 breaks the 4-copy rule, so build a real one:
  const many = new Map(cards);
  const entries = [];
  for (let i = 0; i < 13; i++) { many.set('X-' + i, { id: 'X-' + i, type: 'Character', colors: ['Red'], cost: 2, counter: 1000 }); entries.push({ id: 'X-' + i, count: i < 12 ? 4 : 2 }); }
  const ok = validateDeck(deck(entries), many);
  assert.equal(ok.total, 50); assert.equal(ok.ok, true, JSON.stringify(ok.problems));
  assert.equal(v.ok, false);
});
test('metaHints suggests a staple played in 2+ lists for this Leader', () => {
  const meta = { decks: [{ leaderId: 'L-RG', lists: [{ cards: [{ id: 'G-5', count: 4 }, { id: 'R-1', count: 4 }] }, { cards: [{ id: 'G-5', count: 3 }] }] }] };
  const hints = metaHints(deck([{ id: 'R-1', count: 4 }]), meta, cards);
  assert.ok(hints.some(h => h.includes('Card G-5')), hints.join(' | '));
  assert.ok(hints.length <= 4);
});
test('metaHints is empty-safe without meta', () => assert.deepEqual(metaHints(deck([]), null, cards), []));

test('0x lines are reported as bad, not imported', () => {
  const p = parseDeckText('1xL-RG\n0xR-1\n2xR-2', cards);
  assert.deepEqual(p.entries, [{ id: 'R-2', count: 2 }]);
  assert.equal(p.bad.length, 1);
});
test('canAdd explains a missing Leader instead of blaming colors', () => {
  const r = canAdd(deck([], 'GONE-001'), cards.get('R-1'), cards);
  assert.equal(r.ok, false);
  assert.match(r.reason, /Leader .*isn't in the card list/);
});
