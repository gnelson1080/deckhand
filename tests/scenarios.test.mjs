import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCENARIOS, startScenario } from '../js/lib/scenarios.js';
import { boardReducer } from '../js/lib/board.js';

const ids = new Set(JSON.parse(readFileSync(new URL('../data/cards.json', import.meta.url), 'utf8')).map(c => c.id));

for (const [name, sc] of Object.entries(SCENARIOS)) {
  test(`scenario ${name}: goal is not met at start`, () => {
    assert.equal(sc.goal(startScenario(sc)), false);
  });
  test(`scenario ${name}: the intended solution reaches the goal`, () => {
    let s = startScenario(sc);
    for (const a of sc.solution) { s = boardReducer(s, a); assert.equal(s.error, null, `${a.type}: ${s.error}`); }
    assert.equal(sc.goal(s), true);
  });
  test(`scenario ${name}: every card art id exists`, () => {
    const s = startScenario(sc);
    for (const p of [s.me, s.opp]) for (const c of [p.leader, ...p.chars, ...p.hand, ...p.lifeCards]) assert.ok(ids.has(c.art), `${name}: ${c.art}`);
  });
}

test('counter scenario: one Counter alone only ties, and ties go to the attacker', () => {
  const sc = SCENARIOS.counter;
  let s = startScenario(sc);
  s = boardReducer(s, { type: 'useCounter', card: sc.solution[1].card });
  s = boardReducer(s, { type: 'resolve' });
  assert.equal(sc.goal(s), false);
});
