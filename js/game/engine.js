// Deckhand practice-game engine. Pure and deterministic: dispatch(state, action) -> new state.
// Rules follow the ONE PIECE CARD GAME Comprehensive Rules v1.2.1 (rule numbers in comments).
import { POOL } from './pool-data.js';
import { CARD_DEFS } from './cards/index.js';
import { nextRandom } from './rng.js';
import { runStep } from './effects.js';

export const VERSION = 1;
// Deep copy that keeps function references (expanded effect steps can hold card condition functions).
function clone(x) {
  if (x === null || typeof x !== 'object') return x;
  if (Array.isArray(x)) return x.map(clone);
  const o = {};
  for (const k in x) o[k] = clone(x[k]);
  return o;
}
export const def = id => POOL[id];
export const cardDef = id => CARD_DEFS[id] || {};

// ---------- lookup helpers ----------
export function find(s, uid) {
  for (let p = 0; p < 2; p++) {
    const P = s.players[p];
    if (P.leader.uid === uid) return { inst: P.leader, owner: p, zone: 'leader' };
    if (P.stage?.uid === uid) return { inst: P.stage, owner: p, zone: 'stage' };
    for (const zone of ['chars', 'hand', 'trash', 'life', 'deck']) {
      const i = P[zone].findIndex(c => c.uid === uid);
      if (i >= 0) return { inst: P[zone][i], owner: p, zone, index: i };
    }
  }
  if (s.limbo?.uid === uid) return { inst: s.limbo, owner: s.limbo.owner, zone: 'limbo' };
  return null;
}
const onField = (s, uid) => { const f = find(s, uid); return f && ['leader', 'chars', 'stage'].includes(f.zone) ? f : null; };
export const fieldCards = (s, p) => [s.players[p].leader, ...s.players[p].chars, ...(s.players[p].stage ? [s.players[p].stage] : [])];
const opp = p => 1 - p;

function newInst(s, id, owner) { return { uid: `u${s.nextUid++}`, id, owner, rested: false, don: 0, playedTurn: 0 }; }

// ---------- view for card conditions / auras (read-only, never calls power()) ----------
export function view(s, me) {
  const v = {
    s, me, opp: opp(me),
    isMyTurn: s.active === me,
    P: i => s.players[i],
    life: i => s.players[i].life.length,
    hand: i => s.players[i].hand,
    chars: i => s.players[i].chars,
    leader: i => s.players[i].leader,
    def: uid => def(find(s, uid)?.inst.id),
    name: uid => def(find(s, uid)?.inst.id)?.name,
    leaderName: i => def(s.players[i].leader.id).name,
    leaderTypes: i => def(s.players[i].leader.id).traits,
    leaderAttr: i => def(s.players[i].leader.id).attribute || '',
    multicolor: i => def(s.players[i].leader.id).colors.length > 1,
    donActive: i => s.players[i].donActive,
    donField: i => { const P = s.players[i]; return P.donActive + P.donRested + fieldCards(s, i).reduce((n, c) => n + c.don, 0); },
    givenTotal: i => fieldCards(s, i).reduce((n, c) => n + c.don, 0),
    restedCount: i => fieldCards(s, i).filter(c => c.rested).length + s.players[i].donRested,
    cost: uid => costOf(s, uid),
    basePower: uid => basePowerOf(s, uid),
    powerNow: uid => power(s, uid), // only for effect conditions, never inside auras (would recurse)
    anyCharCostAtLeast: n => [0, 1].some(i => s.players[i].chars.some(c => costOf(s, c.uid) >= n)),
    myCharCostAtLeast: n => s.players[me].chars.some(c => costOf(s, c.uid) >= n),
  };
  return v;
}

const negated = (s, uid) => s.mods.some(m => m.uid === uid && m.kind === 'negate');

// ---------- derived stats ----------
export function costOf(s, uid) {
  const f = find(s, uid); if (!f) return 0;
  const d = def(f.inst.id);
  let c = d.cost ?? 0;
  const cd = cardDef(f.inst.id);
  if (cd.costMod && ['chars', 'stage'].includes(f.zone) && !negated(s, uid)) c += cd.costMod(view(s, f.owner), f.inst) || 0;
  for (const m of s.mods) if (m.uid === uid && m.kind === 'cost') c += m.amount;
  return c;
}
export function basePowerOf(s, uid) { const f = find(s, uid); return f ? def(f.inst.id).power ?? 0 : 0; }

