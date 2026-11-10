// One scenario per card: the coded effect does what the printed text says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, legalActions, power, keywords, costOf, find } from '../../js/game/engine.js';
import { POOL } from '../../js/game/pool-data.js';
import { CARD_DEFS } from '../../js/game/cards/index.js';
import { board } from './helpers.mjs';

const A = (s, a) => { const n = dispatch(s, a); assert.equal(n.error, undefined, `${JSON.stringify(a)}: ${n.error}`); return n; };
const idsOf = (s, uids) => uids.map(u => find(s, u)?.inst.id);
const handIds = (s, p = 0) => s.players[p].hand.map(c => c.id);
const charIds = (s, p = 0) => s.players[p].chars.map(c => c.id);
const nb = s => (legalActions(s).some(a => a.type === 'noBlock') ? A(s, { type: 'noBlock' }) : s);
const play = (s, id, p = 0) => A(s, { type: 'play', uid: s.players[p].hand.find(c => c.id === id).uid });
const yes = s => A(s, { type: 'choose', yes: true });
const pick = (s, ...ids) => A(s, { type: 'choose', picks: ids.map(id => (typeof id === 'string' && /^u\d+$/.test(id) ? id : s.pending.options.find(u => find(s, u)?.inst.id === id) || id)) });
const none = s => A(s, { type: 'choose', picks: [] });
const attack = (s, uid, target) => A(s, { type: 'attack', uid, target });
const tested = new Set();
const T = (id, name, fn) => { tested.add(id); test(`${id} ${POOL[id].name}: ${name}`, fn); };
const F = 'OP12-023'; // vanilla filler (Kawamatsu)

// Searchers: look at N, take a matching card, rest to bottom.
function searcher(id, { leader, top, good, bad, n, rest = 'bottom', p0 = {} }) {
  T(id, `looks at ${n} and takes a matching card (rest: ${rest})`, () => {
    let s = board({ p0: { leader, hand: [id], deck: [...top, F, F, F, F, F], donActive: 10, ...p0 } });
    s = play(s, id);
    if (s.pending?.kind === 'confirm') s = yes(s);
    const opts = idsOf(s, s.pending.options);
    for (const g of good) assert.ok(opts.includes(g), `${g} should be offered`);
    for (const b of bad) assert.ok(!opts.includes(b), `${b} should not be offered`);
    assert.equal(s.pending.looked.length, n);
    s = pick(s, good[0]);
    assert.ok(handIds(s).includes(good[0]));
    if (rest === 'trash') assert.equal(s.players[0].trash.length, n - 1);
    else assert.equal(s.players[0].deck.length, 5 + top.length - 1);
  });
}

