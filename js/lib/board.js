// Tiny rules core for lesson practice boards. Pure and immutable: (state, action) -> new state.
// Follows the official Comprehensive Rules for the parts the lessons teach:
// DON!! giving (+1000 on your turn), paying costs, attacking (attacker wins ties),
// one block per battle, counters during your opponent's attack, Life damage and Triggers.

const side = (s, who) => s[who];
const other = who => (who === 'me' ? 'opp' : 'me');

export function makeBoard({ me, opp, turn = 'me' }) {
  const mk = p => ({
    leader: { don: 0, rested: false, ...p.leader },
    chars: (p.chars || []).map(c => ({ don: 0, rested: false, ...c })),
    hand: [...(p.hand || [])],
    trash: [],
    donActive: p.don ?? 0,
    donRested: p.donRested ?? 0,
    life: p.life ?? 4,
    lifeCards: [...(p.lifeCards || [])],
  });
  return { me: mk(me), opp: mk(opp), turn, battle: null, pendingTrigger: null, winner: null, error: null, log: [] };
}

const clone = s => structuredClone(s);

function findCard(s, who, id) {
  const p = side(s, who);
  if (p.leader.id === id) return p.leader;
  return p.chars.find(c => c.id === id) || null;
}
const ownerOf = (s, id) => (findCard(s, 'me', id) ? 'me' : findCard(s, 'opp', id) ? 'opp' : null);

export function powerOf(s, who, id) {
  const c = findCard(s, who, id);
  if (!c) return null;
  let p = c.power + (s.turn === who ? (c.don || 0) * 1000 : 0);
  if (s.battle && s.battle.target === id) p += s.battle.counter;
  return p;
}

const fail = (s, msg) => ({ ...s, error: msg });

export function boardReducer(prev, action) {
  if (prev.winner && action.type !== 'reset') return prev;
  const s = clone(prev);
  s.error = null;
  const turnP = side(s, s.turn);

  switch (action.type) {
    case 'rest': {
      const c = findCard(s, ownerOf(s, action.card) || s.turn, action.card);
      if (!c || c.rested) return prev;
      c.rested = true;
      return s;
    }
    case 'giveDon': {
      if (s.battle) return fail(s, 'Finish the battle first.');
      if (turnP.donActive < 1) return fail(s, 'You have no active DON!! left to give.');
      const c = findCard(s, s.turn, action.target);
      if (!c) return fail(s, 'You can only give DON!! to your own Leader or Characters.');
      turnP.donActive -= 1;
      c.don = (c.don || 0) + 1;
      s.log.push({ t: 'don', id: c.id });
      return s;
    }
    case 'play': {
      if (s.battle) return fail(s, 'Finish the battle first.');
      const i = turnP.hand.findIndex(c => c.id === action.card);
      if (i < 0) return fail(s, 'That card is not in your hand.');
      const card = turnP.hand[i];
      if (turnP.donActive < (card.cost || 0)) return fail(s, `You need ${card.cost} active DON!! to play this, but you have ${turnP.donActive}.`);
      if (turnP.chars.length >= 5) return fail(s, 'You already have 5 Characters. Trash one first.');
      turnP.donActive -= card.cost || 0;
      turnP.donRested += card.cost || 0;
      turnP.hand.splice(i, 1);
      turnP.chars.push({ don: 0, ...card, rested: false, justPlayed: true });
      s.log.push({ t: 'play', id: card.id });
      return s;
    }
    case 'attack': {
      if (s.battle) return fail(s, 'A battle is already happening.');
      const atk = findCard(s, s.turn, action.attacker);
      if (!atk) return fail(s, 'Attack with your own Leader or Character.');
      if (atk.rested) return fail(s, 'That card is rested (sideways) and can\'t attack.');
      if (atk.justPlayed && !atk.rush) return fail(s, 'A Character can\'t attack on the turn it was played unless it has [Rush].');
      const defWho = other(s.turn);
      const tgt = findCard(s, defWho, action.target);
      if (!tgt) return fail(s, 'Attack your opponent\'s Leader or one of their Characters.');
      if (tgt !== side(s, defWho).leader && !tgt.rested) return fail(s, 'You can only attack Characters that are rested (sideways).');
      atk.rested = true;
      s.battle = { attacker: atk.id, target: tgt.id, counter: 0, blocked: false };
      s.log.push({ t: 'attack', id: atk.id, target: tgt.id });
      return s;
    }
    case 'block': {
      if (!s.battle) return fail(s, 'Blocking only happens during an attack.');
      if (s.battle.blocked) return fail(s, 'You can only block once per attack.');
      const defWho = other(s.turn);
      const b = side(s, defWho).chars.find(c => c.id === action.blocker);
      if (!b?.blocker) return fail(s, 'Only a card with [Blocker] can block.');
      if (b.rested) return fail(s, 'A rested Blocker can\'t block.');
      b.rested = true;
      s.battle.target = b.id;
      s.battle.counter = 0;
      s.battle.blocked = true;
      s.log.push({ t: 'block', id: b.id });
      return s;
    }
    case 'useCounter': {
      if (!s.battle) return fail(s, 'Counters are used while you are being attacked.');
      const defP = side(s, other(s.turn));
      const i = defP.hand.findIndex(c => c.id === action.card);
      if (i < 0 || !defP.hand[i].counter) return fail(s, 'That card has no Counter value.');
      const [card] = defP.hand.splice(i, 1);
      defP.trash.push(card);
      s.battle.counter += card.counter;
      s.log.push({ t: 'counter', id: card.id, amount: card.counter });
      return s;
    }
    case 'resolve': {
      if (!s.battle) return prev;
      const defWho = other(s.turn);
      const defP = side(s, defWho);
      const a = powerOf(s, s.turn, s.battle.attacker);
      const d = powerOf(s, defWho, s.battle.target);
      const hit = a >= d;
      const target = s.battle.target;
      s.log.push({ t: 'result', hit, a, d });
      s.battle = null;
      if (!hit) return s;
      if (target === defP.leader.id) {
        if (defP.life <= 0) { s.winner = s.turn; return s; }
        defP.life -= 1;
        const top = defP.lifeCards.shift() || null;
        if (top?.trigger) s.pendingTrigger = { ...top, owner: defWho };
        else if (top) defP.hand.push(top);
      } else {
        const i = defP.chars.findIndex(c => c.id === target);
        const [ko] = defP.chars.splice(i, 1);
        defP.donRested += ko.don || 0;
        defP.trash.push({ ...ko, don: 0 });
      }
      return s;
    }
    case 'useTrigger':
    case 'skipTrigger': {
      const t = s.pendingTrigger;
      if (!t) return prev;
      const p = side(s, t.owner);
      const { owner, ...card } = t;
      if (action.type === 'useTrigger' && card.trigger === 'play') p.chars.push({ don: 0, ...card, rested: false });
      else if (action.type === 'useTrigger') p.trash.push(card);
      else p.hand.push(card);
      s.pendingTrigger = null;
      s.log.push({ t: action.type, id: card.id });
      return s;
    }
    case 'endTurn': {
      if (s.battle) return fail(s, 'Finish the battle first.');
      s.turn = other(s.turn);
      return s;
    }
    default:
      return prev;
  }
}
