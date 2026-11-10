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

const index = read('content/lessons/index.json');
const cardIds = new Set(read('data/cards.json').map(c => c.id));
const lessons = index.map(l => ({ meta: l, body: read(`content/lessons/${String(l.id).padStart(2, '0')}.json`) }));

test('lesson index ids run 1..N with titles and minutes', () => {
  index.forEach((l, i) => { assert.equal(l.id, i + 1); assert.ok(l.title && l.minutes > 0 && l.minutes <= 4); });
});
for (const { meta, body } of lessons) {
  test(`lesson ${meta.id}: matches index and has exactly 3 well-formed questions`, () => {
    assert.equal(body.id, meta.id);
    assert.equal(body.title, meta.title);
    assert.equal(body.quiz.length, 3);
    for (const q of body.quiz) {
      assert.equal(q.choices.length, 4, q.q);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, q.q);
      assert.ok(q.why && q.why.length > 10, q.q);
      assert.equal(new Set(q.choices).size, 4, `duplicate choices: ${q.q}`);
    }
  });
  test(`lesson ${meta.id}: every card and scenario exists, every <kw> term is in the glossary`, async () => {
    const { SCENARIOS } = await import('../js/lib/scenarios.js');
    const terms = new Set(glossary.flatMap(g => [g.term, ...g.aliases]));
    for (const st of body.steps) {
      assert.ok(['text', 'card', 'board', 'tip', 'deckpick'].includes(st.type), st.type);
      if (st.type === 'card') { assert.ok(cardIds.has(st.cardId), st.cardId); assert.ok(st.callouts.length); }
      if (st.type === 'board') assert.ok(SCENARIOS[st.scenario], st.scenario);
      for (const m of String(st.html || '').matchAll(/<kw(?:\s+term="([^"]+)")?>([^<]+)<\/kw>/g)) assert.ok(terms.has(m[1] || m[2]), `<kw> ${m[1] || m[2]}`);
    }
  });
}

const guideFiles = readdirSync(new URL('../content/deck-guides/', import.meta.url)).filter(f => f.endsWith('.json'));
test('there are at least 5 deck guides', () => assert.ok(guideFiles.length >= 5));
for (const f of guideFiles) {
  test(`deck guide ${f}: leader and key cards exist, difficulty 1-3, filename matches leader`, () => {
    const g = read(`content/deck-guides/${f}`);
    assert.equal(f, `${g.leaderId}.json`);
    assert.ok(cardIds.has(g.leaderId), g.leaderId);
    assert.ok([1, 2, 3].includes(g.difficulty));
    assert.ok(g.gamePlan.length >= 3 && g.keyCards.length >= 4 && g.weakTo.length >= 1);
    for (const k of g.keyCards) assert.ok(cardIds.has(k.id) && k.why, k.id);
  });
}
