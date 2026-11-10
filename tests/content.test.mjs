import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const read = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
export const glossary = read('content/glossary.json');

test('every glossary entry has a term and a short definition up to 200 chars', () => {
  for (const g of glossary) {
    assert.ok(g.term && g.term.trim(), 'term');
    assert.ok(g.short && g.short.length <= 200, `${g.term}: short is ${g.short?.length} chars`);
    assert.ok(Array.isArray(g.aliases), `${g.term}: aliases`);
  }
});
test('no duplicate terms or aliases', () => {
  const seen = new Set();
  for (const g of glossary) for (const k of [g.term, ...g.aliases].map(s => s.toLowerCase())) {
    assert.ok(!seen.has(k), `duplicate ${k}`); seen.add(k);
  }
});
test('glossary covers every keyword a beginner meets', () => {
  const required = ['Leader', 'Character', 'Event', 'Stage', 'DON!!', 'DON!! deck', 'Cost area', 'Active', 'Rested', 'Life', 'Trigger', 'Counter', 'Power', 'Cost', 'Attack', 'Block', 'K.O.', 'Trash', 'Hand', 'Deck', 'Mulligan', 'Refresh Phase', 'Draw Phase', 'DON!! Phase', 'Main Phase', 'End Phase', 'Rush', 'Rush: Character', 'Blocker', 'Double Attack', 'Banish', 'Unblockable', 'On Play', 'When Attacking', 'On Block', 'On K.O.', "On Your Opponent's Attack", 'Activate: Main', 'Main', 'End of Your Turn', "End of Your Opponent's Turn", 'DON!! xN', 'DON!! −N', 'Your Turn', "Opponent's Turn", 'Once Per Turn', 'Give DON!!', 'Trait', 'Attribute', 'Color', 'Card number', 'Standard format', 'Block rotation'];
  const names = new Set(glossary.flatMap(g => [g.term, ...g.aliases]));
  for (const r of required) assert.ok(names.has(r), `missing ${r}`);
});
test('glossary example card ids exist in card data', () => {
  const ids = new Set(read('data/cards.json').map(c => c.id));
  for (const g of glossary) if (g.example) assert.ok(ids.has(g.example), `${g.term}: ${g.example}`);
});
test('every [bracket] keyword used on 20+ cards is in the glossary', async () => {
  const { buildTermIndex, findTerm } = await import('../js/ui/rich-text.js');
  const idx = buildTermIndex(glossary);
  const counts = new Map();
  for (const c of read('data/cards.json')) for (const m of c.text.matchAll(/\[([^\]]+)\]/g)) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  const cardNamesAndTypes = new Set(read('data/cards.json').flatMap(c => [c.name, ...c.traits]));
  for (const [k, n] of counts) if (n >= 20 && !cardNamesAndTypes.has(k)) assert.ok(findTerm(idx, k), `[${k}] used ${n}x has no glossary entry`);
});
