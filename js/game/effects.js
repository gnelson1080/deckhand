// Effect steps for card abilities. Each step: runStep(state, frame, step, answer) -> 'wait' | undefined.
// A step that needs a player's choice sets state.pending and returns 'wait'; it is called again with the answer.
// "Up to" with no valid targets is a no-op (CR 1-3-2).
import { find, def, power, costOf, basePowerOf, view, koChar, removeToHand, playCharacter, fieldCards, keywords } from './engine.js';

const opp = p => 1 - p;
const sideOf = (f, side) => (side === 'opp' ? opp(f.owner) : f.owner);

// ---------- filters ----------
export function matches(s, inst, filter = {}) {
  if (!inst) return false;
  const d = def(inst.id);
  if (filter.any && !filter.any.some(sub => matches(s, inst, sub))) return false;
  if (filter.kw && !keywords(s, inst.uid).has(filter.kw)) return false;
  if (filter.type && d.type !== filter.type) return false;
  if (filter.types && !filter.types.includes(d.type)) return false;
  if (filter.traitAny && !filter.traitAny.some(t => d.traits.includes(t))) return false;
  if (filter.traitIncludes && !d.traits.some(t => t.includes(filter.traitIncludes))) return false;
  if (filter.name && d.name !== filter.name) return false;
  if (filter.names && !filter.names.includes(d.name)) return false;
  if (filter.notName && d.name === filter.notName) return false;
  if (filter.color && !d.colors.includes(filter.color)) return false;
  if (filter.attr && !(d.attribute || '').includes(filter.attr)) return false;
  if (filter.hasTrigger && !/\[Trigger\]/.test(d.text)) return false;
  if (filter.maxCost != null && (inst.onBoard ? costOf(s, inst.uid) : d.cost ?? 0) > filter.maxCost) return false;
  if (filter.minCost != null && (d.cost ?? 0) < filter.minCost) return false;
  if (filter.maxBaseCost != null && (d.cost ?? 0) > filter.maxBaseCost) return false;
  if (filter.maxPower != null && (d.power ?? 0) > filter.maxPower) return false;
  if (filter.power != null && d.power !== filter.power) return false;
  if (filter.minPowerNow != null && power(s, inst.uid) < filter.minPowerNow) return false;
  if (filter.maxBasePower != null && (d.power ?? 0) > filter.maxBasePower) return false;
  if (filter.rested != null && !!inst.rested !== filter.rested) return false;
  if (filter.notUid && inst.uid === filter.notUid) return false;
  return true;
}

// Board targets on one side: Characters (and Leader if includeLeader).
function boardTargets(s, p, filter = {}) {
  const P = s.players[p];
  const list = [...(filter.includeLeader ? [P.leader] : []), ...P.chars];
  return list.filter(c => matches(s, { ...c, onBoard: true }, filter.charFilter ? { ...filter.charFilter } : filter)).map(c => c.uid);
}

function ask(s, f, ans, { player = f.owner, options, min = 0, max = 1, prompt, budget, show }) {
  if (ans) return ans.picks;
  if (!options.length) return [];
  if (min >= options.length && max >= options.length && budget == null) return options.slice();
  s.pending = { player, kind: 'pick', options, min: Math.min(min, options.length), max: Math.min(max, options.length), prompt, budget, show };
  return null;
}
const confirm = (s, f, ans, prompt, player = f.owner) => { if (ans) return ans.yes; s.pending = { player, kind: 'confirm', prompt }; return null; };

const until = (s, u) => (u === 'oppNextEnd' ? { until: 'oppNextEnd', expireTurn: s.turn + 1 } : { until: u || 'turn' });
const addMod = (s, m) => s.mods.push(m);