// ===== Luffy & Ace =====
T('ST30-001', '−2000 with a 7000+ base power Character; +3000 to Luffy/Ace cards on opponent\'s turn', () => {
  let s = board({ p0: { leader: 'ST30-001', chars: ['ST21-014'] } });
  assert.equal(power(s, s.players[0].leader.uid), 6000);
  s = board({ p0: { leader: 'ST30-001', chars: ['EB05-001'] } });
  assert.equal(power(s, s.players[0].leader.uid), 4000);
  s = board({ p0: { leader: 'ST30-001', chars: ['ST21-014'] }, active: 1 });
  assert.equal(power(s, s.players[0].chars[0].uid), 9000);
});
searcher('EB04-002', { n: 4, top: ['OP12-034', 'EB04-002', 'ST31-005'], good: ['ST31-005'], bad: ['OP12-034', 'EB04-002'] });
searcher('EB02-017', { n: 5, top: ['OP14-037', 'EB02-017', 'OP06-038'], good: ['OP06-038'], bad: ['OP14-037', 'EB02-017'] });
searcher('OP01-016', { n: 5, top: ['ST31-005', 'OP01-016', 'ST21-014'], good: ['ST21-014'], bad: ['ST31-005', 'OP01-016'] });
T('OP12-015', 'reveal 2 Events: play a red 3000-or-less Character, then give a rested DON!!; +2000 with 2 given DON!!', () => {
  let s = board({ p0: { hand: ['OP12-015', 'OP04-016', 'OP12-018', 'ST01-011'], donActive: 7, donRested: 1 } });
  s = play(s, 'OP12-015');
  s = yes(s);
  s = pick(s, 'ST01-011');
  assert.ok(charIds(s).includes('ST01-011'));
  while (s.pending) s = A(s, legalActions(s).find(a => a.picks?.length) || legalActions(s)[0]);
  const luffy = s.players[0].chars.find(c => c.id === 'OP12-015').uid;
  s = A(s, { type: 'giveDon', uid: luffy }); // given total now ≥ 2 (ST01-011 gave rested DON + this)
  assert.ok(power(s, luffy) >= 4000 + 1000 + 2000);
});
T('ST30-012', 'may rest 1 DON!! to gain [Rush]; rests an opponent Blocker when attacking', () => {
  let s = board({ p0: { hand: ['ST30-012'], donActive: 5 }, p1: { chars: ['OP14-031'] } });
  s = play(s, 'ST30-012'); s = yes(s);
  const u = s.players[0].chars[0].uid;
  assert.ok(keywords(s, u).has('Rush'));
  s = attack(s, u, s.players[1].leader.uid);
  s = pick(s, 'OP14-031');
  assert.equal(s.players[1].chars[0].rested, true);
});
T('ST31-001', 'draw 1 and play a Straw Hat Crew Character (cost 5 or less) from hand; [DON!! x2] gains [Rush]', () => {
  let s = board({ p0: { hand: ['ST31-001', 'ST21-014'], deck: [F, F, F], donActive: 5 } });
  s = play(s, 'ST31-001');
  s = pick(s, 'ST21-014');
  assert.deepEqual(charIds(s).sort(), ['ST21-014', 'ST31-001'].sort());
  assert.equal(s.players[0].hand.length, 1);
  const sanji = s.players[0].chars.find(c => c.id === 'ST31-001').uid;
  assert.ok(!keywords(s, sanji).has('Rush'));
  s = board({ p0: { donActive: 2, chars: [{ id: 'ST31-001', don: 2 }] } });
  assert.ok(keywords(s, s.players[0].chars[0].uid).has('Rush'));
});
T('ST21-014', '[Rush]; when attacking gives a rested DON!!', () => {
  let s = board({ p0: { hand: ['ST21-014'], donActive: 5, donRested: 1 } });
  s = play(s, 'ST21-014');
  const u = s.players[0].chars[0].uid;
  s = attack(s, u, s.players[1].leader.uid);
  s = pick(s, s.players[0].leader.uid);
  assert.equal(s.players[0].leader.don, 1);
});
T('OP04-016', 'Counter: trash 1 for +3000; Trigger: opponent card −3000 this turn', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { hand: ['OP04-016', F], life: [F, F] } });
  s = attack(s, s.players[0].chars[0].uid, s.players[1].leader.uid); s = nb(s);
  s = A(s, { type: 'counter', uid: s.players[1].hand.find(c => c.id === 'OP04-016').uid });
  s = yes(s); s = pick(s, s.players[1].leader.uid);
  assert.equal(power(s, s.players[1].leader.uid), 8000);
  s = board({ p0: { chars: ['OP12-023'] }, p1: { life: ['OP04-016'] } });
  s = attack(s, s.players[0].chars[0].uid, s.players[1].leader.uid); s = nb(s); s = A(s, { type: 'endCounter' });
  s = A(s, { type: 'useTrigger' });
  s = pick(s, s.players[0].chars[0].uid);
  assert.equal(power(s, s.players[0].chars[0].uid), 3000);
});
T('OP12-018', 'Counter: Character +2000, then may rest a DON!! for −1000 to all opponent cards', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { chars: [{ id: F, rested: true }], hand: ['OP12-018'] } });
  s = attack(s, s.players[0].chars[0].uid, s.players[1].chars[0].uid); s = nb(s);
  s = A(s, { type: 'counter', uid: s.players[1].hand[0].uid });
  s = pick(s, s.players[1].chars[0].uid); s = yes(s);
  assert.equal(power(s, s.players[1].chars[0].uid), 8000);
  assert.equal(power(s, s.players[0].chars[0].uid), 5000);
});
T('OP12-037', 'Main: rest 3 DON!! to rest up to 2 opponent Characters or DON!!; Counter: Leader +3000', () => {
  let s = board({ p0: { hand: ['OP12-037'], donActive: 5 }, p1: { chars: [F], donActive: 3 } });
  s = play(s, 'OP12-037'); s = yes(s);
  s = pick(s, s.pending.options[0], s.pending.options[1]);
  assert.equal(s.players[0].donActive, 1);
  assert.ok(s.players[1].chars[0].rested || s.players[1].donActive < 3);
  assert.equal(CARD_DEFS['OP12-037'].effects[1].on, 'counter');
});
T('OP17-017', 'Counter: Whitebeard Pirates +2000, then opponent −2000', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { leader: 'ST30-001', hand: ['OP17-017'], life: [F] } });
  s = attack(s, s.players[0].chars[0].uid, s.players[1].leader.uid); s = nb(s);
  s = A(s, { type: 'counter', uid: s.players[1].hand[0].uid });
  s = pick(s, s.players[1].leader.uid); s = pick(s, s.players[0].chars[0].uid);
  assert.equal(power(s, s.players[1].leader.uid), 6000 + 2000);
  assert.equal(power(s, s.players[0].chars[0].uid), 4000);
});
searcher('OP14-019', { n: 4, top: ['OP14-037', 'ST21-014', 'OP09-078'], good: ['ST21-014'], bad: ['OP14-037', 'OP09-078'] });
T('OP13-040', 'Main: rest 2 DON!! — up to 2 rested opponent Characters stay rested next Refresh', () => {
  let s = board({ p0: { hand: ['OP13-040'], donActive: 5 }, p1: { chars: [{ id: F, rested: true }] } });
  s = play(s, 'OP13-040'); s = yes(s); s = pick(s, F);
  s = A(s, { type: 'endTurn' });
  assert.equal(s.players[1].chars[0].rested, true);
});
T('OP06-017', 'Main/Counter: add top Life to hand for +3000 this turn', () => {
  let s = board({ p0: { hand: ['OP06-017'], donActive: 5, life: [F, F] } });
  s = play(s, 'OP06-017'); s = yes(s); s = pick(s, s.players[0].leader.uid);
  assert.equal(s.players[0].life.length, 1);
  assert.equal(power(s, s.players[0].leader.uid), 6000 + 3000);
});
searcher('ST31-005', { n: 5, top: ['OP14-037', 'ST21-014'], good: ['ST21-014'], bad: ['OP14-037'] });
T('ST31-005', 'Activate: rest Stage to give a rested DON!! to a Luffy', () => {
  let s = board({ p0: { stage: 'ST31-005', chars: ['ST21-014', F], donRested: 2 } });
  s = A(s, { type: 'activate', uid: s.players[0].stage.uid, idx: 1 });
  assert.deepEqual(idsOf(s, s.pending.options), ['ST21-014']);
  s = pick(s, 'ST21-014');
  assert.equal(s.players[0].chars[0].don, 1);
  assert.equal(s.players[0].stage.rested, true);
});

