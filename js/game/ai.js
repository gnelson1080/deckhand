// Computer players. They only ever pick from legalActions(state) and never look at hidden cards
// (the opponent's hand contents or anyone's Life/deck order).
import { legalActions, dispatch, actor, power, keywords, costOf, find, def } from './engine.js';

const opp = p => 1 - p;

// What player p is allowed to know: hide the opponent's hand, every Life card and both decks.
export function publicView(s, p) {
  const blank = c => ({ ...c, id: '__X' });
  const v = { ...s, players: s.players.map((P, i) => ({
    ...P,
    hand: i === p ? P.hand : P.hand.map(blank),
    life: P.life.map(blank),
    deck: P.deck.map(blank),
  })) };
  return v;
}

// ---------- evaluation (public information only) ----------
export function evaluate(s, p) {
  if (s.winner === p) return 1e6;
  if (s.winner === opp(p)) return -1e6;
  const me = s.players[p], them = s.players[opp(p)];
  const boardVal = P => P.chars.reduce((n, c) => n + 100 + (def(c.id).power || 0) / 10 + costOf(s, c.uid) * 30 - (c.rested ? 40 : 0), 0);
  return (
    (5 - them.life.length) * 900 - (5 - me.life.length) * 450
    + boardVal(me) - boardVal(them) * 0.9
    + me.hand.length * 110 - them.hand.length * 70
    + (me.stage ? 120 : 0)
    + me.trash.length * 2
  );
}

// ---------- choices for pending decisions ----------
const owned = (s, uid) => (uid.startsWith('DON:') ? actor(s) : uid.startsWith('ODON:') ? opp(actor(s)) : find(s, uid)?.owner);
const cardValue = (s, uid) => { if (uid.includes('DON:')) return 150; const f = find(s, uid); if (!f) return 0; const d = def(f.inst.id); return (d.cost ?? 3) * 100 + (d.power || 0) / 20 + (f.zone === 'leader' ? 2000 : 0); };

function choosePick(s, p, pd) {
  const opts = pd.options;
  if (!opts.length) return { type: 'choose', picks: [] };
  const prompt = (pd.prompt || '').toLowerCase();
  let ranked;
  if (pd.budget != null) { // Loki: greedy by cost within budget
    const picks = []; let left = pd.budget;
    for (const u of [...opts].sort((a, b) => costOf(s, b) - costOf(s, a))) if (costOf(s, u) <= left) { picks.push(u); left -= costOf(s, u); }
    return { type: 'choose', picks };
  }
  const mine = opts.filter(u => owned(s, u) === p), theirs = opts.filter(u => owned(s, u) !== p);
  if (pd.show === 'hand' || prompt.includes('trash')) ranked = [...opts].sort((a, b) => cardValue(s, a) - cardValue(s, b)); // give up the least valuable
  else if (pd.show === 'look' || pd.show === 'trash' || prompt.includes('play') || prompt.includes('add')) ranked = [...opts].sort((a, b) => cardValue(s, b) - cardValue(s, a));
  else if (prompt.includes('rest') && prompt.includes('your')) ranked = [...mine.filter(u => u.startsWith('DON:')), ...mine.filter(u => !u.startsWith('DON:')).sort((a, b) => cardValue(s, a) - cardValue(s, b))];
  else if (theirs.length && !mine.length) ranked = [...theirs].sort((a, b) => cardValue(s, b) - cardValue(s, a));
  else if (mine.length) {
    const bt = s.battle?.target;
    ranked = [...mine].sort((a, b) => (b === bt) - (a === bt) || cardValue(s, b) - cardValue(s, a));
  } else ranked = [...opts];
  const n = Math.max(pd.min, Math.min(pd.max, ranked.length));
  return { type: 'choose', picks: ranked.slice(0, n) };
}

function chooseMode(s, p, pd) {
  if (pd.labels[0]?.startsWith("Don't use")) { // OP13-001 Luffy: rest just enough DON!! to survive
    const b = s.battle; if (!b) return { type: 'choose', option: 0 };
    const gap = power(s, b.attacker) - power(s, b.target);
    if (gap < 0) return { type: 'choose', option: 0 };
    const need = Math.floor(gap / 2000) + 1;
    return { type: 'choose', option: Math.min(need, pd.labels.length - 1) };
  }
  if (pd.labels.length === 2 && /Life/.test(pd.labels[0])) return { type: 'choose', option: s.players[p].life.length <= 2 ? 0 : 1 };
  return { type: 'choose', option: 0 };
}

