import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardReducer, powerOf, makeBoard } from '../js/lib/board.js';

const base = () => makeBoard({
  me: { leader: { id: 'L', power: 5000 }, chars: [{ id: 'C', power: 5000 }, { id: 'B', power: 4000, blocker: true }], don: 3, life: 4,
        hand: [{ id: 'H1', cost: 2, power: 3000, counter: 1000 }, { id: 'H2', cost: 4, power: 6000, counter: 2000 }] },
  opp: { leader: { id: 'OL', power: 5000 }, chars: [{ id: 'OC', power: 3000, rested: true }], don: 0, life: 2 },
});

test('attacker wins ties: 5000 into 5000 leader deals 1 damage', () => {
  let s = boardReducer(base(), { type: 'attack', attacker: 'C', target: 'OL' });
  s = boardReducer(s, { type: 'resolve' });
  assert.equal(s.opp.life, 1);
  assert.equal(s.me.chars.find(c => c.id === 'C').rested, true);
});

test('attacking a rested Character that loses is K.O.d', () => {
  let s = boardReducer(base(), { type: 'attack', attacker: 'C', target: 'OC' });
  s = boardReducer(s, { type: 'resolve' });
  assert.ok(!s.opp.chars.some(c => c.id === 'OC'));
  assert.equal(s.opp.trash.length, 1);
});

test('cannot attack an active Character', () => {
  const b = base(); b.opp.chars[0].rested = false;
  const s = boardReducer(b, { type: 'attack', attacker: 'C', target: 'OC' });
  assert.equal(s.battle, null);
  assert.match(s.error, /rested/);
});

test('giveDon moves one active DON and adds +1000 on your turn only', () => {
  const s = boardReducer(base(), { type: 'giveDon', target: 'L' });
  assert.equal(s.me.donActive, 2);
  assert.equal(powerOf(s, 'me', 'L'), 6000);
  assert.equal(powerOf({ ...s, turn: 'opp' }, 'me', 'L'), 5000);
});

test('giveDon with no active DON is refused', () => {
  const b = base(); b.me.donActive = 0;
  const s = boardReducer(b, { type: 'giveDon', target: 'L' });
  assert.equal(s.me.leader.don, 0);
  assert.ok(s.error);
});

test('play rests DON equal to cost and puts the Character on the table', () => {
  const s = boardReducer(base(), { type: 'play', card: 'H1' });
  assert.equal(s.me.donActive, 1);
  assert.equal(s.me.donRested, 2);
  assert.ok(s.me.chars.some(c => c.id === 'H1' && !c.rested && c.justPlayed));
  assert.ok(!s.me.hand.some(c => c.id === 'H1'));
});

test('play is refused when you cannot afford it', () => {
  const s = boardReducer(base(), { type: 'play', card: 'H2' });
  assert.ok(s.me.hand.some(c => c.id === 'H2'));
  assert.match(s.error, /DON/);
});

test('defending: a +2000 counter makes 5000 into 7000 and a 6000 attack fails', () => {
  const b = base(); b.turn = 'opp'; b.opp.chars = [{ id: 'X', power: 6000 }];
  let s = boardReducer(b, { type: 'attack', attacker: 'X', target: 'L' });
  s = boardReducer(s, { type: 'useCounter', card: 'H2' });
  assert.equal(powerOf(s, 'me', 'L'), 7000);
  s = boardReducer(s, { type: 'resolve' });
  assert.equal(s.me.life, 4);
  assert.ok(s.me.trash.some(c => c.id === 'H2'));
});

test('defending: block redirects the attack to the Blocker', () => {
  const b = base(); b.turn = 'opp'; b.opp.chars = [{ id: 'X', power: 6000 }];
  let s = boardReducer(b, { type: 'attack', attacker: 'X', target: 'L' });
  s = boardReducer(s, { type: 'block', blocker: 'B' });
  assert.equal(s.battle.target, 'B');
  s = boardReducer(s, { type: 'resolve' });
  assert.equal(s.me.life, 4);
  assert.ok(!s.me.chars.some(c => c.id === 'B'));
});

test('only one block per battle', () => {
  const b = base(); b.turn = 'opp'; b.opp.chars = [{ id: 'X', power: 6000 }]; b.me.chars.push({ id: 'B2', power: 2000, blocker: true });
  let s = boardReducer(b, { type: 'attack', attacker: 'X', target: 'L' });
  s = boardReducer(s, { type: 'block', blocker: 'B' });
  s = boardReducer(s, { type: 'block', blocker: 'B2' });
  assert.equal(s.battle.target, 'B');
});

test('resting a rested card is a no-op', () => {
  const b = base(); b.me.chars[0].rested = true;
  const s = boardReducer(b, { type: 'rest', card: 'C' });
  assert.deepEqual(s.me.chars, b.me.chars);
});

test('damage takes the top Life card into hand; a Trigger card waits for a choice', () => {
  const b = base(); b.turn = 'opp'; b.opp.chars = [{ id: 'X', power: 9000 }];
  b.me.lifeCards = [{ id: 'T', trigger: 'play', power: 2000 }];
  b.me.life = 1;
  let s = boardReducer(b, { type: 'attack', attacker: 'X', target: 'L' });
  s = boardReducer(s, { type: 'resolve' });
  assert.equal(s.me.life, 0);
  assert.equal(s.pendingTrigger.id, 'T');
  const used = boardReducer(s, { type: 'useTrigger' });
  assert.ok(used.me.chars.some(c => c.id === 'T'));
  assert.equal(used.pendingTrigger, null);
  const kept = boardReducer(s, { type: 'skipTrigger' });
  assert.ok(kept.me.hand.some(c => c.id === 'T'));
});

test('leader with 0 Life taking damage loses the game', () => {
  const b = base(); b.opp.life = 0;
  let s = boardReducer(b, { type: 'attack', attacker: 'C', target: 'OL' });
  s = boardReducer(s, { type: 'resolve' });
  assert.equal(s.winner, 'me');
});

test('reducer never mutates the previous state', () => {
  const b = base(); const snap = JSON.stringify(b);
  boardReducer(b, { type: 'giveDon', target: 'L' });
  boardReducer(b, { type: 'play', card: 'H1' });
  assert.equal(JSON.stringify(b), snap);
});
