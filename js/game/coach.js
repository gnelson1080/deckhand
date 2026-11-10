// The coach: explains what's happening, reacts to moves, and suggests a move with a reason.
import { actor, power, find, def, costOf, legalActions, keywords } from './engine.js';
import { chooseAction } from './ai.js';

const name = (s, uid) => { const f = find(s, uid); return f ? def(f.inst.id).name : 'that card'; };
const n = x => x.toLocaleString('en-US');

export function describeAction(s, a) {
  switch (a.type) {
    case 'play': return `Play ${name(s, a.uid)} (cost ${Math.max(0, costOf(s, a.uid))})`;
    case 'giveDon': return `Give 1 DON!! to ${name(s, a.uid)}`;
    case 'attack': return `Attack ${name(s, a.target)} with ${name(s, a.uid)}`;
    case 'activate': return `Use ${name(s, a.uid)}'s ability`;
    case 'endTurn': return 'End your turn';
    case 'block': return `Block with ${name(s, a.uid)}`;
    case 'noBlock': return "Don't block";
    case 'counter': return `Counter with ${name(s, a.uid)}`;
    case 'endCounter': return 'Finish defending';
    case 'useTrigger': return 'Use the Trigger';
    case 'skipTrigger': return 'Add the card to your hand';
    case 'keep': return 'Keep this hand';
    case 'mulligan': return 'Redraw a new hand';
    case 'choose': return a.picks ? (a.picks.length ? `Choose ${a.picks.map(u => (u.includes('DON:') ? 'a DON!!' : name(s, u))).join(', ')}` : 'Choose nothing') : a.yes != null ? (a.yes ? 'Yes' : 'No') : 'Choose that option';
    default: return a.type;
  }
}

export function phaseTip(s, me) {
  if (s.phase === 'over') return s.winner === me ? 'You won! Every hit on the Leader at 0 Life ends the game.' : 'You lost this one. Try again; the coach will keep helping.';
  if (s.phase === 'mulligan') return 'Look at your hand. Keep it if you have cheap cards (cost 1–2) to play early. You may redraw once.';
  if (actor(s) !== me) return "Your opponent is thinking. Watch what they play and attack with.";
  const pd = s.pending;
  if (pd?.kind === 'trigger') return 'A Life card with [Trigger] was revealed. Using it is free; otherwise it goes to your hand like normal damage.';
  if (pd) return pd.prompt || 'Make a choice for this effect.';
  const b = s.battle;
  if (b?.step === 'block') return `You're being attacked: ${n(power(s, b.attacker))} vs ${n(power(s, b.target))}. A [Blocker] can take the hit instead.`;
  if (b?.step === 'counter') {
    const gap = power(s, b.attacker) - power(s, b.target);
    return gap >= 0 ? `Counter step. You need more than ${n(gap)} extra power to stop this (ties go to the attacker).` : 'Counter step. You are already strong enough; no need to spend cards.';
  }
  const P = s.players[me];
  if (P.turns <= 1 && s.turn <= 2) return 'First turn: play cheap cards. Nobody can attack on their own first turn.';
  if (P.donActive > 0) return `You have ${P.donActive} DON!! ready. Play cards, or give DON!! (+1000 each this turn) before attacking.`;
  return 'Attack with your Leader or rested-ready Characters, then end your turn.';
}

export function judge(prev, a, next, me) {
  if (actor(prev) !== me) return null;
  if (a.type === 'attack') {
    const atk = power(prev, a.uid), tgt = power(prev, a.target);
    if (atk < tgt) return { tone: 'risky', text: `This attack can't win: ${n(atk)} power against ${n(tgt)}. Give it ${Math.ceil((tgt - atk) / 1000)} DON!! first, or pick another target.` };
    const P = prev.players[1 - me];
    if (find(prev, a.target).zone === 'leader' && atk - tgt < 1000 && P.hand.length >= 2) return { tone: 'ok', text: `It hits only if they don't Counter. Their ${P.hand.length} cards in hand may hold +1000 or +2000 Counters.` };
    return { tone: 'good', text: find(prev, a.target).zone === 'leader' ? 'Good pressure on their Leader.' : 'Good: removing a rested Character keeps their board small.' };
  }
  if (a.type === 'endTurn') {
    const playable = legalActions(prev).filter(x => x.type === 'play');
    if (playable.length && prev.players[me].donActive >= 2) return { tone: 'risky', text: `You still have ${prev.players[me].donActive} DON!! and ${playable.length} card${playable.length > 1 ? 's' : ''} you could play. Unused DON!! are wasted this turn.` };
    return null;
  }
  if (a.type === 'counter') {
    const b = prev.battle; const P = prev.players[me];
    if (b && b.target === P.leader.uid && P.life.length >= 3) return { tone: 'ok', text: `You have ${P.life.length} Life, and taking a hit gives you a card. Counters are usually better saved for when your Life is low.` };
    return { tone: 'good', text: 'Good defense.' };
  }
  if (a.type === 'block') return { tone: 'good', text: `${name(prev, a.uid)} takes the hit so your ${name(prev, prev.battle.target)} is safe.` };
  if (a.type === 'play') {
    const d = def(find(prev, a.uid).inst.id);
    if (d.type === 'Character' && prev.players[me].chars.length >= 5) return { tone: 'ok', text: 'You have 5 Characters, so one gets trashed to make room.' };
    return null;
  }
  return null;
}

export function hint(s, me) {
  const action = chooseAction(s, me, 'normal');
  if (!action) return null;
  let why = '';
  switch (action.type) {
    case 'play': why = 'It uses your DON!! well and builds your board.'; break;
    case 'giveDon': why = 'More power means your next attack can win its battle.'; break;
    case 'attack': why = `${n(power(s, action.uid))} vs ${n(power(s, action.target))}: the attacker wins ties.`; break;
    case 'endTurn': why = "There's nothing useful left to do this turn."; break;
    case 'block': why = "Blocking keeps your Leader's Life safe."; break;
    case 'noBlock': case 'endCounter': why = 'Save your cards; this hit is fine to take.'; break;
    case 'counter': why = 'This keeps the attack from landing.'; break;
    case 'activate': why = 'This ability gives you value right now.'; break;
    default: why = 'It looks like the best option here.';
  }
  if (action.type === 'attack' && keywords(s, action.uid).has('Double Attack')) why += ' [Double Attack] deals 2 damage.';
  return { action, text: `${describeAction(s, action)}. ${why}` };
}