export function decidePending(s, p) {
  const pd = s.pending;
  if (pd.kind === 'trigger') return { type: 'useTrigger' };
  if (pd.kind === 'confirm') {
    if (/Life card to your hand/i.test(pd.prompt) && s.players[p].life.length <= 1) return { type: 'choose', yes: false };
    return { type: 'choose', yes: true };
  }
  if (pd.kind === 'mode') return chooseMode(s, p, pd);
  return choosePick(s, p, pd);
}

// ---------- defending ----------
function defend(s, p, level) {
  const b = s.battle, acts = legalActions(s);
  const me = s.players[p];
  const isLeader = b.target === me.leader.uid;
  const atk = power(s, b.attacker), tgt = power(s, b.target);
  const gap = atk - tgt; // we need power > atk, i.e. add more than gap
  const lethalish = isLeader && me.life.length <= (level === 'hard' ? 2 : 1);
  const valuable = !isLeader && costOf(s, b.target) >= 4;
  if (b.step === 'block') {
    if (gap < 0) return { type: 'noBlock' };
    const blocks = acts.filter(a => a.type === 'block');
    if (blocks.length && (lethalish || valuable || (isLeader && me.life.length <= 2))) {
      blocks.sort((x, y) => cardValue(s, x.uid) - cardValue(s, y.uid));
      return blocks[0];
    }
    return { type: 'noBlock' };
  }
  // counter step
  if (gap < 0) return { type: 'endCounter' };
  const counters = acts.filter(a => a.type === 'counter').map(a => {
    const d = def(find(s, a.uid).inst.id);
    return { a, value: d.type === 'Character' ? d.counter : 3000, cost: d.type === 'Character' ? 0 : costOf(s, a.uid) };
  }).sort((x, y) => x.value - y.value);
  const total = counters.reduce((n, c) => n + c.value, 0);
  const worth = lethalish || (isLeader && me.life.length <= 2 && me.hand.length >= 3) || (valuable && gap < 2000) || (level === 'hard' && isLeader && me.hand.length >= 6 && gap < 2000);
  if (!worth || total <= gap) return { type: 'endCounter' };
  // smallest single card that covers the gap, else the biggest one (and keep going next call)
  const single = counters.find(c => c.value > gap);
  return (single || counters[counters.length - 1]).a;
}

// ---------- main phase ----------
function resolveForSim(s, p, budget = 40) {
  // Play out pending choices and the opponent's battle responses with simple policies.
  let g = s;
  while (budget-- > 0 && g.phase !== 'over') {
    const who = actor(g);
    if (g.pending) { g = dispatch(g, decidePending(g, who)); continue; }
    if (g.battle && who !== p) { g = dispatch(g, defend(g, who, 'normal')); continue; }
    break;
  }
  return g;
}

function attackPlan(s, p, a, level) {
  // Would this attack land? If it falls short, how many DON!! would make it land?
  const atk = power(s, a.uid), tgt = power(s, a.target);
  const oppHand = s.players[opp(p)].hand.length;
  const buffer = level === 'hard' && find(s, a.target).zone === 'leader' ? Math.min(2, Math.floor(oppHand / 3)) * 1000 : 0;
  const need = tgt + buffer - atk;
  return need <= 0 ? 0 : Math.ceil(need / 1000);
}

// Hard: for each candidate, play out the rest of this turn with the Normal policy and keep the best end state.
function playOutTurn(s, p, limit = 40) {
  let g = s;
  const turn = s.turn;
  while (g.phase !== 'over' && g.turn === turn && limit-- > 0) {
    const who = actor(g);
    const a = who === p ? chooseAction(g, p, 'normal') : g.pending ? decidePending(g, who) : defend(g, who, 'normal');
    if (!a || (a.type === 'endTurn' && who === p)) break;
    const n = dispatch(g, a);
    if (n.error) break;
    g = n;
  }
  return g;
}

