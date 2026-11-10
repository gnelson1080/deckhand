// Regressions from the Phase 3 review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, legalActions, createGame } from '../../js/game/engine.js';
import { chooseAction, autoplay } from '../../js/game/ai.js';
import { hint } from '../../js/game/coach.js';
import { mulberry32 } from '../../js/game/rng.js';
import { DECKS } from '../../js/game/pool-data.js';
import { board } from './helpers.mjs';

const A = (s, a) => { const n = dispatch(s, a); assert.equal(n.error, undefined, `${JSON.stringify(a)}: ${n.error}`); return n; };
const F = 'OP12-023';

test('CR 7-1-3-1-3: if the attacker leaves the field during the counter step, nothing is K.O.\'d', () => {
  let s = board({ p0: { chars: [F] }, p1: { chars: [{ id: 'OP07-022', rested: true }], hand: ['OP10-040'], donActive: 5 } });
  s = A(s, { type: 'attack', uid: s.players[0].chars[0].uid, target: s.players[1].chars[0].uid });
  if (legalActions(s).some(a => a.type === 'noBlock')) s = A(s, { type: 'noBlock' });
  s = A(s, { type: 'counter', uid: s.players[1].hand[0].uid });
  s = A(s, { type: 'choose', picks: [s.pending.options[0]] });
  assert.equal(s.players[0].chars.length, 0, 'attacker K.O.\'d by the counter event');
  s = A(s, { type: 'endCounter' });
  assert.equal(s.players[1].chars.length, 1, 'Otama survives');
  assert.equal(s.battle, null);
});

test('the AI\'s attack choice does not depend on the opponent\'s hidden hand or Life', () => {
  const mk = (life, hand) => board({ p0: { chars: [F, 'OP14-031'], donActive: 3 }, p1: { leader: 'OP13-004', life, hand, chars: [{ id: 'ST32-002', rested: true }] } });
  for (const level of ['normal', 'hard']) {
    const a = chooseAction(mk([F, F], [F, F]), 0, level, mulberry32(1));
    const b = chooseAction(mk(['OP17-107', 'OP06-038'], ['OP04-016', 'OP12-018']), 0, level, mulberry32(1));
    assert.deepEqual(a, b, level);
  }
});

test('the coach\'s hint does not depend on the opponent\'s hidden cards', () => {
  const mk = (life, hand) => board({ p0: { chars: [F], donActive: 2 }, p1: { leader: 'OP13-004', life, hand } });
  assert.deepEqual(hint(mk([F, F], [F]), 0).action, hint(mk(['OP17-107', 'OP17-102'], ['OP04-016']), 0).action);
});

test('declining a Trigger\'s cost puts the card in hand instead of the trash (CR 10-1-5-2)', () => {
  let s = board({ p0: { chars: [F] }, p1: { life: ['OP05-073'], donActive: 2 } });
  s = A(s, { type: 'attack', uid: s.players[0].chars[0].uid, target: s.players[1].leader.uid });
  if (legalActions(s).some(a => a.type === 'noBlock')) s = A(s, { type: 'noBlock' });
  s = A(s, { type: 'endCounter' });
  s = A(s, { type: 'useTrigger' });
  s = A(s, { type: 'choose', yes: false });
  assert.ok(s.players[1].hand.some(c => c.id === 'OP05-073'));
  assert.ok(!s.players[1].trash.some(c => c.id === 'OP05-073'));
});

test('a Character that "cannot be rested" is not rested by rest effects', () => {
  let s = board({ p0: { hand: ['ST32-002', 'OP17-022'], donActive: 10, deck: [F, F, F, F] }, p1: { chars: [F] } });
  s = A(s, { type: 'play', uid: s.players[0].hand.find(c => c.id === 'ST32-002').uid });
  if (s.pending) s = A(s, { type: 'choose', picks: [s.players[1].chars[0].uid] });
  s.players[0].donActive = 10;
  s = A(s, { type: 'play', uid: s.players[0].hand.find(c => c.id === 'OP17-022').uid });
  assert.equal(s.players[1].chars[0].rested, false);
});

test('Hard AI decides within a time budget on busy mid-game states', () => {
  let g = createGame({ seed: 77, decks: [DECKS.robin, DECKS.sabo], first: 0 });
  g = autoplay(g, ['normal', 'normal'], mulberry32(5), 140);
  if (g.phase === 'over' || g.pending || g.battle) return;
  const t = performance.now();
  chooseAction(g, g.active, 'hard', mulberry32(2));
  assert.ok(performance.now() - t < 700, `took ${Math.round(performance.now() - t)} ms`);
});
