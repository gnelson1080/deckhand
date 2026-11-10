import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, legalActions, power } from '../../js/game/engine.js';
import { board } from './helpers.mjs';

const A = (s, a) => { const n = dispatch(s, a); assert.equal(n.error, undefined, `${JSON.stringify(a)}: ${n.error}`); return n; };
const F = 'OP12-023';

test('"up to" with no valid targets resolves as a no-op (CR 1-3-2)', () => {
  let s = board({ p0: { hand: ['OP10-040'] }, p1: { chars: [F] } }); // no rested Characters to K.O.
  s = A(s, { type: 'play', uid: s.players[0].hand[0].uid });
  assert.equal(s.pending, null);
  assert.equal(s.players[1].chars.length, 1);
  assert.equal(s.stack.length, 0);
});
test('"until the end of your opponent\'s next End Phase" lasts through their turn, then ends', () => {
  let s = board({ p0: { leader: 'OP14-020', hand: ['EB04-007'], donActive: 7, deck: [F, F, F, F] }, p1: { leader: 'OP13-004' } });
  s = A(s, { type: 'play', uid: s.players[0].hand[0].uid });
  const L = s.players[0].leader.uid;
  assert.equal(power(s, L), 7000);
  s = A(s, { type: 'endTurn' });
  assert.equal(power(s, L), 7000, 'still on during opponent turn');
  s = A(s, { type: 'endTurn' });
  assert.equal(power(s, L), 5000, 'gone after their End Phase');
});
test('"during this turn" power changes end at End Phase', () => {
  let s = board({ p0: { hand: ['OP06-017'], life: [F, F], deck: [F, F, F] } });
  s = A(s, { type: 'play', uid: s.players[0].hand[0].uid });
  s = A(s, { type: 'choose', yes: true });
  s = A(s, { type: 'choose', picks: [s.players[0].leader.uid] });
  assert.equal(power(s, s.players[0].leader.uid), 9000);
  s = A(s, { type: 'endTurn' });
  assert.equal(power(s, s.players[0].leader.uid), 6000);
});
test('[Once Per Turn] abilities can be used again next turn', () => {
  let s = board({ p0: { chars: ['EB05-001'], deck: [F, F, F, F] }, p1: { chars: [F] } });
  const u = s.players[0].chars[0].uid;
  s = A(s, { type: 'activate', uid: u, idx: 1 });
  s = A(s, { type: 'choose', picks: [s.players[1].chars[0].uid] });
  assert.ok(!legalActions(s).some(a => a.type === 'activate' && a.uid === u));
  s = A(s, { type: 'endTurn' }); s = A(s, { type: 'endTurn' });
  assert.ok(legalActions(s).some(a => a.type === 'activate' && a.uid === u));
});
test('declining a "You may" cost skips the rest of the effect', () => {
  let s = board({ p0: { hand: ['OP01-055'], chars: [F, F], deck: [F, F, F] } });
  s = A(s, { type: 'play', uid: s.players[0].hand[0].uid });
  s = A(s, { type: 'choose', yes: false });
  assert.equal(s.players[0].hand.length, 0);
  assert.ok(s.players[0].chars.every(c => !c.rested));
});
test('a "You may" cost that can\'t be paid is skipped without asking', () => {
  let s = board({ p0: { hand: ['OP01-055'], chars: [F], deck: [F, F, F] } });
  s = A(s, { type: 'play', uid: s.players[0].hand[0].uid });
  assert.equal(s.pending, null);
  assert.equal(s.players[0].hand.length, 0);
});