// ---------- costs ----------
export function canPay(s, p, cost, srcUid) {
  const P = s.players[p];
  for (const [k, v] of Object.entries(cost)) {
    if (k === 'restDon' && P.donActive < v) return false;
    if (k === 'donMinus') { const field = P.donActive + P.donRested + fieldCards(s, p).reduce((n, c) => n + c.don, 0); if (field < v) return false; }
    if (k === 'trashHand' && P.hand.filter(c => c.uid !== srcUid && matches(s, c, v.filter)).length < v.n) return false;
    if (k === 'revealHand' && P.hand.filter(c => matches(s, c, v.filter)).length < v.n) return false;
    if (k === 'restCards' && P.donActive + fieldCards(s, p).filter(c => !c.rested).length < v) return false;
    if (k === 'restChars' && P.chars.filter(c => !c.rested).length < v) return false;
    if (k === 'returnChar' && P.chars.length < 1) return false;
    if (k === 'mill' && P.deck.length < v) return false;
    if (k === 'lifeToHand' && P.life.length < v) return false;
    if (k === 'restLeaderAttrOrDon' && !((!P.leader.rested && (def(P.leader.id).attribute || '').includes(v)) || P.donActive > 0)) return false;
  }
  return true;
}

function payStep(s, f, k, v, ans) {
  const p = f.owner, P = s.players[p];
  switch (k) {
    case 'restDon': P.donActive -= v; P.donRested += v; return;
    case 'donMinus': { // 10-2-10: return DON!! to the DON!! deck (rested ones first, then active, then given)
      let n = v;
      const take = (k2) => { const m = Math.min(n, P[k2]); P[k2] -= m; P.donDeck += m; n -= m; };
      take('donRested'); take('donActive');
      for (const c of fieldCards(s, p)) { const m = Math.min(n, c.don); c.don -= m; P.donDeck += m; n -= m; }
      return;
    }
    case 'trashHand': {
      const opts = P.hand.filter(c => c.uid !== f.src && matches(s, c, v.filter)).map(c => c.uid);
      const picks = ask(s, f, ans, { options: opts, min: v.n, max: v.n, prompt: `Choose ${v.n} card${v.n > 1 ? 's' : ''} to trash from your hand.`, show: 'hand' });
      if (!picks) return 'wait';
      for (const u of picks) { const i = P.hand.findIndex(c => c.uid === u); P.trash.push(...P.hand.splice(i, 1)); }
      return;
    }
    case 'revealHand': return; // revealing doesn't move cards
    case 'restCards': { // "rest N of your cards": DON!! count as cards (pseudo-uids)
      const opts = [...fieldCards(s, p).filter(c => !c.rested).map(c => c.uid), ...Array.from({ length: P.donActive }, (_, i) => `DON:${i}`)];
      const picks = ask(s, f, ans, { options: opts, min: v, max: v, prompt: `Choose ${v} of your cards to rest. DON!! count too.` });
      if (!picks) return 'wait';
      for (const u of picks) { if (u.startsWith('DON:')) { P.donActive--; P.donRested++; } else find(s, u).inst.rested = true; }
      return;
    }
    case 'restChars': {
      const opts = P.chars.filter(c => !c.rested).map(c => c.uid);
      const picks = ask(s, f, ans, { options: opts, min: v, max: v, prompt: `Choose ${v} of your Characters to rest.` });
      if (!picks) return 'wait';
      for (const u of picks) find(s, u).inst.rested = true;
      return;
    }
    case 'returnChar': {
      const picks = ask(s, f, ans, { options: P.chars.map(c => c.uid), min: 1, max: 1, prompt: 'Choose 1 of your Characters to return to your hand.' });
      if (!picks) return 'wait';
      removeToHand(s, picks[0], p);
      return;
    }
    case 'mill': P.trash.push(...P.deck.splice(0, v)); return;
    case 'lifeToHand': P.hand.push(...P.life.splice(0, v)); return;
    case 'trashSelf': { const x = find(s, f.src); if (x?.zone === 'chars') { P.chars.splice(x.index, 1); P.donRested += x.inst.don; x.inst.don = 0; P.trash.push(x.inst); } return; }
    case 'restLeaderAttrOrDon': {
      const leaderOk = !P.leader.rested && (def(P.leader.id).attribute || '').includes(v);
      const opts = [...(leaderOk ? [P.leader.uid] : []), ...(P.donActive ? ['DON:0'] : [])];
      const picks = ask(s, f, ans, { options: opts, min: 1, max: 1, prompt: 'Rest your Leader or 1 DON!!.' });
      if (!picks) return 'wait';
      if (picks[0] === 'DON:0') { P.donActive--; P.donRested++; } else P.leader.rested = true;
      return;
    }
    default: throw new Error(`unknown cost ${k}`);
  }
}