// All aura contributions targeting one card: [{power, keywords, basePower}]
function auraFor(s, uid) {
  const tgt = find(s, uid); if (!tgt) return [];
  const out = [];
  for (let p = 0; p < 2; p++) for (const src of fieldCards(s, p)) {
    const cd = cardDef(src.id);
    if (!cd.aura || negated(s, src.uid)) continue;
    const r = cd.aura(view(s, p), src, tgt.inst, tgt.owner);
    if (r) out.push(r);
  }
  return out;
}

export function power(s, uid) {
  const f = find(s, uid); if (!f) return 0;
  const auras = ['leader', 'chars'].includes(f.zone) ? auraFor(s, uid) : [];
  let base = def(f.inst.id).power ?? 0;
  for (const a of auras) if (a.basePower != null) base = Math.max(base, a.basePower);
  let p = base;
  if (s.active === f.owner) p += (f.inst.don || 0) * 1000; // 6-5-5-2
  for (const a of auras) p += a.power || 0;
  for (const m of s.mods) if (m.uid === uid && m.kind === 'power') p += m.amount;
  return p;
}

export function keywords(s, uid) {
  const f = find(s, uid); const k = new Set();
  if (!f) return k;
  if (!negated(s, uid)) for (const w of cardDef(f.inst.id).kw || []) k.add(w);
  if (['leader', 'chars'].includes(f.zone)) for (const a of auraFor(s, uid)) for (const w of a.keywords || []) k.add(w);
  for (const m of s.mods) if (m.uid === uid && m.kind === 'keyword') k.add(m.kw);
  return k;
}
const locked = (s, uid, what) => s.mods.some(m => m.uid === uid && m.kind === 'lock' && m.what === what);