function chooseHard(s, p) {
  const pub = publicView(s, p);
  const t0 = Date.now();
  const acts = legalActions(s).filter(a => a.type !== 'endTurn');
  const normalPick = chooseAction(s, p, 'normal');
  const cands = [{ type: 'endTurn' }, normalPick, ...acts.filter(a => a.type === 'play' || a.type === 'activate' || a.type === 'attack')].filter(Boolean);
  const seen = new Set();
  let best = normalPick, bestScore = -Infinity;
  for (const a of cands) {
    const key = JSON.stringify(a);
    if (seen.has(key)) continue;
    if (seen.size >= 2 && Date.now() - t0 > 300) break; // time budget: phones stay responsive
    seen.add(key);
    const first = dispatch(pub, a);
    if (first.error) continue;
    const end = a.type === 'endTurn' ? first : playOutTurn(resolveForSim(first, p), p);
    let score = evaluate(end, p);
    // Hard also values keeping Counter cards for the opponent's turn.
    score += end.players[p].hand.filter(c => def(c.id).counter).length * 40;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}

export function chooseAction(s, p, level = 'normal', rand = Math.random) {
  if (level === 'hard' && !s.pending && !s.battle && s.phase === 'main') return chooseHard(s, p);
  const acts = legalActions(s);
  if (!acts.length) return null;
  if (s.pending) return level === 'easy' && s.pending.kind === 'pick' && rand() < 0.5 ? acts[Math.floor(rand() * acts.length)] : decidePending(s, p);
  if (s.phase === 'mulligan') {
    const keep = s.players[p].hand.some(c => def(c.id).type === 'Character' && (def(c.id).cost ?? 9) <= 2);
    return { type: keep || level === 'easy' ? 'keep' : 'mulligan' };
  }
  if (s.battle) return level === 'easy' ? acts[Math.floor(rand() * acts.length)] : defend(s, p, level);

  if (level === 'easy') {
    const nonEnd = acts.filter(a => a.type !== 'endTurn');
    if (!nonEnd.length || rand() < 0.2) return { type: 'endTurn' };
    return nonEnd[Math.floor(rand() * nonEnd.length)];
  }

  const pub = publicView(s, p);
  const base = evaluate(pub, p);
  let best = null, bestScore = -Infinity;
  const P = s.players[p];
  for (const a of acts) {
    if (a.type === 'endTurn' || a.type === 'giveDon') continue;
    let score;
    if (a.type === 'attack') {
      const k = attackPlan(s, p, a, level);
      if (k > P.donActive) continue; // can't make it land
      if (k > 0) { // give DON!! first, then attack next decision
        const g = s.players[p].chars.concat([P.leader]).find(c => c.uid === a.uid);
        if (!g) continue;
        score = 600 - k * 60 + (find(s, a.target).zone === 'leader' ? 300 : costOf(s, a.target) * 80);
        if (score > bestScore) { bestScore = score; best = { type: 'giveDon', uid: a.uid }; }
        continue;
      }
      const sim = resolveForSim(dispatch(pub, a), p);
      score = evaluate(sim, p) - base + (find(s, a.target)?.zone === 'leader' ? 150 : 100);
    } else {
      const sim = resolveForSim(dispatch(pub, a), p);
      if (sim.error) continue;
      score = evaluate(sim, p) - base;
      if (a.type === 'play') score += 60 + (def(find(s, a.uid).inst.id).cost ?? 0) * 25; // developing the board is good
      if (a.type === 'activate') score += 30;
    }
    if (score > bestScore) { bestScore = score; best = a; }
  }
  if (best && bestScore > 0) return best;
  // Leftover DON!!: put it on the Leader for defense (it stays given on the opponent's turn only for effects like OP13-001)
  if (P.donActive > 0 && P.leader.id === 'OP13-001' && P.leader.don < 1) return { type: 'giveDon', uid: P.leader.uid };
  return { type: 'endTurn' };
}

// Play a whole game between two AIs (used by tests and the fuzz run).
export function autoplay(s, levels, rand, maxActions = 4000) {
  let g = s, n = 0, perTurn = 0, lastTurn = -1;
  while (g.phase !== 'over' && n++ < maxActions) {
    const who = actor(g);
    if (g.turn !== lastTurn) { lastTurn = g.turn; perTurn = 0; }
    let a = chooseAction(g, who, levels[who], rand);
    if (++perTurn > 80 && !g.pending && !g.battle && g.phase === 'main') a = { type: 'endTurn' };
    const next = dispatch(g, a);
    if (next.error) throw new Error(`AI chose an illegal action ${JSON.stringify(a)}: ${next.error}`);
    g = next;
  }
  return g;
}