// ---------- steps ----------
export function runStep(s, f, st, ans) {
  const p = f.owner, P = s.players[p], v = view(s, p);
  const self = find(s, f.src)?.inst;
  const expand = steps => { f.steps = [...(f.steps || stepsOf(f))]; f.steps.splice(f.step + 1, 0, ...steps); };
  const abort = () => { f.steps = [...(f.steps || stepsOf(f))]; f.step = f.steps.length; };

  switch (st.do) {
    case 'may': { // "You may <cost>: <effect>" — skip everything after if declined or unpayable.
      if (!canPay(s, p, st.cost, f.src)) { abort(); return 'stop'; }
      const yes = confirm(s, f, ans, st.prompt);
      if (yes === null) return 'wait';
      if (!yes) { abort(); return 'stop'; }
      expand(Object.entries(st.cost).map(([k, val]) => ({ do: 'pay', k, v: val })));
      return;
    }
    case 'pay': return payStep(s, f, st.k, st.v, ans);
    case 'if': if (st.cond(v, self, f)) expand(st.then); else if (st.else) expand(st.else); return;
    case 'draw': for (let i = 0; i < st.n && P.deck.length; i++) P.hand.push(P.deck.shift()); return;
    case 'trashHand': return payStep(s, f, 'trashHand', { n: Math.min(st.n, P.hand.length), filter: {} }, ans);
    case 'look': {
      if (!f.ctx.look) f.ctx.look = P.deck.slice(0, st.n).map(c => c.uid);
      const looked = f.ctx.look;
      const opts = looked.filter(u => matches(s, find(s, u).inst, st.filter));
      const picks = ask(s, f, ans, { options: opts, min: 0, max: st.take ?? 1, prompt: st.prompt || 'Choose a card to take.', show: 'look', looked });
      if (!picks) { s.pending.looked = looked; return 'wait'; }
      const taken = picks.map(u => P.deck.splice(P.deck.findIndex(c => c.uid === u), 1)[0]);
      if (st.dest === 'life') P.life.unshift(...taken); else P.hand.push(...taken);
      const rest = looked.filter(u => !picks.includes(u)).map(u => P.deck.splice(P.deck.findIndex(c => c.uid === u), 1)[0]);
      if (st.rest === 'trash') P.trash.push(...rest); else P.deck.push(...rest);
      delete f.ctx.look;
      return;
    }
    case 'ko': {
      const side = sideOf(f, st.side || 'opp');
      const picks = ask(s, f, ans, { options: boardTargets(s, side, st.filter), min: 0, max: st.n ?? 1, prompt: st.prompt || 'Choose a Character to K.O.' });
      if (!picks) return 'wait';
      for (const u of picks) koChar(s, u, 'effect', p);
      return;
    }
    case 'koBudget': { // Loki: K.O. opponent's Characters with a total cost of N or less
      const opts = boardTargets(s, opp(p), {}).filter(u => costOf(s, u) <= st.budget);
      const picks = ask(s, f, ans, { options: opts, min: 0, max: opts.length, budget: st.budget, prompt: `Choose Characters with a total cost of ${st.budget} or less to K.O.` });
      if (!picks) return 'wait';
      for (const u of picks) koChar(s, u, 'effect', p);
      return;
    }
    case 'rest': {
      const side = sideOf(f, st.side || 'opp'), Q = s.players[side];
      const opts = [...boardTargets(s, side, { ...st.filter, rested: false }), ...(st.includeDon ? Array.from({ length: Q.donActive }, (_, i) => `ODON:${i}`) : [])];
      const picks = ask(s, f, ans, { options: opts, min: 0, max: st.n ?? 1, prompt: st.prompt || 'Choose a card to rest.' });
      if (!picks) return 'wait';
      for (const u of picks) { if (u.startsWith('ODON:')) { Q.donActive--; Q.donRested++; } else find(s, u).inst.rested = true; }
      return;
    }
    case 'restAllOpp': for (const c of s.players[opp(p)].chars) c.rested = true; return;
    case 'setDonActive': { const n = Math.min(st.n, P.donRested); P.donRested -= n; P.donActive += n; return; }
    case 'addDon': {
      const a = Math.min(st.active || 0, P.donDeck); P.donDeck -= a; P.donActive += a;
      const r = Math.min(st.rested || 0, P.donDeck); P.donDeck -= r; P.donRested += r;
      return;
    }
    case 'giveRestedDon': {
      if (!P.donRested) return;
      const opts = [P.leader, ...P.chars].filter(c => matches(s, { ...c, onBoard: true }, st.filter || {})).map(c => c.uid);
      const picks = ask(s, f, ans, { options: opts, min: 0, max: 1, prompt: 'Choose your Leader or a Character to give rested DON!! to.' });
      if (!picks) return 'wait';
      if (picks[0]) { const n = Math.min(st.n || 1, P.donRested); P.donRested -= n; find(s, picks[0]).inst.don += n; }
      return;
    }
    case 'power': {
      const side = sideOf(f, st.side || 'me');
      let targets;
      if (st.target === 'self') targets = self ? [self.uid] : [];
      else if (st.target === 'leader') targets = [s.players[side].leader.uid];
      else if (st.target === 'allSide') targets = [s.players[side].leader.uid, ...s.players[side].chars.map(c => c.uid)];
      else if (st.target === 'stored') targets = f.ctx.stored || [];
      else {
        const opts = boardTargets(s, side, { includeLeader: st.includeLeader !== false, ...st.filter });
        targets = ask(s, f, ans, { options: opts, min: 0, max: st.n ?? 1, prompt: st.prompt || 'Choose a card.' });
        if (!targets) return 'wait';
      }
      if (st.store) f.ctx.stored = targets;
      for (const u of targets) addMod(s, { uid: u, kind: 'power', amount: st.amount, owner: find(s, u).owner, ...until(s, st.until) });
      return;
    }
    case 'lock': {
      const side = sideOf(f, st.side || 'opp');
      let targets;
      if (st.target === 'leaderSelf') targets = [P.leader.uid];
      else {
        targets = ask(s, f, ans, { options: boardTargets(s, side, st.filter), min: 0, max: st.n ?? 1, prompt: st.prompt || 'Choose a Character.' });
        if (!targets) return 'wait';
      }
      for (const u of targets) addMod(s, { uid: u, kind: 'lock', what: st.what, owner: find(s, u).owner, ...until(s, st.until) });
      return;
    }
    case 'keyword': {
      let targets;
      if (st.target === 'self') targets = self ? [self.uid] : [];
      else {
        targets = ask(s, f, ans, { options: boardTargets(s, p, st.filter), min: 0, max: 1, prompt: st.prompt || 'Choose one of your Characters.' });
        if (!targets) return 'wait';
      }
      for (const u of targets) addMod(s, { uid: u, kind: 'keyword', kw: st.kw, owner: p, ...until(s, st.until) });
      return;
    }
    case 'playFrom': {
      const zone = P[st.zone];
      const opts = zone.filter(c => c.uid !== f.src && matches(s, c, st.filter)).map(c => c.uid);
      const picks = ask(s, f, ans, { options: opts, min: 0, max: st.n ?? 1, prompt: st.prompt || 'Choose a Character to play.', show: st.zone });
      if (!picks) return 'wait';
      // Play one at a time; the rest are re-asked if a 5-Character choice interrupts.
      for (const u of picks) {
        const i = zone.findIndex(c => c.uid === u); if (i < 0) continue;
        const [inst] = zone.splice(i, 1);
        playCharacter(s, p, inst, { rested: !!st.rested, fromEffect: true });
        if (s.pending) break;
      }
      return;
    }
    case 'playSelf': { // [Trigger] Play this card.
      if (s.limbo?.uid === f.src) { const inst = s.limbo; s.limbo = null; playCharacter(s, p, inst, { fromEffect: true }); }
      return;
    }
    case 'lifeFromDeck': { const n = Math.min(st.n, P.deck.length); P.life.unshift(...P.deck.splice(0, n)); return; }
    case 'oppLifeToHand': { const Q = s.players[opp(p)]; Q.hand.push(...Q.life.splice(0, Math.min(st.n, Q.life.length))); return; }
    case 'oppTrashHand': {
      const Q = s.players[opp(p)];
      const picks = ask(s, f, ans, { player: opp(p), options: Q.hand.map(c => c.uid), min: Math.min(st.n, Q.hand.length), max: Math.min(st.n, Q.hand.length), prompt: 'Your opponent makes you trash a card from your hand. Choose one.', show: 'hand' });
      if (!picks) return 'wait';
      for (const u of picks) { const i = Q.hand.findIndex(c => c.uid === u); Q.trash.push(...Q.hand.splice(i, 1)); }
      return;
    }
    case 'addFromTrash': {
      const opts = P.trash.filter(c => c.uid !== f.src && matches(s, c, st.filter)).map(c => c.uid);
      const picks = ask(s, f, ans, { options: opts, min: 0, max: st.n ?? 1, prompt: 'Choose a card to add from your trash to your hand.', show: 'trash' });
      if (!picks) return 'wait';
      for (const u of picks) { const i = P.trash.findIndex(c => c.uid === u); P.hand.push(...P.trash.splice(i, 1)); }
      return;
    }
    case 'mode': {
      if (!ans) { s.pending = { player: p, kind: 'mode', labels: st.labels, prompt: st.prompt || 'Choose one.' }; return 'wait'; }
      expand(st.branches[ans.option]);
      return;
    }
    case 'delayed': s.delayed.push({ turn: s.turn, owner: p, src: f.src, cardId: f.cardId, eff: f.eff, steps: st.steps }); return;
    case 'negate': {
      const picks = ask(s, f, ans, { options: boardTargets(s, opp(p), {}), min: 0, max: 1, prompt: "Choose an opponent's Character to negate." });
      if (!picks) return 'wait';
      for (const u of picks) addMod(s, { uid: u, kind: 'negate', owner: opp(p), until: 'turn' });
      return;
    }
    case 'runOnPlay': { // Rayleigh: [Trigger] Activate this card's [On Play] effect.
      const idx = (cardDefFor(f.cardId).effects || []).findIndex(e => e.on === 'onPlay');
      if (idx >= 0) s.stack.splice(s.stack.length - 1, 0, { owner: p, src: f.src, cardId: f.cardId, eff: idx, step: 0, ctx: {}, paid: false });
      return;
    }
    case 'stand': { // set up to 1 of your matching rested Characters as active
      const picks = ask(s, f, ans, { options: boardTargets(s, p, st.filter), min: 0, max: 1, prompt: 'Choose a Character to set as active.' });
      if (!picks) return 'wait';
      for (const u of picks) find(s, u).inst.rested = false;
      return;
    }
    case 'lockAll': {
      const side = sideOf(f, st.side || 'opp');
      for (const u of boardTargets(s, side, st.filter)) addMod(s, { uid: u, kind: 'lock', what: st.what, owner: side, ...until(s, st.until) });
      return;
    }
    case 'luffyDefense': { // OP13-001: rest any number of DON!!; +2000 per DON!! to the Leader or 1 Straw Hat Crew Character this battle
      if (!f.ctx.n) {
        if (!ans) {
          const max = Math.min(P.donActive, 5);
          s.pending = { player: p, kind: 'mode', labels: ["Don't use it", ...Array.from({ length: max }, (_, i) => `Rest ${i + 1} DON!! for +${(i + 1) * 2000}`)], prompt: 'Your Leader can rest DON!! to power up a defender.' };
          return 'wait';
        }
        if (ans.option === 0) return;
        f.ctx.n = ans.option;
        P.donActive -= f.ctx.n; P.donRested += f.ctx.n;
        ans = undefined;
      }
      const opts = [P.leader.uid, ...P.chars.filter(c => def(c.id).traits.some(t => t.includes('Straw Hat Crew'))).map(c => c.uid)];
      const picks = ask(s, f, ans, { options: opts, min: 1, max: 1, prompt: `Choose who gets +${f.ctx.n * 2000} this battle.` });
      if (!picks) return 'wait';
      addMod(s, { uid: picks[0], kind: 'power', amount: f.ctx.n * 2000, owner: p, until: 'battle' });
      delete f.ctx.n;
      return;
    }
    case 'custom': return st.fn(s, f, ans, { P, v, self, ask: o => ask(s, f, ans, o) });
    default: throw new Error(`unknown step ${st.do}`);
  }
}

import { CARD_DEFS } from './cards/index.js';
const cardDefFor = id => CARD_DEFS[id] || {};
const stepsOf = f => cardDefFor(f.cardId).effects[f.eff].steps;
export { keywords, basePowerOf };
