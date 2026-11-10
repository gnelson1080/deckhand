// Effects for every card in the practice-game pool, transcribed from the printed text (see js/game/pool-data.js).
// Shape per card: { kw?: string[], aura?(view, src, target, targetOwner) -> {power?, keywords?, basePower?} | null,
//   costMod?(view, self) -> number, effects?: [{ on, steps, once?, key?, don?, yourTurn?, cond?, costCheck?, restSelf? }] }
// Step reference: js/game/effects.js.

import { removeToBottom, removeToHand, playCharacter, def, costOf } from '../engine.js';

const look = (n, filter, rest = 'bottom', extra = {}) => ({ do: 'look', n, filter, take: 1, rest, ...extra });
const may = (cost, prompt) => ({ do: 'may', cost, prompt });
const ifc = (cond, then) => ({ do: 'if', cond, then });
const draw = n => ({ do: 'draw', n });
const battlePlus = (amount, filter = {}) => ({ do: 'power', side: 'me', amount, until: 'battle', filter, prompt: `Choose your Leader or a Character to get +${amount} power this battle.` });
const leaderPlus3000 = { on: 'counter', steps: [{ do: 'power', target: 'leader', side: 'me', amount: 3000, until: 'battle' }] };
const cost12 = v => v.anyCharCostAtLeast(12);
const shc = 'Straw Hat Crew';

const rp = 'Rocks Pirates';
const newgate = [may({ trashHand: { n: 1 } }, 'Edward.Newgate: trash 1 card from your hand to give your Leader +3000 power this battle?'), { do: 'power', target: 'leader', side: 'me', amount: 3000, until: 'battle' }];