// ---------- state creation ----------
function shuffle(s, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const [r, n] = nextRandom(s.rng); s.rng = n;
    const j = Math.floor(r * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function emptyPlayer() { return { leader: null, deck: [], hand: [], life: [], trash: [], chars: [], stage: null, donDeck: 10, donActive: 0, donRested: 0, turns: 0 }; }

export function createGame({ seed = 1, decks, first = 0 }) {
  const s = { v: VERSION, seed, rng: seed >>> 0, nextUid: 1, turn: 0, active: first, first, phase: 'mulligan', mull: { next: first, done: [false, false] },
    players: [emptyPlayer(), emptyPlayer()], battle: null, pending: null, stack: [], mods: [], delayed: [], once: {}, limbo: null, flow: null, log: [], winner: null };
  decks.forEach((d, p) => {
    const P = s.players[p];
    P.leader = newInst(s, d.leaderId, p);
    for (const e of d.entries) for (let i = 0; i < e.count; i++) P.deck.push(newInst(s, e.id, p));
    shuffle(s, P.deck);
    P.hand = P.deck.splice(0, 5); // 5-2-1-6
  });
  return s;
}

// Test/save helper: build a mid-game state directly.
export function buildState({ players, active = 0, turn = 5, first = 0, seed = 1 }) {
  const s = { v: VERSION, seed, rng: seed, nextUid: 1, turn, active, first, phase: 'main', mull: null, players: [emptyPlayer(), emptyPlayer()], battle: null, pending: null, stack: [], mods: [], delayed: [], once: {}, limbo: null, flow: null, log: [], winner: null };
  players.forEach((spec, p) => {
    const P = s.players[p];
    const mk = x => { const o = typeof x === 'string' ? { id: x } : x; const c = newInst(s, o.id, p); c.rested = !!o.rested; c.don = o.don || 0; c.playedTurn = o.played ? turn : 0; return c; };
    P.leader = mk(spec.leader);
    P.hand = spec.hand.map(mk); P.chars = spec.chars.map(mk); P.deck = spec.deck.map(mk); P.life = spec.life.map(mk); P.trash = spec.trash.map(mk);
    P.stage = spec.stage ? mk(spec.stage) : null;
    P.donActive = spec.donActive; P.donRested = spec.donRested; P.donDeck = spec.donDeck; P.turns = 3;
  });
  return s;
}

// ---------- who acts ----------
export function actor(s) {
  if (s.phase === 'over') return null;
  if (s.pending) return s.pending.player;
  if (s.phase === 'mulligan') return s.mull.next;
  if (s.battle && (s.battle.step === 'block' || s.battle.step === 'counter')) return opp(s.active);
  return s.active;
}

const log = (s, e) => { s.log.push({ t: s.turn, ...e }); if (s.log.length > 400) s.log.splice(0, s.log.length - 400); };

// ---------- turn flow ----------
function placeLife(s) {
  for (const P of s.players) {
    const n = def(P.leader.id).life;
    const top = P.deck.splice(0, n);
    P.life = top.reverse(); // 5-2-1-7: deck top ends at the bottom of Life; life[0] is the top
  }
}

function drawCards(s, p, n) {
  const P = s.players[p];
  for (let i = 0; i < n && P.deck.length; i++) P.hand.push(P.deck.shift());
}

function startTurn(s, p) {
  s.active = p; s.turn += 1;
  const P = s.players[p];
  P.turns += 1;
  // Refresh (6-2): expire "until start of your next turn", return given DON!! rested, stand everything.
  s.mods = s.mods.filter(m => !(m.until === 'startOfOwnerTurn' && m.owner === p));
  for (const c of fieldCards(s, p)) { P.donRested += c.don; c.don = 0; }
  for (const c of fieldCards(s, p)) if (!locked(s, c.uid, 'noRefresh')) c.rested = false;
  s.mods = s.mods.filter(m => !(m.kind === 'lock' && m.what === 'noRefresh' && m.owner === p));
  P.donActive += P.donRested; P.donRested = 0;
  // Draw (6-3): first player skips their very first draw.
  if (!(p === s.first && P.turns === 1)) drawCards(s, p, 1);
  // DON!! (6-4)
  const add = Math.min(P.donDeck, p === s.first && P.turns === 1 ? 1 : 2);
  P.donDeck -= add; P.donActive += add;
  s.phase = 'main';
  log(s, { e: 'turn', p });
}

function expire(s, until) { s.mods = s.mods.filter(m => !(m.until === until || (until === 'turn' && m.until === 'battle'))); }

function finishTurn(s) {
  const p = s.active;
  // "during this turn" effects end; "until end of opponent's next End Phase" ends when that turn ends.
  s.mods = s.mods.filter(m => !(m.until === 'turn' || m.until === 'battle' || (m.until === 'oppNextEnd' && m.expireTurn <= s.turn)));
  s.flow = null;
  startTurn(s, opp(p));
}

// ---------- effects stack ----------
export function pushEffect(s, owner, srcUid, cardId, eff, extra = {}) {
  s.stack.push({ owner, src: srcUid, cardId, eff, step: 0, ctx: {}, paid: false, ...extra });
}

function effectsOf(id, on) { return (cardDef(id).effects || []).map((e, i) => [e, i]).filter(([e]) => e.on === on); }

function canTrigger(s, owner, inst, e) {
  if (negated(s, inst.uid)) return false;
  if (e.don && (inst.don || 0) < e.don) return false; // [DON!! xN] 10-2-9
  if (e.yourTurn && s.active !== owner) return false;
  if (e.once && s.once[`${inst.uid}:${e.key || 'x'}:${s.turn}`]) return false;
  if (e.cond && !e.cond(view(s, owner), inst)) return false;
  return true;
}

function queue(s, owner, inst, on) {
  for (const [e, i] of effectsOf(inst.id, on)) if (canTrigger(s, owner, inst, e)) pushEffect(s, owner, inst.uid, inst.id, i);
}

// Run effects until a choice is needed or the stack is empty, then continue the game flow.
function run(s) {
  let guard = 0;
  while (!s.pending && s.phase !== 'over') {
    if (++guard > 500) throw new Error('effect loop');
    if (s.stack.length) {
      const f = s.stack[s.stack.length - 1];
      const e = cardDef(f.cardId).effects[f.eff];
      const steps = f.steps || e.steps;
      if (f.step >= steps.length) { s.stack.pop(); afterFrame(s, f); continue; }
      const r = runStep(s, f, steps[f.step], undefined);
      if (r === 'wait') return s;
      f.step++;
      continue;
    }
    if (advance(s)) continue;
    break;
  }
  return s;
}

function afterFrame(s, f) {
  if (f.kind === 'trigger' && s.limbo && s.limbo.uid === f.src) { s.players[s.limbo.owner].trash.push(s.limbo); s.limbo = null; } // 10-1-5-3
}

// Move the game forward after effects are done. Returns true if something changed.
function advance(s) {
  const b = s.battle;
  if (b) {
    if (b.step === 'attack') {
      if (!onField(s, b.attacker) || !onField(s, b.target)) { endBattle(s); return true; } // 7-1-1-4
      b.step = 'block';
      if (!blockers(s).length) b.step = 'counter';
      return true;
    }
    if (b.step === 'blocked') { b.step = 'counter'; if (!onField(s, b.attacker) || !onField(s, b.target)) endBattle(s); return true; }
    if (b.step === 'damage') { damageStep(s); return true; }
    if (b.step === 'dealing') { dealDamage(s); return true; }
    if (b.step === 'end') { endBattle(s); return true; }
    return false;
  }
  if (s.flow === 'endTurn') { s.flow = 'endTurn2'; queueEndOfTurn(s); return true; }
  if (s.flow === 'endTurn2') { finishTurn(s); return true; }
  return false;
}

// ---------- battle ----------
function blockers(s) {
  const b = s.battle; const d = opp(s.active);
  if (b.blocked || keywords(s, b.attacker).has('Unblockable')) return [];
  return s.players[d].chars.filter(c => !c.rested && c.uid !== b.target && keywords(s, c.uid).has('Blocker') && !locked(s, c.uid, 'cannotRest'));
}

function damageStep(s) {
  const b = s.battle; const d = opp(s.active);
  const a = power(s, b.attacker), t = power(s, b.target);
  log(s, { e: 'clash', a, t, attacker: b.attacker, target: b.target });
  if (a < t) { b.step = 'end'; return; } // 7-1-4-2
  if (s.players[d].leader.uid === b.target) {
    b.damage = keywords(s, b.attacker).has('Double Attack') ? 2 : 1; // 10-1-2
    b.banish = keywords(s, b.attacker).has('Banish');
    b.step = 'dealing';
  } else { koChar(s, b.target, 'battle', s.active); b.step = 'end'; }
}

function dealDamage(s) {
  const b = s.battle; const d = opp(s.active); const P = s.players[d];
  if (b.damage <= 0) { b.step = 'end'; return; }
  b.damage -= 1;
  if (!P.life.length) { win(s, s.active, 'damage at 0 Life'); return; } // 7-1-4-1-1-1
  const top = P.life.shift();
  log(s, { e: 'damage', p: d });
  if (b.banish) { P.trash.push(top); return; } // 10-1-3
  if (effectsOf(top.id, 'trigger').length) { s.limbo = top; s.pending = { player: d, kind: 'trigger', uid: top.uid }; return; }
  P.hand.push(top);
}

function endBattle(s) {
  s.mods = s.mods.filter(m => m.until !== 'battle');
  if (s.battle) log(s, { e: 'battleEnd' });
  s.battle = null;
}

// K.O. a Character (10-2-1). by: 'battle'|'effect'.
export function koChar(s, uid, by, srcOwner) {
  const f = find(s, uid); if (!f || f.zone !== 'chars') return false;
  const P = s.players[f.owner];
  if (by === 'effect' && srcOwner !== f.owner && replaceRemoval(s, f.owner)) return false;
  P.chars.splice(f.index, 1);
  P.donRested += f.inst.don; f.inst.don = 0; f.inst.rested = false; // 6-5-5-4
  s.mods = s.mods.filter(m => m.uid !== uid);
  P.trash.push(f.inst);
  log(s, { e: 'ko', uid, id: f.inst.id });
  for (const [e, i] of effectsOf(f.inst.id, 'onKO')) if (!e.cond || e.cond(view(s, f.owner), f.inst)) pushEffect(s, f.owner, uid, f.inst.id, i); // 10-2-17
  return true;
}

// OP17-095 Roronoa Zoro: replace removal by an opponent's effect with putting 3 trash cards on the deck bottom.
export function replaceRemoval(s, owner) {
  const P = s.players[owner];
  const z = P.chars.find(c => c.id === 'OP17-095' && !negated(s, c.uid));
  if (!z || P.trash.length < 3) return false;
  P.deck.push(...P.trash.splice(P.trash.length - 3, 3));
  log(s, { e: 'replaced', p: owner });
  return true;
}

export function removeToHand(s, uid, srcOwner) {
  const f = find(s, uid); if (!f || f.zone !== 'chars') return false;
  if (srcOwner !== f.owner && replaceRemoval(s, f.owner)) return false;
  const P = s.players[f.owner];
  P.chars.splice(f.index, 1);
  P.donRested += f.inst.don; f.inst.don = 0; f.inst.rested = false;
  s.mods = s.mods.filter(m => m.uid !== uid);
  P.hand.push(f.inst);
  return true;
}

function win(s, p, why) { s.winner = p; s.phase = 'over'; s.pending = null; s.stack = []; log(s, { e: 'win', p, why }); }

// 1-2-1-1-2 + 9: rule processing after every action.
function ruleProcessing(s) {
  if (s.phase === 'over' || s.phase === 'mulligan') return;
  for (const p of [s.active, opp(s.active)]) if (!s.players[p].deck.length) { win(s, opp(p), 'deck out'); return; }
}

// ---------- playing cards ----------
export function payable(s, p, cost) { return s.players[p].donActive >= cost; }

export function playCharacter(s, p, inst, { rested = false, fromEffect = false } = {}) {
  const P = s.players[p];
  if (P.chars.length >= 5) { // 3-7-6-1: trash one first (rule processing, not a K.O.)
    s.pending = { player: p, kind: 'pick', purpose: 'trashOwnChar', options: P.chars.map(c => c.uid), min: 1, max: 1, prompt: 'You already have 5 Characters. Choose one to trash.', placing: inst.uid, rested };
    s.limboPlay = inst;
    return;
  }
  inst.rested = rested; inst.playedTurn = s.turn; inst.don = 0;
  P.chars.push(inst);
  log(s, { e: 'play', uid: inst.uid, id: inst.id, p });
  queue(s, p, inst, 'onPlay');
}

function playFromHand(s, p, uid) {
  const P = s.players[p];
  const i = P.hand.findIndex(c => c.uid === uid);
  const inst = P.hand[i];
  const d = def(inst.id);
  const cost = Math.max(0, costOf(s, uid));
  if (!payable(s, p, cost)) return `You need ${cost} active DON!! but have ${P.donActive}.`;
  if (d.type === 'Character' && locked(s, P.leader.uid, 'noCharPlay')) return "You can't play Characters this turn.";
  P.donActive -= cost; P.donRested += cost;
  P.hand.splice(i, 1);
  if (d.type === 'Character') playCharacter(s, p, inst);
  else if (d.type === 'Stage') {
    if (P.stage) P.trash.push(P.stage); // 3-8-5-1
    inst.rested = false; P.stage = inst;
    log(s, { e: 'play', uid: inst.uid, id: inst.id, p });
    queue(s, p, inst, 'onPlay');
  } else if (d.type === 'Event') {
    P.trash.push(inst);
    log(s, { e: 'event', uid: inst.uid, id: inst.id, p });
    const [e, idx] = effectsOf(inst.id, 'main')[0] || [];
    if (e && canTrigger(s, p, inst, e)) pushEffect(s, p, inst.uid, inst.id, idx);
  }
  return null;
}

// ---------- legal actions ----------
function canBattle(s) { return s.players[s.active].turns > 1; } // 6-5-6-1

function attackersAndTargets(s) {
  const p = s.active, P = s.players[p], Q = s.players[opp(p)];
  const out = [];
  for (const c of [P.leader, ...P.chars]) {
    if (c.rested || locked(s, c.uid, 'cannotAttack') || locked(s, c.uid, 'cannotRest')) continue;
    const kw = keywords(s, c.uid);
    const fresh = c !== P.leader && c.playedTurn === s.turn;
    if (fresh && !kw.has('Rush') && !kw.has('Rush: Character')) continue;
    const leaderOk = !fresh || kw.has('Rush');
    if (leaderOk) out.push({ type: 'attack', uid: c.uid, target: Q.leader.uid });
    for (const t of Q.chars) if (t.rested) out.push({ type: 'attack', uid: c.uid, target: t.uid });
  }
  return out;
}

function activations(s, p) {
  const out = [];
  for (const inst of fieldCards(s, p)) for (const [e, i] of effectsOf(inst.id, 'activateMain')) {
    if (!canTrigger(s, p, inst, e)) continue;
    if (e.costCheck && !e.costCheck(view(s, p), inst)) continue;
    if (e.restSelf && inst.rested) continue;
    out.push({ type: 'activate', uid: inst.uid, idx: i });
  }
  return out;
}

export function legalActions(s) {
  if (s.phase === 'over') return [];
  const who = actor(s);
  if (s.pending) return pendingActions(s);
  if (s.phase === 'mulligan') return s.mull.done.some(Boolean) || true ? [{ type: 'keep' }, { type: 'mulligan' }] : [];
  const P = s.players[who];
  const b = s.battle;
  if (b) {
    if (b.step === 'block') return [{ type: 'noBlock' }, ...blockers(s).map(c => ({ type: 'block', uid: c.uid }))];
    if (b.step === 'counter') {
      const out = [{ type: 'endCounter' }];
      for (const c of P.hand) {
        const d = def(c.id);
        if (d.type === 'Character' && d.counter) out.push({ type: 'counter', uid: c.uid });
        if (d.type === 'Event' && effectsOf(c.id, 'counter').length && payable(s, who, costOf(s, c.uid))) out.push({ type: 'counter', uid: c.uid });
      }
      return out;
    }
    return [];
  }
  const out = [{ type: 'endTurn' }];
  for (const c of P.hand) {
    const d = def(c.id);
    if (!payable(s, who, Math.max(0, costOf(s, c.uid)))) continue;
    if (d.type === 'Character' && locked(s, P.leader.uid, 'noCharPlay')) continue;
    if (d.type === 'Event' && !effectsOf(c.id, 'main').length) continue;
    out.push({ type: 'play', uid: c.uid });
  }
  if (P.donActive > 0) for (const c of [P.leader, ...P.chars]) out.push({ type: 'giveDon', uid: c.uid });
  if (canBattle(s)) out.push(...attackersAndTargets(s));
  out.push(...activations(s, who));
  return out;
}

function pendingActions(s) {
  const pd = s.pending;
  if (pd.kind === 'trigger') return [{ type: 'useTrigger' }, { type: 'skipTrigger' }];
  if (pd.kind === 'confirm') return [{ type: 'choose', yes: true }, { type: 'choose', yes: false }];
  if (pd.kind === 'mode') return pd.labels.map((_, i) => ({ type: 'choose', option: i }));
  if (pd.kind === 'pick') {
    // Offer: nothing (if allowed), each single option, and the greedy "first max" set.
    const out = [];
    if (pd.min === 0) out.push({ type: 'choose', picks: [] });
    if (pd.min <= 1) for (const o of pd.options) out.push({ type: 'choose', picks: [o] });
    if (pd.max > 1 && pd.options.length > 1) out.push({ type: 'choose', picks: pd.options.slice(0, Math.min(pd.max, pd.options.length)) });
    if (pd.min > 1) out.push({ type: 'choose', picks: pd.options.slice(0, pd.min) });
    return out;
  }
  return [];
}

// ---------- dispatch ----------
export function dispatch(prev, action) {
  if (prev.phase === 'over') return { ...prev, error: 'The game is over.' };
  const s = clone(prev);
  delete s.error;
  const err = apply(s, action);
  if (err) return { ...prev, error: err };
  run(s);
  ruleProcessing(s);
  return s;
}

function apply(s, a) {
  const who = actor(s);
  if (s.pending) return answerPending(s, a);

  if (s.phase === 'mulligan') {
    const P = s.players[who];
    if (a.type === 'mulligan') { P.deck.push(...P.hand); P.hand = []; shuffle(s, P.deck); P.hand = P.deck.splice(0, 5); }
    else if (a.type !== 'keep') return 'Choose to keep or redraw your hand.';
    s.mull.done[who] = true;
    if (s.mull.done.every(Boolean)) { s.mull = null; placeLife(s); startTurn(s, s.first); }
    else s.mull.next = opp(who);
    return null;
  }

  const P = s.players[who];
  const b = s.battle;
  if (b) {
    if (b.step === 'block') {
      if (a.type === 'noBlock') { b.step = 'counter'; return null; }
      if (a.type === 'block') {
        if (!blockers(s).some(c => c.uid === a.uid)) return 'That card can\'t block.';
        const c = find(s, a.uid).inst; c.rested = true;
        b.target = a.uid; b.blocked = true; b.step = 'blocked';
        log(s, { e: 'block', uid: a.uid });
        queue(s, who, c, 'onBlock');
        return null;
      }
      return 'Choose a Blocker or no block.';
    }
    if (b.step === 'counter') {
      if (a.type === 'endCounter') { b.step = 'damage'; return null; }
      if (a.type === 'counter') {
        const f = find(s, a.uid);
        if (!f || f.zone !== 'hand' || f.owner !== who) return 'Counter with a card from your hand.';
        const d = def(f.inst.id);
        if (d.type === 'Character' && d.counter) {
          P.hand.splice(f.index, 1); P.trash.push(f.inst);
          s.mods.push({ uid: b.target, kind: 'power', amount: d.counter, until: 'battle', owner: who }); // 7-1-3-1-1
          log(s, { e: 'counter', id: f.inst.id, amount: d.counter });
          return null;
        }
        const [e, idx] = effectsOf(f.inst.id, 'counter')[0] || [];
        if (d.type === 'Event' && e) {
          const cost = Math.max(0, costOf(s, a.uid));
          if (!payable(s, who, cost)) return `You need ${cost} active DON!!.`;
          P.donActive -= cost; P.donRested += cost;
          P.hand.splice(f.index, 1); P.trash.push(f.inst);
          log(s, { e: 'event', id: f.inst.id, p: who });
          if (canTrigger(s, who, f.inst, e)) pushEffect(s, who, f.inst.uid, f.inst.id, idx);
          return null;
        }
        return 'That card has no Counter.';
      }
      return 'Use a Counter or finish.';
    }
    return 'A battle is in progress.';
  }

  switch (a.type) {
    case 'endTurn': s.flow = 'endTurn'; log(s, { e: 'endTurn', p: who }); return null;
    case 'play': {
      const f = find(s, a.uid);
      if (!f || f.zone !== 'hand' || f.owner !== who) return 'That card is not in your hand.';
      if (!legalActions(s).some(x => x.type === 'play' && x.uid === a.uid)) {
        const cost = Math.max(0, costOf(s, a.uid));
        return payable(s, who, cost) ? "You can't play that card now." : `You need ${cost} active DON!! but have ${P.donActive}.`;
      }
      return playFromHand(s, who, a.uid);
    }
    case 'giveDon': {
      const f = find(s, a.uid);
      if (!f || f.owner !== who || !['leader', 'chars'].includes(f.zone)) return 'Give DON!! to your Leader or a Character.';
      if (P.donActive < 1) return 'You have no active DON!!.';
      P.donActive -= 1; f.inst.don += 1; // 6-5-5-1
      log(s, { e: 'don', uid: a.uid });
      return null;
    }
    case 'attack': {
      if (!canBattle(s)) return "Nobody can attack on their first turn.";
      if (!attackersAndTargets(s).some(x => x.uid === a.uid && x.target === a.target)) return "That attack isn't allowed.";
      const atk = find(s, a.uid).inst; atk.rested = true; // 7-1-1-1
      s.battle = { attacker: a.uid, target: a.target, step: 'attack', blocked: false };
      log(s, { e: 'attack', uid: a.uid, target: a.target });
      queue(s, who, atk, 'whenAttacking'); // 7-1-1-3
      const d = opp(who);
      for (const c of fieldCards(s, d)) queue(s, d, c, 'onOppAttack');
      // Effects resolve in stack order: put the attacker's first.
      s.stack.reverse();
      return null;
    }
    case 'activate': {
      if (!activations(s, who).some(x => x.uid === a.uid && x.idx === a.idx)) return "That ability can't be used now.";
      const inst = find(s, a.uid).inst;
      const e = cardDef(inst.id).effects[a.idx];
      if (e.once) s.once[`${inst.uid}:${e.key || 'x'}:${s.turn}`] = true;
      if (e.restSelf) inst.rested = true;
      pushEffect(s, who, inst.uid, inst.id, a.idx);
      log(s, { e: 'activate', uid: a.uid, id: inst.id });
      return null;
    }
    default: return 'Unknown action.';
  }
}

function answerPending(s, a) {
  const pd = s.pending;
  if (pd.kind === 'trigger') {
    if (a.type !== 'useTrigger' && a.type !== 'skipTrigger') return 'Use the Trigger or add the card to your hand.';
    s.pending = null;
    const inst = s.limbo;
    if (a.type === 'skipTrigger') { s.players[pd.player].hand.push(inst); s.limbo = null; return null; }
    const [e, idx] = effectsOf(inst.id, 'trigger')[0];
    log(s, { e: 'trigger', id: inst.id, p: pd.player });
    if (e.cond && !e.cond(view(s, pd.player), inst)) { s.players[pd.player].trash.push(inst); s.limbo = null; return null; }
    pushEffect(s, pd.player, inst.uid, inst.id, idx, { kind: 'trigger' });
    return null;
  }
  if (a.type !== 'choose') return 'Make a choice first.';
  if (pd.kind === 'pick') {
    const picks = a.picks || [];
    if (picks.length < pd.min || picks.length > pd.max || picks.some(x => !pd.options.includes(x)) || new Set(picks).size !== picks.length) return `Choose ${pd.min === pd.max ? pd.min : `${pd.min} to ${pd.max}`}.`;
    if (pd.budget != null && picks.reduce((n, u) => n + costOf(s, u), 0) > pd.budget) return `The total cost must be ${pd.budget} or less.`;
  }
  if (pd.kind === 'mode' && !(a.option >= 0 && a.option < pd.labels.length)) return 'Choose one option.';
  s.pending = null;
  if (pd.purpose === 'trashOwnChar') {
    const P = s.players[pd.player];
    const i = P.chars.findIndex(c => c.uid === a.picks[0]);
    const [gone] = P.chars.splice(i, 1);
    P.donRested += gone.don; gone.don = 0; gone.rested = false;
    s.mods = s.mods.filter(m => m.uid !== gone.uid);
    P.trash.push(gone);
    const inst = s.limboPlay; s.limboPlay = null;
    playCharacter(s, pd.player, inst, { rested: pd.rested });
    return null;
  }
  // An effect step is waiting for this answer.
  const f = s.stack[s.stack.length - 1];
  const e = cardDef(f.cardId).effects[f.eff];
  const steps = f.steps || e.steps;
  const r = runStep(s, f, steps[f.step], a);
  if (r !== 'wait') f.step++;
  return null;
}

// ---------- end of turn ----------
function queueEndOfTurn(s) {
  const p = s.active;
  for (const d of s.delayed.filter(x => x.turn === s.turn && x.owner === p)) s.stack.push({ owner: p, src: d.src, cardId: d.cardId, eff: d.eff, step: 0, ctx: {}, paid: true, steps: d.steps });
  s.delayed = s.delayed.filter(x => x.turn !== s.turn);
  for (const c of fieldCards(s, p)) queue(s, p, c, 'endOfTurn'); // 6-6-1-1
}
