// Core rules, each tied to the Comprehensive Rules v1.2.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch, legalActions, actor, power, keywords } from '../../js/game/engine.js';
import { DECKS } from '../../js/game/pool-data.js';
import { board, uidOf } from './helpers.mjs';

const A = (s, a) => { const n = dispatch(s, a); assert.equal(n.error, undefined, `${a.type}: ${n.error}`); return n; };
const has = (s, pred) => legalActions(s).some(pred);
const nb = s => (has(s, a => a.type === 'noBlock') ? A(s, { type: 'noBlock' }) : s);
const startGame = (first = 0, seed = 11) => { let g = createGame({ seed, decks: [DECKS['luffy-ace'], DECKS.mihawk], first }); g = A(g, { type: 'keep' }); return A(g, { type: 'keep' }); };

test('6-3-1 / 6-4-1: first player does not draw and gets 1 DON!! on turn 1', () => {
  const g = startGame(0);
  assert.equal(g.players[0].hand.length, 5);
  assert.equal(g.players[0].donActive, 1);
  assert.equal(g.players[0].donDeck, 9);
});
test('6-4-1: second player draws and gets 2 DON!! on their first turn', () => {
  let g = startGame(0);
  g = A(g, { type: 'endTurn' });
  assert.equal(g.active, 1);
  assert.equal(g.players[1].hand.length, 6);
  assert.equal(g.players[1].donActive, 2);
});
test('6-5-6-1: nobody can attack on their own first turn', () => {
  let g = startGame(0);
  assert.ok(!has(g, a => a.type === 'attack'));
  g = A(g, { type: 'endTurn' });
  assert.ok(!has(g, a => a.type === 'attack'));
  g = A(g, { type: 'endTurn' });
  assert.ok(has(g, a => a.type === 'attack'), 'turn 3: first player can attack');
});
test('6-2-3/4: Refresh returns given DON!! rested, then stands everything', () => {
  let s = board({ p0: { chars: [{ id: 'OP12-023', rested: true, don: 2 }], donActive: 0, donRested: 3 } });
  s = A(s, { type: 'endTurn' }); s = A(s, { type: 'endTurn' });
  const p = s.players[0];
  assert.equal(p.chars[0].don, 0);
  assert.equal(p.chars[0].rested, false);
  assert.equal(p.donActive, 5 + 2, '3 rested + 2 returned stand up, then +2 from DON!! Phase');
});
test('6-5-5-2: each given DON!! is +1000 only during its owner\'s turn', () => {
  let s = board({ p0: { chars: ['OP12-023'] } });
  const u = uidOf(s, 0, 'chars');
  s = A(s, { type: 'giveDon', uid: u });
  assert.equal(power(s, u), 7000);
  s = A(s, { type: 'endTurn' });
  assert.equal(power(s, u), 6000);
});
test('3-7-4 / 10-1-1: a Character can\'t attack the turn it is played unless it has [Rush]', () => {
  let s = board({ p0: { hand: ['OP12-023', 'ST21-014'], donActive: 10 } });
  s = A(s, { type: 'play', uid: s.players[0].hand[0].uid });
  s = A(s, { type: 'play', uid: s.players[0].hand[0].uid });
  const [kawa, luffy] = s.players[0].chars.map(c => c.uid);
  assert.ok(!has(s, a => a.type === 'attack' && a.uid === kawa));
  assert.ok(has(s, a => a.type === 'attack' && a.uid === luffy));
});
test('7-1-1-2: targets are the Leader or rested Characters only', () => {
  const s = board({ p0: { chars: ['OP12-023'] }, p1: { chars: [{ id: 'OP12-023' }, { id: 'ST32-002', rested: true }] } });
  const me = uidOf(s, 0, 'chars');
  const targets = legalActions(s).filter(a => a.type === 'attack' && a.uid === me).map(a => a.target).sort();
  assert.deepEqual(targets, [uidOf(s, 1, 'leader'), uidOf(s, 1, 'chars', 1)].sort());
});
test('7-1-4-1: attacker wins ties; Leader damage moves top Life to hand', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { leader: 'OP13-004', life: ['OP12-023', 'OP12-023', 'OP12-023'] } });
  // Sabo with 3 Life has 5000; Kawamatsu 6000 + 0 vs 5000 → hit
  s = A(s, { type: 'attack', uid: uidOf(s, 0, 'chars'), target: uidOf(s, 1, 'leader') });
  assert.equal(actor(s), 1);
  s = nb(s);
  s = A(s, { type: 'endCounter' });
  assert.equal(s.players[1].life.length, 2);
  assert.equal(s.players[1].hand.length, 1);
  assert.equal(s.battle, null);
});
test('7-1-4-1: equal power still hits (tie goes to attacker)', () => {
  let s = board({ p0: { leader: 'OP14-020' }, p1: { leader: 'OP13-004', life: ['OP12-023', 'OP12-023'] } });
  s = A(s, { type: 'attack', uid: uidOf(s, 0, 'leader'), target: uidOf(s, 1, 'leader') });
  s = nb(s); s = A(s, { type: 'endCounter' });
  assert.equal(s.players[1].life.length, 1);
});
test('7-1-2 / 7-1-3: block step comes before counter step; one block per battle', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { chars: ['OP14-031', 'OP14-031'], hand: ['OP12-023'] } });
  s = A(s, { type: 'attack', uid: uidOf(s, 0, 'chars'), target: uidOf(s, 1, 'leader') });
  assert.ok(has(s, a => a.type === 'block'));
  assert.ok(!has(s, a => a.type === 'counter'), 'no counters during block step');
  s = A(s, { type: 'block', uid: uidOf(s, 1, 'chars', 0) });
  assert.ok(!has(s, a => a.type === 'block'));
  assert.ok(has(s, a => a.type === 'counter'));
  s = A(s, { type: 'endCounter' });
  assert.equal(s.players[1].chars.length, 1, 'blocking Nami (2000) was K.O.\'d');
  assert.equal(s.players[1].life.length, 3);
});
test('7-1-3-1-1: a Character Counter trashes from hand and adds power for the battle', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { leader: 'OP13-004', life: ['OP12-023', 'OP12-023'], hand: ['OP12-023'] } });
  s = A(s, { type: 'attack', uid: uidOf(s, 0, 'chars'), target: uidOf(s, 1, 'leader') });
  s = nb(s);
  s = A(s, { type: 'counter', uid: s.players[1].hand[0].uid });
  assert.equal(power(s, uidOf(s, 1, 'leader')), 7000);
  s = A(s, { type: 'endCounter' });
  assert.equal(s.players[1].life.length, 2, 'blocked');
  assert.equal(s.players[1].trash.length, 1);
  assert.equal(power(s, uidOf(s, 1, 'leader')), 5000, 'counter power ends with the battle');
});
test('7-1-4-1-2: losing a battle K.O.s the Character; its given DON!! return rested', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { chars: [{ id: 'OP14-031', rested: true, don: 1 }], donRested: 0 } });
  s = A(s, { type: 'attack', uid: uidOf(s, 0, 'chars'), target: uidOf(s, 1, 'chars') });
  s = nb(s); s = A(s, { type: 'endCounter' });
  assert.equal(s.players[1].chars.length, 0);
  assert.equal(s.players[1].trash.length, 1);
  assert.equal(s.players[1].donRested, 1);
});
test('1-2-1-1-1: a Leader with 0 Life that takes damage loses', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { leader: 'OP13-004', life: [] } });
  s = A(s, { type: 'attack', uid: uidOf(s, 0, 'chars'), target: uidOf(s, 1, 'leader') });
  s = nb(s); s = A(s, { type: 'endCounter' });
  assert.equal(s.winner, 0);
  assert.equal(s.phase, 'over');
});
test('1-2-1-1-2: having 0 cards in deck loses at rule processing', () => {
  let s = board({ p1: { deck: ['OP12-023'] } });
  s = A(s, { type: 'endTurn' });
  assert.equal(s.players[1].deck.length, 0);
  assert.equal(s.winner, 0);
});
test('3-7-6-1: a 6th Character makes you trash one of yours first, and that is not a K.O.', () => {
  let s = board({ p0: { chars: ['OP17-102', 'OP12-023', 'OP12-023', 'OP12-023', 'OP12-023'], hand: ['OP12-023'], donActive: 10 } });
  s = A(s, { type: 'play', uid: s.players[0].hand[0].uid });
  assert.equal(s.pending?.kind, 'pick');
  s = A(s, { type: 'choose', picks: [uidOf(s, 0, 'chars', 0)] });
  assert.equal(s.players[0].chars.length, 5);
  assert.equal(s.players[0].trash[0].id, 'OP17-102');
  assert.equal(s.pending, null, 'Oven\'s [On K.O.] did not fire');
});
test('3-8-5: playing a second Stage replaces the first', () => {
  let s = board({ p0: { stage: 'ST31-005', hand: ['ST31-005'], donActive: 5 } });
  s = A(s, { type: 'play', uid: s.players[0].hand[0].uid });
  while (s.pending) s = A(s, { type: 'choose', picks: [] });
  assert.equal(s.players[0].trash.length, 1);
  assert.ok(s.players[0].stage);
});
test('paying costs: you can\'t play a card you can\'t afford', () => {
  const s = board({ p0: { hand: ['OP17-022'], donActive: 9 } });
  assert.ok(!has(s, a => a.type === 'play'));
  const r = dispatch(s, { type: 'play', uid: s.players[0].hand[0].uid });
  assert.match(r.error, /DON/);
});
test('keywords: [Blocker] is read from the card', () => {
  const s = board({ p1: { chars: ['OP14-031'] } });
  assert.ok(keywords(s, uidOf(s, 1, 'chars')).has('Blocker'));
});
test('legalActions only lists actions dispatch accepts (random walk)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    let g = createGame({ seed, decks: [DECKS.sabo, DECKS.robin], first: seed % 2 });
    for (let i = 0; i < 300 && g.phase !== 'over'; i++) {
      const acts = legalActions(g);
      assert.ok(acts.length > 0, 'no legal action in a live game');
      const a = acts[Math.floor(((seed * 9301 + i * 49297) % 233280) / 233280 * acts.length)];
      const n = dispatch(g, a);
      assert.equal(n.error, undefined, `${JSON.stringify(a)} → ${n.error}`);
      g = n;
    }
  }
});