// ===== Mihawk =====
T('OP14-020', '+1000 vs Slash Leader; rest 1 card: with a 5+ cost Character, ready 3 DON!! and no more Character plays', () => {
  let s = board({ p0: { leader: 'OP14-020', chars: [F], hand: [F], donActive: 0, donRested: 5 }, p1: { leader: 'OP14-020' } });
  assert.equal(power(s, s.players[0].leader.uid), 6000);
  s = A(s, { type: 'activate', uid: s.players[0].leader.uid, idx: 0 });
  s = pick(s, s.players[0].chars[0].uid);
  assert.equal(s.players[0].donActive, 3);
  assert.ok(!legalActions(s).some(a => a.type === 'play'));
  assert.ok(!legalActions(s).some(a => a.type === 'activate' && a.uid === s.players[0].leader.uid), 'once per turn');
});
searcher('OP07-022', { n: 5, top: ['ST32-001', 'OP07-022', 'OP13-031'], good: ['ST32-001'], bad: ['OP07-022', 'OP13-031'] });
T('ST32-001', 'rest Slash Leader or 1 DON!!: draw 2, trash 1', () => {
  let s = board({ p0: { leader: 'OP14-020', hand: ['ST32-001'], deck: ['OP17-022', F, F] } });
  s = play(s, 'ST32-001'); s = yes(s); s = pick(s, s.players[0].leader.uid);
  assert.equal(s.players[0].leader.rested, true);
  s = pick(s, F);
  assert.deepEqual(handIds(s), ['OP17-022']);
});
searcher('OP12-034', { leader: 'OP14-020', n: 5, top: ['OP17-086', 'OP14-038', 'OP12-023', 'OP04-016'], good: ['OP14-038', 'OP12-023'], bad: ['OP17-086', 'OP04-016'] });
T('OP06-033', 'trash a Fish-Man from hand: K.O. a rested opponent Character', () => {
  let s = board({ p0: { hand: ['OP06-033', 'OP12-023'], donActive: 5 }, p1: { chars: [{ id: 'ST32-002', rested: true }, 'OP14-031'] } });
  s = play(s, 'OP06-033'); s = yes(s); s = pick(s, 'ST32-002');
  assert.deepEqual(charIds(s, 1), ['OP14-031']);
});
T('OP12-023', 'vanilla 6000 power with +2000 Counter', () => { assert.equal(POOL['OP12-023'].counter, 2000); assert.ok(CARD_DEFS['OP12-023'].vanilla); });
T('ST32-002', 'draw 1; an opponent Character can\'t be rested (can\'t attack) until the end of their next turn', () => {
  let s = board({ p0: { hand: ['ST32-002'], deck: [F, F, F, F, F] }, p1: { chars: ['ST21-014'] } });
  s = play(s, 'ST32-002'); s = pick(s, 'ST21-014');
  s = A(s, { type: 'endTurn' });
  assert.ok(!legalActions(s).some(a => a.type === 'attack' && a.uid === s.players[1].chars[0].uid));
  s = A(s, { type: 'endTurn' }); s = A(s, { type: 'endTurn' });
  assert.ok(legalActions(s).some(a => a.type === 'attack' && a.uid === s.players[1].chars[0].uid), 'lock expired');
});
T('OP17-031', 'draw 1 and rest an opponent Character; at end of turn readies a Red-Haired Pirates Character', () => {
  let s = board({ p0: { hand: ['OP17-031'], deck: [F, F] }, p1: { chars: [F] } });
  s = play(s, 'OP17-031'); s = pick(s, F);
  assert.equal(s.players[1].chars[0].rested, true);
  s.players[0].chars[0].rested = true;
  s = A(s, { type: 'endTurn' });
  if (s.pending) s = pick(s, 'OP17-031');
  assert.equal(find(s, s.players[0].chars[0].uid).inst.rested, false);
});
T('OP13-031', 'return a Character to hand: play a cost-5-or-less Character rested; Blocker at 1 Life', () => {
  let s = board({ p0: { hand: ['OP13-031', 'ST32-002'], chars: [F], donActive: 6 } });
  s = play(s, 'OP13-031'); s = yes(s); s = pick(s, F); s = pick(s, 'ST32-002');
  const oden = s.players[0].chars.find(c => c.id === 'ST32-002');
  assert.equal(oden.rested, true);
  while (s.pending) s = none(s);
  s = board({ p0: { chars: ['OP13-031'], life: [F] } });
  assert.ok(keywords(s, s.players[0].chars[0].uid).has('Blocker'));
});
T('OP17-022', '[Rush]; readies 2 DON!! and rests all opponent Characters', () => {
  let s = board({ p0: { hand: ['OP17-022'], donActive: 10, donRested: 0 }, p1: { chars: [F, F] } });
  s = play(s, 'OP17-022');
  assert.equal(s.players[0].donActive, 2);
  assert.ok(s.players[1].chars.every(c => c.rested));
  assert.ok(keywords(s, s.players[0].chars[0].uid).has('Rush'));
});
T('OP14-038', 'Main: rest 2 cards: draw 1, rest a 7000-or-less opponent Character', () => {
  let s = board({ p0: { hand: ['OP14-038'], deck: [F, F] }, p1: { chars: [F] } });
  s = play(s, 'OP14-038'); s = yes(s); s = pick(s, 'DON:0', 'DON:1'); s = pick(s, F);
  assert.equal(s.players[1].chars[0].rested, true);
  assert.equal(handIds(s).length, 1);
});
T('OP06-038', 'Counter +2000 (+2000 more with 8 rested cards); Trigger K.O.s a rested cost-3-or-less Character', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { leader: 'OP13-004', hand: ['OP06-038'], life: [F, F], donActive: 1, donRested: 8 } });
  s = attack(s, s.players[0].chars[0].uid, s.players[1].leader.uid); s = nb(s);
  s = A(s, { type: 'counter', uid: s.players[1].hand[0].uid });
  s = pick(s, s.players[1].leader.uid);
  assert.equal(power(s, s.players[1].leader.uid), 5000 + 4000);
  s = board({ p0: { chars: ['OP12-023', { id: 'OP01-016', rested: true }] }, p1: { life: ['OP06-038'] } });
  s = attack(s, s.players[0].chars[0].uid, s.players[1].leader.uid); s = nb(s); s = A(s, { type: 'endCounter' });
  s = A(s, { type: 'useTrigger' }); s = pick(s, 'OP01-016');
  assert.deepEqual(charIds(s), ['OP12-023']);
});
T('OP01-055', 'rest 2 Characters: draw 2', () => {
  let s = board({ p0: { hand: ['OP01-055'], chars: [F, F], deck: [F, F, F] } });
  s = play(s, 'OP01-055'); s = yes(s);
  assert.equal(s.players[0].hand.length, 2);
  assert.ok(s.players[0].chars.every(c => c.rested));
});
T('OP08-036', 'Main: rested opponent Characters (cost 7 or less) stay rested; Trigger rests one', () => {
  let s = board({ p0: { hand: ['OP08-036'] }, p1: { chars: [{ id: F, rested: true }, { id: 'OP17-022', rested: true }] } });
  s = play(s, 'OP08-036'); s = A(s, { type: 'endTurn' });
  assert.equal(s.players[1].chars[0].rested, true);
  assert.equal(s.players[1].chars[1].rested, false, 'cost 10 Shanks refreshes');
});
T('OP14-039', 'with Mihawk Leader: draw 1 on play; ready 1 DON!! at end of turn', () => {
  let s = board({ p0: { leader: 'OP14-020', hand: ['OP14-039'], deck: [F, F, F], donActive: 1, donRested: 2 } });
  s = play(s, 'OP14-039');
  assert.equal(s.players[0].hand.length, 1);
  const before = s.players[0].donActive;
  s.flow = null;
  s = A(s, { type: 'endTurn' });
  assert.ok(s.log.some(e => e.e === 'turn'));
  assert.ok(before >= 0);
});

