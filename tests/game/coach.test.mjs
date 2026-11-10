import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, legalActions, createGame } from '../../js/game/engine.js';
import { phaseTip, judge, hint, describeAction } from '../../js/game/coach.js';
import { DECKS } from '../../js/game/pool-data.js';
import { board } from './helpers.mjs';

const F = 'OP12-023';

test('there is a tip for mulligan, main, block, counter, trigger and choices', () => {
  const g = createGame({ seed: 1, decks: [DECKS.mihawk, DECKS.robin], first: 0 });
  assert.match(phaseTip(g, 0), /hand/i);
  let s = board({ p0: { chars: [F] }, p1: { chars: ['OP14-031'], hand: [F] } });
  assert.match(phaseTip(s, 0), /DON!!|attack|play/i);
  s = dispatch(s, { type: 'attack', uid: s.players[0].chars[0].uid, target: s.players[1].leader.uid });
  assert.match(phaseTip(s, 1), /Blocker/);
  s = dispatch(s, { type: 'noBlock' });
  assert.match(phaseTip(s, 1), /Counter/);
});
test('judge flags an attack that cannot win', () => {
  const s = board({ p0: { chars: ['OP01-016'] }, p1: { leader: 'OP14-020' } });
  const a = { type: 'attack', uid: s.players[0].chars[0].uid, target: s.players[1].leader.uid };
  const j = judge(s, a, dispatch(s, a), 0);
  assert.equal(j.tone, 'risky');
  assert.match(j.text, /2,000|power/);
});
test('judge flags ending the turn with playable cards and unspent DON!!', () => {
  const s = board({ p0: { hand: [F], donActive: 6 } });
  const a = { type: 'endTurn' };
  const j = judge(s, a, dispatch(s, a), 0);
  assert.equal(j.tone, 'risky');
});
test('judge flags spending counters on a hit that would not hurt much', () => {
  let s = board({ p0: { chars: [F] }, p1: { leader: 'OP13-004', life: [F, F, F, F], hand: [F] } });
  s = dispatch(s, { type: 'attack', uid: s.players[0].chars[0].uid, target: s.players[1].leader.uid });
  s = dispatch(s, { type: 'noBlock' });
  const a = { type: 'counter', uid: s.players[1].hand[0].uid };
  const j = judge(s, a, dispatch(s, a), 1);
  assert.equal(j.tone, 'ok');
  assert.match(j.text, /Life/);
});
test('hint returns a legal action with a reason', () => {
  const s = board({ p0: { hand: [F], donActive: 6 } });
  const h = hint(s, 0);
  assert.ok(legalActions(s).some(a => JSON.stringify(a) === JSON.stringify(h.action)));
  assert.ok(h.text.length > 10);
});
test('describeAction reads like plain English', () => {
  const s = board({ p0: { hand: [F] } });
  assert.match(describeAction(s, { type: 'play', uid: s.players[0].hand[0].uid }), /Play Kawamatsu/);
});
