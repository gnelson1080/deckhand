// Build a precise board for rules/effect tests.
import { buildState } from '../../js/game/engine.js';

const pad = (ids, n, filler) => [...ids, ...Array(Math.max(0, n - ids.length)).fill(filler)];

// spec per player: { leader, hand:[ids], chars:[ids | {id, rested, don, played}], deck:[ids], life:[ids], trash:[ids], stage, donActive, donRested, donDeck }
export function board({ p0 = {}, p1 = {}, active = 0, turn = 5, first = 0 } = {}) {
  const def = (p, leader) => ({
    leader: p.leader || leader,
    hand: p.hand || [],
    chars: p.chars || [],
    deck: p.deck || pad([], 20, 'OP12-023'),
    life: p.life || pad([], 3, 'OP12-023'),
    trash: p.trash || [],
    stage: p.stage || null,
    donActive: p.donActive ?? 5,
    donRested: p.donRested ?? 0,
    donDeck: p.donDeck ?? 5,
  });
  return buildState({ players: [def(p0, 'ST30-001'), def(p1, 'OP14-020')], active, turn, first });
}

export const uidOf = (s, who, zone, i = 0) => (zone === 'leader' ? s.players[who].leader.uid : s.players[who][zone][i].uid);