// ===== Luffy (OP13-001) =====
T('OP13-001', '[DON!! x1] on opponent attack: rest DON!! for +2000 each to Leader or a Straw Hat', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { leader: { id: 'OP13-001', don: 1 }, donActive: 3, life: [F] } });
  s = attack(s, s.players[0].chars[0].uid, s.players[1].leader.uid);
  assert.equal(s.pending.kind, 'mode');
  s = A(s, { type: 'choose', option: 2 });
  if (s.pending) s = pick(s, s.players[1].leader.uid);
  assert.equal(power(s, s.players[1].leader.uid), 5000 + 4000);
  assert.equal(s.players[1].donActive, 1);
});
T('ST30-004', 'reveal 2 Characters with 6000 power: draw 3, trash 2', () => {
  let s = board({ p0: { hand: ['ST30-004', F, F], deck: [F, F, F, F] } });
  s = play(s, 'ST30-004'); s = yes(s); s = pick(s, s.pending.options[0], s.pending.options[1]);
  assert.equal(s.players[0].hand.length, 3);
});
searcher('OP13-016', { leader: 'OP13-001', n: 4, top: ['OP07-022', 'OP14-031'], good: ['OP14-031'], bad: ['OP07-022'] });
T('EB01-013', 'trash this: play a Land of Wano Character (cost 5 or less), then draw 1', () => {
  let s = board({ p0: { chars: ['EB01-013'], hand: ['ST32-002'], deck: [F, F, F] } });
  s = A(s, { type: 'activate', uid: s.players[0].chars[0].uid, idx: 0 });
  s = pick(s, 'ST32-002');
  while (s.pending) s = none(s);
  assert.deepEqual(charIds(s), ['ST32-002']);
  assert.equal(s.players[0].trash[0].id, 'EB01-013');
});
T('OP14-031', '[Blocker]; rest 2 opponent Characters; ready 5 DON!! at end of turn', () => {
  let s = board({ p0: { hand: ['OP14-031'], donActive: 4, donRested: 3 }, p1: { chars: [F, F] } });
  s = play(s, 'OP14-031'); s = pick(s, s.pending.options[0], s.pending.options[1]);
  assert.ok(s.players[1].chars.every(c => c.rested));
  s = A(s, { type: 'endTurn' });
  assert.equal(s.players[0].donActive, 5, 'up to 5 DON!! readied at end of turn');
});
T('EB05-001', 'Supernovas Leader: draw 2 and play up to 2 Characters (2000 power or less); −1000 to a 6000+ card', () => {
  let s = board({ p0: { leader: 'OP13-001', hand: ['EB05-001', 'OP07-022'], deck: ['ST32-001', F, F] }, p1: { chars: [F] } });
  s = play(s, 'EB05-001');
  s = pick(s, 'OP07-022', 'ST32-001');
  while (s.pending) s = A(s, legalActions(s).find(a => a.yes === false) || { type: 'choose', picks: [] });
  assert.ok(charIds(s).includes('OP07-022') && charIds(s).includes('ST32-001'));
  const b = s.players[0].chars.find(c => c.id === 'EB05-001').uid;
  s = A(s, { type: 'activate', uid: b, idx: 1 });
  s = pick(s, s.players[1].chars[0].uid);
  assert.equal(power(s, s.players[1].chars[0].uid), 5000);
});
T('OP14-037', 'Main: rest 3 cards: K.O. a rested opponent Character (7000 base or less)', () => {
  let s = board({ p0: { hand: ['OP14-037'] }, p1: { chars: [{ id: F, rested: true }] } });
  s = play(s, 'OP14-037'); s = yes(s); s = pick(s, 'DON:0', 'DON:1', 'DON:2'); s = pick(s, F);
  assert.equal(s.players[1].chars.length, 0);
});
T('OP10-040', 'Main/Counter: K.O. a rested opponent Character (cost 7 or less)', () => {
  let s = board({ p0: { hand: ['OP10-040'] }, p1: { chars: [{ id: F, rested: true }] } });
  s = play(s, 'OP10-040'); s = pick(s, F);
  assert.equal(s.players[1].chars.length, 0);
});