export const CARD_DEFS = {
  // ===== Blue Rocks (OP17-039) =====
  'OP17-039': { effects: [{ on: 'whenAttacking', steps: [
    may({ trashHand: { n: 1 } }, 'Trash 1 card from your hand to reveal your top card? If it is a Rocks Pirates card, you draw 2.'),
    { do: 'custom', fn: (s, f, ans, { P }) => {
      const top = P.deck[0]; if (!top) return;
      s.log.push({ t: s.turn, e: 'reveal', p: f.owner, id: top.id });
      if (def(top.id).traits.some(t => t.includes(rp))) for (let i = 0; i < 2 && P.deck.length; i++) P.hand.push(P.deck.shift());
    } },
  ] }] },
  'OP08-051': { vanilla: true }, // its effect only helps [Edward Weevil], which this deck doesn't play
  'OP17-050': { effects: [{ on: 'onPlay', steps: [{ do: 'custom', fn: (s, f, ans, { P, ask }) => {
    const looked = P.deck.slice(0, 2).map(c => c.uid);
    const picks = ask({ options: looked, min: 0, max: looked.length, prompt: 'Choose cards to put on the bottom of your deck. The rest stay on top.', show: 'look' });
    if (!picks) { s.pending.looked = looked; return 'wait'; }
    for (const u of picks) P.deck.push(...P.deck.splice(P.deck.findIndex(c => c.uid === u), 1));
    if (P.deck.length) P.hand.push(P.deck.shift());
  } }] }] },
  'OP17-045': { effects: [
    { on: 'onPlay', steps: [draw(1)] },
    { on: 'replace', steps: [{ do: 'trashHand', n: 2 }] }, // used by engine.replaceRemoval
  ] },
  'OP17-052': { effects: [{ on: 'onPlay', steps: [{ do: 'addFromTrash', filter: { type: 'Event', color: 'Blue', maxCost: 0 } }] }] },
  'OP17-054': { effects: [
    { on: 'onPlay', steps: [{ do: 'lock', side: 'opp', filter: { maxBaseCost: 6 }, what: 'cannotAttack', until: 'oppNextEnd', prompt: "Choose an opponent's Character (base cost 6 or less) that can't attack next turn." }] },
    { on: 'activateMain', restSelf: true, costCheck: v => v.donActive(v.me) >= 3, steps: [{ do: 'pay', k: 'restDon', v: 3 }, { do: 'lock', side: 'opp', what: 'cannotAttack', until: 'oppNextEnd', prompt: "Choose an opponent's Character that can't attack next turn." }] },
  ] },
  'OP17-046': { kw: ['Blocker'], effects: [{ on: 'onPlay', steps: [{ do: 'custom', fn: (s, f, ans, { ask }) => {
    const opts = [0, 1].flatMap(p => s.players[p].chars).filter(c => c.uid !== f.src && costOf(s, c.uid) <= 5).map(c => c.uid);
    const picks = ask({ options: opts, min: 0, max: 1, prompt: 'Choose a Character with a cost of 5 or less to put at the bottom of its owner\'s deck.' });
    if (!picks) return 'wait';
    for (const u of picks) removeToBottom(s, u, f.owner);
  } }] }] },
  'OP17-042': { kw: ['Blocker'], effects: [{ on: 'onPlay', steps: [
    may({ revealHand: { n: 3, filter: { traitIncludes: rp } } }, 'Reveal 3 Rocks Pirates cards from your hand to give an opponent\'s Character −3000 power this turn?'),
    { do: 'power', side: 'opp', amount: -3000, until: 'turn', includeLeader: false, prompt: "Choose an opponent's Character to get −3000 power." },
  ] }] },
  'OP17-044': { effects: [{ on: 'activateMain', restSelf: true, steps: [draw(1), { do: 'trashHand', n: 1 }] }] }, // attack-target rule lives in engine
  'OP17-049': { effects: [
    { on: 'onPlay', steps: [{ do: 'custom', fn: (s, f, ans, { P, ask }) => {
      const o = 1 - f.owner, Q = s.players[o];
      if (f.ctx.linlin == null) {
        if (!ans) { s.pending = { player: o, kind: 'mode', labels: ['Your opponent draws 2 cards', 'You trash 2 cards from your hand'], prompt: 'Charlotte Linlin: you choose one.' }; return 'wait'; }
        f.ctx.linlin = ans.option; ans = undefined;
        if (f.ctx.linlin === 0) { for (let i = 0; i < 2 && P.deck.length; i++) P.hand.push(P.deck.shift()); return; }
      }
      if (f.ctx.linlin !== 1) return;
      const n = Math.min(2, Q.hand.length);
      const picks = ans ? ans.picks : (n ? null : []);
      if (!picks) { s.pending = { player: o, kind: 'pick', options: Q.hand.map(c => c.uid), min: n, max: n, prompt: `Choose ${n} card${n > 1 ? 's' : ''} to trash from your hand.`, show: 'hand' }; return 'wait'; }
      for (const u of picks) { const i = Q.hand.findIndex(c => c.uid === u); if (i >= 0) Q.trash.push(...Q.hand.splice(i, 1)); }
    } }] },
    { on: 'onOppAttack', once: true, steps: [may({ trashHand: { n: 1 } }, 'Charlotte Linlin: trash 1 card from your hand for +1000 power this battle?'), battlePlus(1000)] },
  ] },
  'OP17-040': { effects: [
    { on: 'onPlay', steps: [draw(1)] },
    { on: 'leaderAttacks', once: true, key: 'ng', steps: newgate },
    { on: 'onOppAttack', once: true, key: 'ng', cond: v => v.s.battle?.target === v.leader(v.me).uid, steps: newgate },
  ] },
  'OP17-048': { kw: ['Rush: Character'], effects: ['whenAttacking', 'onOppAttack'].map(on => ({ on, once: true, key: 'sk', steps: [
    may({ trashHand: { n: 1, filter: { traitIncludes: rp } } }, 'Shiki: trash a Rocks Pirates card from your hand to give an opponent\'s Character −3000 power this turn?'),
    { do: 'power', side: 'opp', amount: -3000, until: 'turn', includeLeader: false, prompt: "Choose an opponent's Character to get −3000 power." },
  ] })) },
  'OP17-118': {
    handCounter: v => (v.chars(v.me).every(c => !v.def(c.uid).counter) ? 2000 : 0),
    effects: [{ on: 'onPlay', steps: [draw(1), { do: 'custom', fn: (s, f, ans, { P, ask }) => {
      const opts = P.hand.filter(c => def(c.id).type === 'Character' && def(c.id).traits.some(t => t.includes(rp))).map(c => c.uid);
      let picks = ask({ options: opts, min: 0, max: 2, budget: 9, prompt: 'Play up to 2 Rocks Pirates with different names and a total cost of 9 or less.', show: 'hand' });
      if (!picks) return 'wait';
      const names = new Set(); let total = 0;
      picks = picks.filter(u => { const d = def(P.hand.find(c => c.uid === u)?.id); if (!d || names.has(d.name) || total + (d.cost ?? 0) > 9) return false; names.add(d.name); total += d.cost ?? 0; return true; });
      for (const u of picks) {
        const i = P.hand.findIndex(c => c.uid === u); if (i < 0) continue;
        const [inst] = P.hand.splice(i, 1);
        playCharacter(s, f.owner, inst, { fromEffect: true });
        if (s.pending) break;
      }
    } }] }],
  },
  'OP17-055': { effects: [
    { on: 'main', steps: [may({ restDon: 1 }, 'Rest 1 DON!! to give your Rocks.D.Xebec [Unblockable] this turn?'), { do: 'keyword', kw: 'Unblockable', until: 'turn', filter: { name: 'Rocks.D.Xebec' }, prompt: 'Choose your Rocks.D.Xebec.' }] },
    { on: 'counter', steps: [battlePlus(2000, { traitIncludes: rp })] },
  ] },
  'OP17-056': { effects: [
    { on: 'main', steps: [may({ restDon: 5 }, 'Rest 5 DON!! to return a Character with a cost of 6 or less to its owner\'s hand?'), { do: 'custom', fn: (s, f, ans, { ask }) => {
      const opts = [0, 1].flatMap(p => s.players[p].chars).filter(c => costOf(s, c.uid) <= 6).map(c => c.uid);
      const picks = ask({ options: opts, min: 0, max: 1, prompt: "Choose a Character with a cost of 6 or less to return to its owner's hand." });
      if (!picks) return 'wait';
      for (const u of picks) removeToHand(s, u, f.owner);
    } }] },
    { on: 'counter', steps: [battlePlus(2000, { traitIncludes: rp })] },
  ] },

  // ===== Red/Green Luffy & Ace (ST30-001) =====
  'ST30-001': {
    aura: (v, src, tgt, owner) => {
      let power = 0;
      if (tgt.uid === src.uid && v.chars(v.me).some(c => v.basePower(c.uid) >= 7000)) power -= 2000;
      if (!v.isMyTurn && owner === v.me && tgt.uid !== src.uid && ['Portgas.D.Ace', 'Monkey.D.Luffy'].includes(v.name(tgt.uid))) power += 3000;
      return power ? { power } : null;
    },
  },
  'EB04-002': { effects: [{ on: 'onPlay', steps: [look(4, { traitAny: ['Egghead', shc], notName: 'Jewelry Bonney' })] }] },
  'EB02-017': { effects: [{ on: 'onPlay', steps: [look(5, { traitIncludes: shc, notName: 'Nami' })] }] },
  'OP01-016': { effects: [{ on: 'onPlay', steps: [look(5, { traitIncludes: shc, type: 'Character', notName: 'Nami' })] }] },
  'OP12-015': {
    aura: (v, src, tgt) => (tgt.uid === src.uid && v.givenTotal(v.me) >= 2 ? { power: 2000 } : null),
    effects: [{ on: 'onPlay', steps: [
      may({ revealHand: { n: 2, filter: { type: 'Event' } } }, 'Reveal 2 Events from your hand to play a red Character with 3000 power or less?'),
      { do: 'playFrom', zone: 'hand', filter: { type: 'Character', color: 'Red', maxPower: 3000 } },
      { do: 'giveRestedDon', n: 1 },
    ] }],
  },
  'ST30-012': { effects: [
    { on: 'onPlay', steps: [may({ restDon: 1 }, 'Rest 1 DON!! to give this Luffy [Rush] this turn?'), { do: 'keyword', target: 'self', kw: 'Rush', until: 'turn' }] },
    { on: 'whenAttacking', steps: [{ do: 'rest', side: 'opp', n: 1, filter: { kw: 'Blocker' }, prompt: "Choose an opponent's [Blocker] to rest." }] },
  ] },
  'ST31-001': {
    aura: (v, src, tgt) => (tgt.uid === src.uid && src.don >= 2 ? { keywords: ['Rush'] } : null),
    effects: [{ on: 'onPlay', steps: [draw(1), { do: 'playFrom', zone: 'hand', filter: { type: 'Character', traitAny: [shc], maxCost: 5, notName: 'Sanji' } }] }],
  },
  'ST21-014': { kw: ['Rush'], effects: [{ on: 'whenAttacking', steps: [{ do: 'giveRestedDon', n: 1 }] }] },
  'OP04-016': { effects: [
    { on: 'counter', steps: [may({ trashHand: { n: 1 } }, 'Trash 1 card from your hand for +3000 power?'), battlePlus(3000)] },
    { on: 'trigger', steps: [{ do: 'power', side: 'opp', amount: -3000, until: 'turn', prompt: "Choose an opponent's card to get −3000 power." }] },
  ] },
  'OP12-018': { effects: [{ on: 'counter', steps: [
    battlePlus(2000, { any: [{ type: 'Character' }, { name: 'Silvers Rayleigh' }] }),
    may({ restDon: 1 }, "Rest 1 DON!! to give your opponent's Leader and all their Characters −1000 this turn?"),
    { do: 'power', target: 'allSide', side: 'opp', amount: -1000, until: 'turn' },
  ] }] },
  'OP12-037': { effects: [
    { on: 'main', steps: [may({ restDon: 3 }, 'Rest 3 DON!! to rest up to 2 of your opponent\'s Characters or DON!!?'), { do: 'rest', side: 'opp', n: 2, includeDon: true }] },
    leaderPlus3000,
  ] },
  'OP17-017': { effects: [{ on: 'counter', steps: [
    battlePlus(2000, { traitIncludes: 'Whitebeard Pirates' }),
    { do: 'power', side: 'opp', amount: -2000, until: 'turn', prompt: "Choose an opponent's card to get −2000 power." },
  ] }] },
  'OP14-019': { effects: [
    { on: 'main', steps: [look(4, { type: 'Character', traitAny: ['Supernovas', shc] })] },
    { on: 'trigger', steps: [draw(1)] },
  ] },
  'OP13-040': { effects: [
    { on: 'main', steps: [may({ restDon: 2 }, "Rest 2 DON!! so up to 2 of your opponent's rested Characters stay rested?"), { do: 'lock', side: 'opp', n: 2, filter: { rested: true, maxCost: 7 }, what: 'noRefresh', until: 'refresh' }] },
    leaderPlus3000,
  ] },
  'OP06-017': { effects: ['main', 'counter'].map(on => ({ on, steps: [may({ lifeToHand: 1 }, 'Add your top Life card to your hand for +3000 power this turn?'), { do: 'power', side: 'me', amount: 3000, until: 'turn' }] })) },
  'ST31-005': { effects: [
    { on: 'onPlay', steps: [look(5, { traitAny: [shc] })] },
    { on: 'activateMain', restSelf: true, costCheck: v => v.P(v.me).donRested > 0, steps: [{ do: 'giveRestedDon', n: 1, filter: { name: 'Monkey.D.Luffy' } }] },
  ] },

  // ===== Green Mihawk (OP14-020) =====
  'OP14-020': {
    aura: (v, src, tgt) => (tgt.uid === src.uid && v.leaderAttr(v.opp).includes('Slash') ? { power: 1000 } : null),
    effects: [{ on: 'activateMain', once: true, key: 'mihawk', costCheck: v => v.P(v.me).donActive + v.chars(v.me).filter(c => !c.rested).length + (v.leader(v.me).rested ? 0 : 1) >= 1, steps: [
      { do: 'pay', k: 'restCards', v: 1 },
      ifc(v => v.anyCharCostAtLeast(5), [{ do: 'setDonActive', n: 3 }, { do: 'lock', target: 'leaderSelf', what: 'noCharPlay', until: 'turn' }]),
    ] }],
  },
  'OP07-022': { effects: [{ on: 'onPlay', steps: [look(5, { color: 'Green', traitAny: ['Land of Wano'], notName: 'Otama' })] }] },
  'ST32-001': { effects: [{ on: 'onPlay', steps: [may({ restLeaderAttrOrDon: 'Slash' }, 'Rest your <Slash> Leader or 1 DON!! to draw 2 and trash 1?'), draw(2), { do: 'trashHand', n: 1 }] }] },
  'OP12-034': { effects: [{ on: 'onPlay', steps: [ifc(v => v.leaderAttr(v.me).includes('Slash'), [look(5, { any: [{ attr: 'Slash' }, { type: 'Event', color: 'Green' }] })])] }] },
  'OP06-033': { effects: [{ on: 'onPlay', steps: [may({ trashHand: { n: 1, filter: { traitIncludes: 'Fish-Man' } } }, 'Trash a Fish-Man card from your hand to K.O. a rested opponent Character?'), { do: 'ko', side: 'opp', filter: { rested: true } }] }] },
  'OP12-023': { vanilla: true },
  'ST32-002': { effects: [{ on: 'onPlay', steps: [draw(1), { do: 'lock', side: 'opp', n: 1, filter: { maxBaseCost: 6 }, what: 'cannotRest', until: 'oppNextEnd', prompt: "Choose an opponent's Character that can't be rested (so it can't attack or block)." }] }] },
  'OP17-031': { effects: [
    { on: 'onPlay', steps: [draw(1), { do: 'rest', side: 'opp', n: 1, filter: { maxCost: 8 } }] },
    { on: 'endOfTurn', steps: [{ do: 'stand', filter: { traitIncludes: 'Red-Haired Pirates', rested: true } }] },
  ] },
  'OP13-031': {
    aura: (v, src, tgt) => (tgt.uid === src.uid && v.life(v.me) <= 1 ? { keywords: ['Blocker'] } : null),
    effects: [{ on: 'onPlay', steps: [may({ returnChar: 1 }, 'Return 1 of your Characters to your hand to play a 5-cost or less Character rested?'), { do: 'playFrom', zone: 'hand', filter: { type: 'Character', maxCost: 5 }, rested: true }] }],
  },
  'OP17-022': { kw: ['Rush'], effects: [{ on: 'onPlay', steps: [{ do: 'setDonActive', n: 2 }, { do: 'restAllOpp' }] }] },
  'OP14-038': { effects: [
    { on: 'main', steps: [may({ restCards: 2 }, 'Rest 2 of your cards to draw 1 and rest an opponent Character?'), draw(1), { do: 'rest', side: 'opp', n: 1, filter: { maxBasePower: 7000 } }] },
    leaderPlus3000,
  ] },
  'OP06-038': { effects: [
    { on: 'counter', steps: [{ ...battlePlus(2000), store: true }, ifc(v => v.restedCount(v.me) >= 8, [{ do: 'power', target: 'stored', side: 'me', amount: 2000, until: 'battle' }])] },
    { on: 'trigger', steps: [{ do: 'ko', side: 'opp', filter: { rested: true, maxCost: 3 } }] },
  ] },
  'OP01-055': { effects: [{ on: 'main', steps: [may({ restChars: 2 }, 'Rest 2 of your Characters to draw 2?'), draw(2)] }] },
  'OP08-036': { effects: [
    { on: 'main', steps: [{ do: 'lockAll', side: 'opp', filter: { rested: true, maxCost: 7 }, what: 'noRefresh', until: 'refresh' }] },
    { on: 'trigger', steps: [{ do: 'rest', side: 'opp', n: 1 }] },
  ] },
  'OP14-039': { effects: [
    { on: 'onPlay', steps: [ifc(v => v.leaderName(v.me) === 'Dracule Mihawk', [draw(1)])] },
    { on: 'endOfTurn', cond: v => v.leaderName(v.me) === 'Dracule Mihawk', steps: [{ do: 'setDonActive', n: 1 }] },
  ] },

  // ===== Red/Green Luffy (OP13-001) =====
  'OP13-001': { effects: [{ on: 'onOppAttack', don: 1, cond: v => v.donActive(v.me) <= 5 && v.donActive(v.me) > 0, steps: [{ do: 'luffyDefense' }] }] },
  'ST30-004': { effects: [{ on: 'onPlay', steps: [may({ revealHand: { n: 2, filter: { type: 'Character', power: 6000 } } }, 'Reveal 2 Characters with 6000 power to draw 3 and trash 2?'), draw(3), { do: 'trashHand', n: 2 }] }] },
  'OP13-016': { effects: [{ on: 'onPlay', steps: [ifc(v => ['Sabo', 'Portgas.D.Ace', 'Monkey.D.Luffy'].includes(v.leaderName(v.me)), [look(4, { minCost: 3 })])] }] },
  'EB01-013': { effects: [{ on: 'activateMain', costCheck: () => true, steps: [
    { do: 'pay', k: 'trashSelf', v: 1 },
    { do: 'playFrom', zone: 'hand', filter: { type: 'Character', traitAny: ['Land of Wano'], maxCost: 5, notName: 'Kouzuki Hiyori' } },
    draw(1),
  ] }] },
  'OP14-031': { kw: ['Blocker'], effects: [{ on: 'onPlay', steps: [{ do: 'rest', side: 'opp', n: 2, filter: { maxCost: 8 } }, { do: 'delayed', steps: [{ do: 'setDonActive', n: 5 }] }] }] },
  'EB05-001': { effects: [
    { on: 'onPlay', steps: [ifc(v => v.leaderTypes(v.me).includes('Supernovas'), [draw(2), { do: 'playFrom', zone: 'hand', n: 2, filter: { type: 'Character', maxPower: 2000 } }])] },
    { on: 'activateMain', once: true, key: 'bonney', costCheck: () => true, steps: [{ do: 'power', side: 'opp', amount: -1000, until: 'oppNextEnd', filter: { minPowerNow: 6000 }, prompt: "Choose an opponent's card with 6000+ power to get −1000." }] },
  ] },
  'OP14-037': { effects: [
    { on: 'main', steps: [may({ restCards: 3 }, 'Rest 3 of your cards to K.O. a rested opponent Character (7000 base power or less)?'), { do: 'ko', side: 'opp', filter: { rested: true, maxBasePower: 7000 } }] },
    leaderPlus3000,
  ] },
  'OP10-040': { effects: ['main', 'counter'].map(on => ({ on, steps: [{ do: 'ko', side: 'opp', filter: { rested: true, maxCost: 7 } }] })) },

  // ===== Red/Black Sabo (OP13-004) =====
  'OP13-004': {
    aura: (v, src, tgt, owner) => {
      let power = 0;
      if (tgt.uid === src.uid && v.life(v.me) >= 4) power -= 1000;
      if (owner === v.me && src.don >= 1 && v.myCharCostAtLeast(8)) power += 1000;
      return power ? { power } : null;
    },
  },
  'OP17-086': { effects: [{ on: 'onPlay', steps: [may({ trashHand: { n: 1, filter: { traitAny: ['Elbaph'] } } }, 'Trash an Elbaph card from your hand to draw 2?'), draw(2)] }] },
  'OP17-084': { effects: [{ on: 'onPlay', steps: [ifc(cost12, [{ do: 'keyword', kw: 'Unblockable', until: 'turn', filter: {} }])] }] },
  'OP17-083': { aura: (v, src, tgt) => (tgt.uid === src.uid && cost12(v) ? { keywords: ['Blocker'], power: 3000 } : null) },
  'OP17-087': {
    aura: (v, src, tgt) => (tgt.uid === src.uid && cost12(v) ? { power: 3000 } : null),
    effects: [{ on: 'onPlay', steps: [ifc(cost12, [{ do: 'power', side: 'opp', includeLeader: false, amount: -3000, until: 'turn', prompt: "Choose an opponent's Character to get −3000." }])] }],
  },
  'OP17-095': { aura: (v, src, tgt) => (tgt.uid === src.uid && cost12(v) ? { power: 3000 } : null) }, // removal replacement lives in engine.replaceRemoval
  'OP17-082': { aura: (v, src, tgt) => (tgt.uid === src.uid && cost12(v) ? { power: 3000 } : null), effects: [{ on: 'onPlay', steps: [draw(2), { do: 'trashHand', n: 2 }] }] },
  'OP17-080': { aura: (v, src, tgt) => (tgt.uid === src.uid && cost12(v) ? { power: 3000 } : null), effects: [{ on: 'onPlay', steps: [look(3, { traitAny: ['Elbaph'] }, 'trash')] }] },
  'ST01-011': { effects: [{ on: 'onPlay', steps: [{ do: 'giveRestedDon', n: 2 }] }] },
  'OP17-081': {
    costMod: v => (v.leaderTypes(v.me).includes('Elbaph') ? 12 : 0),
    effects: [{ on: 'onPlay', steps: [may({ trashHand: { n: 1 } }, 'Trash 1 card from your hand to get back a Character (cost 8 or less) from your trash?'), { do: 'addFromTrash', filter: { type: 'Character', maxCost: 8, notName: 'Gerd' } }] }],
  },
  'OP17-089': { costMod: () => 12, effects: [{ on: 'onPlay', steps: [look(3, { traitAny: ['Elbaph'] }, 'trash')] }] },
  'OP15-088': { costMod: () => 6, effects: [{ on: 'onPlay', steps: [may({ mill: 3 }, 'Trash the top 3 cards of your deck to play a Straw Hat Crew Character (cost 2 or less) from your trash?'), { do: 'playFrom', zone: 'trash', filter: { type: 'Character', traitAny: [shc], maxCost: 2 } }] }] },
  'OP17-119': {
    costMod: () => 12,
    aura: (v, src, tgt) => (tgt.uid === src.uid && !v.isMyTurn ? { power: 3000 } : null),
    effects: [{ on: 'onPlay', steps: [{ do: 'koBudget', budget: 4 }] }],
  },
  'EB04-007': { effects: [
    { on: 'onPlay', steps: [{ do: 'power', target: 'leader', side: 'me', amount: 2000, until: 'oppNextEnd' }] },
    { on: 'activateMain', once: true, key: 'zoro', costCheck: () => true, steps: [ifc(v => v.chars(v.opp).some(c => v.powerNow(c.uid) >= 8000), [{ do: 'keyword', target: 'self', kw: 'Rush: Character', until: 'turn' }])] },
  ] },
  'OP17-093': {
    aura: (v, src, tgt) => (tgt.uid === src.uid && cost12(v) ? { keywords: ['Rush'] } : null),
    effects: [{ on: 'onPlay', steps: [draw(1), { do: 'playFrom', zone: 'trash', filter: { type: 'Character', maxCost: 2 } }] }],
  },
  'OP17-096': { effects: [
    { on: 'counter', steps: [ifc(cost12, [battlePlus(4000)])] },
    { on: 'trigger', steps: [{ do: 'addFromTrash', filter: { traitAny: ['Elbaph'] } }] },
  ] },

  // ===== Purple/Yellow Robin (OP09-062) =====
  'OP09-062': { kw: ['Banish'], effects: [{ on: 'whenAttacking', steps: [may({ trashHand: { n: 1, filter: { hasTrigger: true } } }, 'Trash a [Trigger] card from your hand to add 1 rested DON!!?'), { do: 'addDon', rested: 1 }] }] },
  'ST34-003': { effects: [{ on: 'onPlay', steps: [look(3, { traitAny: ['Big Mom Pirates'] })] }] },
  'OP17-113': { effects: [{ on: 'onPlay', steps: [look(3, { traitAny: ['Big Mom Pirates'] })] }] },
  'OP17-074': { kw: ['Blocker'], effects: [{ on: 'onPlay', steps: [{ do: 'addDon', rested: 1 }] }] },
  'OP17-107': { effects: [{ on: 'trigger', steps: [{ do: 'playSelf' }] }] },
  'OP17-109': { effects: [
    { on: 'onPlay', steps: [may({ trashHand: { n: 1, filter: { hasTrigger: true } } }, 'Trash a [Trigger] card from your hand to draw 3?'), draw(3)] },
    { on: 'trigger', steps: [look(5, { traitAny: ['Big Mom Pirates'] })] },
  ] },
  'OP17-102': { effects: [
    { on: 'onKO', steps: [{ do: 'playFrom', zone: 'trash', filter: { type: 'Character', maxPower: 4000, notName: 'Charlotte Oven' } }] },
    { on: 'trigger', steps: [{ do: 'playSelf' }] },
  ] },
  'OP05-073': { effects: [
    { on: 'onPlay', steps: [may({ trashHand: { n: 1 } }, 'Trash 1 card from your hand to add 1 rested DON!!?'), { do: 'addDon', rested: 1 }] },
    { on: 'trigger', steps: [may({ donMinus: 1 }, 'Return 1 DON!! to your DON!! deck to play this card?'), { do: 'playSelf' }] },
  ] },
  'OP17-106': { effects: [
    { on: 'onPlay', yourTurn: true, steps: [may({ restDon: 2 }, 'Rest 2 DON!! to add a Life card and make your opponent trash 1?'), { do: 'lifeFromDeck', n: 1 }, { do: 'oppTrashHand', n: 1 }] },
    { on: 'trigger', steps: [{ do: 'playSelf' }] },
  ] },
  'EB04-058': { kw: ['Blocker'], effects: [{ on: 'onPlay', steps: [ifc(v => v.life(v.me) <= 2, [{ do: 'lifeFromDeck', n: 1 }])] }] },
  'OP17-114': { effects: [
    { on: 'onPlay', yourTurn: true, steps: [may({ restDon: 2 }, 'Rest 2 DON!! to draw 1, add a Life card and weaken 2 opponent Characters?'), draw(1), { do: 'lifeFromDeck', n: 1 }, { do: 'power', side: 'opp', includeLeader: false, n: 2, amount: -3000, until: 'turn', prompt: "Choose up to 2 of your opponent's Characters to get −3000." }] },
    { on: 'trigger', steps: [{ do: 'playSelf' }] },
  ] },
  'OP14-108': { effects: [
    { on: 'onPlay', steps: [ifc(v => v.multicolor(v.me) && v.life(v.opp) <= 3, [{ do: 'ko', side: 'opp', filter: { maxBasePower: 7000 } }])] },
    { on: 'trigger', steps: [{ do: 'runOnPlay' }] },
  ] },
  'OP16-119': { effects: [
    { on: 'onPlay', steps: [look(3, {}, 'bottom', { dest: 'life', prompt: 'Choose a card to put on top of your Life.' })] },
    { on: 'trigger', steps: [{ do: 'negate' }, { do: 'ko', side: 'opp', filter: { maxCost: 5 } }] },
  ] },
  'OP17-112': {
    aura: (v, src, tgt, owner) => {
      if (!v.isMyTurn || owner !== v.me) return null;
      const d = v.def(tgt.uid);
      return d?.type === 'Character' && /\[Trigger\]/.test(d.text) && d.power === 4000 ? { basePower: 8000 } : null;
    },
    effects: [{ on: 'onPlay', steps: [draw(1), { do: 'mode', labels: ['Add the top card of your deck to your Life', "Add the top card of your opponent's Life to their hand"], branches: [[{ do: 'lifeFromDeck', n: 1 }], [{ do: 'oppLifeToHand', n: 1 }]] }] }],
  },
  'OP09-078': { effects: [{ on: 'counter', steps: [
    may({ donMinus: 2, trashHand: { n: 1 } }, 'Return 2 DON!! and trash 1 card for +4000 power and draw 2?'),
    ifc(v => v.leaderTypes(v.me).includes(shc), [battlePlus(4000), draw(2)]),
  ] }] },
};