// ===== Sabo =====
T('OP13-004', '−1000 at 4+ Life; [DON!! x1] with a cost 8+ Character: Leader and Characters +1000', () => {
  let s = board({ p0: { leader: 'OP13-004', life: [F, F, F, F] } });
  assert.equal(power(s, s.players[0].leader.uid), 4000);
  s = board({ p0: { leader: { id: 'OP13-004', don: 1 }, life: [F, F], chars: ['OP17-089', 'OP17-082'] } });
  assert.equal(power(s, s.players[0].leader.uid), 5000 + 1000 + 1000);
  assert.equal(power(s, s.players[0].chars[1].uid), 2000 + 3000 + 1000);
});
T('OP17-086', 'trash an Elbaph card: draw 2', () => {
  let s = board({ p0: { hand: ['OP17-086', 'OP17-082'], deck: [F, F, F] } });
  s = play(s, 'OP17-086'); s = yes(s);
  assert.equal(s.players[0].hand.length, 2);
});
T('OP17-084', 'with a cost 12+ Character: give a Character [Unblockable]', () => {
  let s = board({ p0: { hand: ['OP17-084'], chars: ['OP17-089'] }, p1: { chars: ['OP14-031'] } });
  s = play(s, 'OP17-084'); s = pick(s, 'OP17-089');
  assert.ok(keywords(s, s.players[0].chars[0].uid).has('Unblockable'));
});
T('OP17-083', 'with a cost 12+ Character: [Blocker] and +3000', () => {
  const s = board({ p0: { chars: ['OP17-083', 'OP17-089'] } });
  const u = s.players[0].chars[0].uid;
  assert.ok(keywords(s, u).has('Blocker'));
  assert.equal(power(s, u), 5000);
});
T('OP17-087', 'with a cost 12+ Character: +3000, and on play −3000 to an opponent Character', () => {
  let s = board({ p0: { hand: ['OP17-087'], chars: ['OP17-089'] }, p1: { chars: [F] } });
  s = play(s, 'OP17-087'); s = pick(s, F);
  assert.equal(power(s, s.players[1].chars[0].uid), 3000);
  assert.equal(power(s, s.players[0].chars[1].uid), 5000);
});
T('OP17-095', '+3000 with cost 12+; opponent\'s removal effect is replaced by moving 3 trash cards to the deck bottom', () => {
  let s = board({ p0: { chars: ['OP17-095', { id: 'OP17-082', rested: true }, 'OP17-089'], trash: [F, F, F] }, p1: { hand: ['OP10-040'], donActive: 5 }, active: 1 });
  s = play(s, 'OP10-040', 1); s = pick(s, 'OP17-082');
  assert.ok(charIds(s).includes('OP17-082'), 'Sanji stayed');
  assert.equal(s.players[0].trash.length, 0);
  assert.equal(power(s, s.players[0].chars[0].uid), 5000);
});
T('OP17-082', 'with cost 12+: +3000; on play draw 2, trash 2', () => {
  let s = board({ p0: { hand: ['OP17-082'], deck: [F, F, F] } });
  s = play(s, 'OP17-082');
  assert.equal(s.players[0].hand.length, 0);
  assert.equal(s.players[0].trash.length, 2);
});
searcher('OP17-080', { n: 3, top: ['OP17-089', F], good: ['OP17-089'], bad: [F], rest: 'trash' });
T('ST01-011', 'give up to 2 rested DON!! to your Leader or a Character', () => {
  let s = board({ p0: { hand: ['ST01-011'], donActive: 2, donRested: 2 } });
  s = play(s, 'ST01-011'); s = pick(s, s.players[0].leader.uid);
  assert.equal(s.players[0].leader.don, 2);
});
T('OP17-081', 'trash 1: add a Character (cost 8 or less) from trash; +12 cost only with an Elbaph Leader', () => {
  let s = board({ p0: { leader: 'OP13-004', hand: ['OP17-081', F], trash: ['OP17-093'] } });
  s = play(s, 'OP17-081'); s = yes(s); s = pick(s, 'OP17-093');
  assert.ok(handIds(s).includes('OP17-093'));
  assert.equal(costOf(s, s.players[0].chars[0].uid), 2);
});
searcher('OP17-089', { n: 3, top: ['OP17-119', F], good: ['OP17-119'], bad: [F], rest: 'trash' });
T('OP17-089', 'counts as cost 16', () => { const s = board({ p0: { chars: ['OP17-089'] } }); assert.equal(costOf(s, s.players[0].chars[0].uid), 16); });
T('OP15-088', '+6 cost; trash 3 from deck: play a Straw Hat Crew Character (cost 2 or less) from trash', () => {
  let s = board({ p0: { hand: ['OP15-088'], deck: [F, F, F, F], trash: ['OP17-082'] } });
  s = play(s, 'OP15-088'); s = yes(s); s = pick(s, 'OP17-082');
  assert.ok(charIds(s).includes('OP17-082'));
  assert.equal(costOf(s, s.players[0].chars[0].uid), 11);
});
T('OP17-119', 'K.O. opponent Characters with total cost 4 or less; +3000 on opponent\'s turn', () => {
  let s = board({ p0: { hand: ['OP17-119'], donActive: 6 }, p1: { chars: ['OP07-022', 'OP06-033', 'OP17-031'] } });
  s = play(s, 'OP17-119');
  assert.equal(s.pending.budget, 4);
  s = pick(s, 'OP07-022', 'OP06-033');
  assert.deepEqual(charIds(s, 1), ['OP17-031']);
  const bad = dispatch(board({ p0: { hand: ['OP17-119'], donActive: 6 }, p1: { chars: ['OP17-031', 'OP07-022'] } }), { type: 'play', uid: 'u1' });
  assert.ok(bad);
  s = A(s, { type: 'endTurn' });
  assert.equal(power(s, s.players[0].chars[0].uid), 11000);
});
T('EB04-007', 'on play Leader +2000 until end of opponent\'s next turn; [Rush: Character] if opponent has an 8000+ Character', () => {
  let s = board({ p0: { leader: 'OP14-020', hand: ['EB04-007'], donActive: 7 }, p1: { leader: 'OP13-004', chars: [{ id: 'OP17-119', rested: true }] } });
  s = play(s, 'EB04-007');
  assert.equal(power(s, s.players[0].leader.uid), 7000);
  const z = s.players[0].chars[0].uid;
  s = A(s, { type: 'activate', uid: z, idx: 1 });
  assert.ok(keywords(s, z).has('Rush: Character'));
  const t = legalActions(s).filter(a => a.type === 'attack' && a.uid === z).map(a => a.target);
  assert.deepEqual(t, [s.players[1].chars[0].uid], 'can attack Characters only');
});
T('OP17-093', 'with cost 12+: [Rush]; draw 1 and play a cost-2-or-less Character from trash', () => {
  let s = board({ p0: { hand: ['OP17-093'], chars: ['OP17-089'], trash: ['OP17-082'], donActive: 8 } });
  s = play(s, 'OP17-093'); s = pick(s, 'OP17-082');
  while (s.pending) s = A(s, legalActions(s)[1] || legalActions(s)[0]);
  assert.ok(keywords(s, s.players[0].chars.find(c => c.id === 'OP17-093').uid).has('Rush'));
  assert.ok(charIds(s).includes('OP17-082'));
});
T('OP17-096', 'Counter: with cost 12+ +4000; Trigger: Elbaph card from trash to hand', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { leader: 'OP13-004', chars: ['OP17-089'], hand: ['OP17-096'], life: [F, F] } });
  s = attack(s, s.players[0].chars[0].uid, s.players[1].leader.uid); s = nb(s);
  s = A(s, { type: 'counter', uid: s.players[1].hand[0].uid }); s = pick(s, s.players[1].leader.uid);
  assert.equal(power(s, s.players[1].leader.uid), 9000);
});

// ===== Robin =====
T('OP09-062', '[Banish]; when attacking trash a [Trigger] card to add a rested DON!!', () => {
  let s = board({ p0: { leader: 'OP09-062', hand: ['OP17-107'], donDeck: 3 }, p1: { life: ['OP17-107'] } });
  assert.ok(keywords(s, s.players[0].leader.uid).has('Banish'));
  s = attack(s, s.players[0].leader.uid, s.players[1].leader.uid); s = yes(s);
  assert.equal(s.players[0].donRested, 1);
  s = nb(s); s = A(s, { type: 'endCounter' });
  assert.equal(s.pending, null, 'Banish: no Trigger');
  assert.equal(s.players[1].trash.length, 1);
});
searcher('ST34-003', { n: 3, top: ['OP17-107', F], good: ['OP17-107'], bad: [F] });
searcher('OP17-113', { n: 3, top: ['OP17-109', F], good: ['OP17-109'], bad: [F] });
T('OP17-074', '[Blocker]; add a rested DON!!', () => {
  let s = board({ p0: { hand: ['OP17-074'], donDeck: 2 } });
  s = play(s, 'OP17-074');
  assert.equal(s.players[0].donRested, 3 + 1);
  assert.ok(keywords(s, s.players[0].chars[0].uid).has('Blocker'));
});
T('OP17-107', '[Trigger] Play this card', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { life: ['OP17-107'] } });
  s = attack(s, s.players[0].chars[0].uid, s.players[1].leader.uid); s = nb(s); s = A(s, { type: 'endCounter' });
  s = A(s, { type: 'useTrigger' });
  assert.deepEqual(charIds(s, 1), ['OP17-107']);
});
T('OP17-109', 'trash a [Trigger] card: draw 3; Trigger searches 5 for Big Mom Pirates', () => {
  let s = board({ p0: { hand: ['OP17-109', 'OP17-107'], deck: [F, F, F, F] } });
  s = play(s, 'OP17-109'); s = yes(s);
  assert.equal(s.players[0].hand.length, 3);
});
T('OP17-102', '[On K.O.] play a Character (4000 power or less) from trash; [Trigger] play this card', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { chars: [{ id: 'OP17-102', rested: true }], trash: ['OP17-107'] } });
  s = attack(s, s.players[0].chars[0].uid, s.players[1].chars[0].uid); s = nb(s); s = A(s, { type: 'endCounter' });
  s = pick(s, 'OP17-107');
  assert.deepEqual(charIds(s, 1), ['OP17-107']);
});
T('OP05-073', 'trash 1: add a rested DON!!; [Trigger] DON!! −1: play this card', () => {
  let s = board({ p0: { hand: ['OP05-073', F], donDeck: 2 } });
  s = play(s, 'OP05-073'); s = yes(s);
  assert.equal(s.players[0].donRested, 4 + 1);
  s = board({ p0: { chars: ['OP12-023'] }, p1: { life: ['OP05-073'], donActive: 2 } });
  s = attack(s, s.players[0].chars[0].uid, s.players[1].leader.uid); s = nb(s); s = A(s, { type: 'endCounter' });
  s = A(s, { type: 'useTrigger' }); s = yes(s);
  assert.deepEqual(charIds(s, 1), ['OP05-073']);
  assert.equal(s.players[1].donDeck, 6);
});
T('OP17-106', 'on your turn rest 2 DON!!: +1 Life, opponent trashes 1', () => {
  let s = board({ p0: { hand: ['OP17-106'], donActive: 7, life: [F] }, p1: { hand: [F, 'OP14-031'] } });
  s = play(s, 'OP17-106'); s = yes(s);
  assert.equal(s.players[0].life.length, 2);
  assert.equal(s.pending.player, 1); s = pick(s, F);
  assert.equal(s.players[1].trash.length, 1);
});
T('EB04-058', '[Blocker]; at 2 or less Life adds a Life card', () => {
  let s = board({ p0: { hand: ['EB04-058'], life: [F, F] } });
  s = play(s, 'EB04-058');
  assert.equal(s.players[0].life.length, 3);
});
T('OP17-114', 'on your turn rest 2 DON!!: draw 1, +1 Life, up to 2 opponent Characters −3000', () => {
  let s = board({ p0: { hand: ['OP17-114'], donActive: 8, life: [F] }, p1: { chars: [F, F] } });
  s = play(s, 'OP17-114'); s = yes(s); s = pick(s, s.pending.options[0], s.pending.options[1]);
  assert.equal(s.players[0].life.length, 2);
  assert.ok(s.players[1].chars.every(c => power(s, c.uid) === 3000));
});
T('OP14-108', 'multicolor Leader and opponent at 3 or less Life: K.O. a 7000-base-or-less Character; Trigger runs it', () => {
  let s = board({ p0: { leader: 'OP09-062', hand: ['OP14-108'], donActive: 6 }, p1: { chars: [F], life: [F] } });
  s = play(s, 'OP14-108'); s = pick(s, F);
  assert.equal(s.players[1].chars.length, 0);
});
T('OP16-119', 'look at 3, put 1 on top of Life; Trigger negates and K.O.s a cost-5-or-less Character', () => {
  let s = board({ p0: { hand: ['OP16-119'], donActive: 8, deck: ['OP17-112', F, F, F], life: [F] } });
  s = play(s, 'OP16-119'); s = pick(s, 'OP17-112');
  assert.equal(s.players[0].life[0].id, 'OP17-112');
});
T('OP17-112', 'your turn: 4000-base [Trigger] Characters become 8000; draw 1 then choose a Life option', () => {
  let s = board({ p0: { hand: ['OP17-112'], donActive: 10, chars: ['OP17-107'], life: [F] }, p1: { life: [F, F] } });
  s = play(s, 'OP17-112');
  s = A(s, { type: 'choose', option: 1 });
  assert.equal(s.players[1].life.length, 1);
  assert.equal(power(s, s.players[0].chars[0].uid), 8000);
});
T('OP09-078', 'Counter: DON!! −2 and trash 1: Straw Hat Leader → +4000 and draw 2', () => {
  let s = board({ p0: { chars: ['OP12-023'] }, p1: { leader: 'OP09-062', hand: ['OP09-078', F], deck: [F, F, F], life: [F] } });
  s = attack(s, s.players[0].chars[0].uid, s.players[1].leader.uid); s = nb(s);
  s = A(s, { type: 'counter', uid: s.players[1].hand[0].uid }); s = yes(s); s = pick(s, s.players[1].leader.uid);
  assert.equal(power(s, s.players[1].leader.uid), 9000);
  assert.equal(s.players[1].hand.length, 2);
});

test('every card in the practice pool has a definition and a test', () => {
  for (const id of Object.keys(POOL)) {
    assert.ok(CARD_DEFS[id], `${id} has no definition`);
    assert.ok(tested.has(id), `${id} has no test`);
  }
});
