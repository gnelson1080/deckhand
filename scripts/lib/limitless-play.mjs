// Limitless Play (online tournaments with full decklists and win/loss records).
// API: play.limitlesstcg.com/api/tournaments?game=OP and /api/tournaments/<id>/standings
export const LT_PLAY = 'https://play.limitlesstcg.com';
export const tournamentsUrl = (limit = 100, page = 1) => `${LT_PLAY}/api/tournaments?game=OP&limit=${limit}&page=${page}`;
export const standingsUrl = id => `${LT_PLAY}/api/tournaments/${encodeURIComponent(id)}/standings`;

export const cardId = c => `${c.set}-${String(c.number).padStart(3, '0')}`;
const ordinal = n => `${n}${[, 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10] || 'th'}`;

// Standard events only (Extra format has rotated cards), big enough to mean something.
export function pickTournaments(list, { from = '', minPlayers = 16 } = {}) {
  return (list || []).filter(t => t?.id && t.players >= minPlayers && t.format !== 'EXTRA' && String(t.date).slice(0, 10) >= from);
}

export function parseStandings(standings, tour) {
  const date = String(tour.date || '').slice(0, 10) || null;
  const out = [];
  for (const p of standings || []) {
    const dl = p?.decklist;
    if (!dl?.leader) continue;
    const counts = new Map();
    for (const part of ['character', 'event', 'stage']) for (const c of dl[part] || []) counts.set(cardId(c), (counts.get(cardId(c)) || 0) + (+c.count || 0));
    const cards = [...counts].map(([id, count]) => ({ id, count })).filter(c => c.count > 0);
    if (cards.reduce((n, c) => n + c.count, 0) !== 50) continue;
    const placing = Number.isFinite(+p.placing) && p.placing ? +p.placing : null;
    out.push({
      source: 'Limitless Play',
      name: null,
      leaderId: cardId(dl.leader),
      cards,
      place: placing ? ordinal(placing) : null,
      placeMin: placing,
      player: p.name || p.player || null,
      event: tour.name || null,
      date,
      players: tour.players || null,
      url: `${LT_PLAY}/tournament/${tour.id}/player/${encodeURIComponent(p.player || '')}/decklist`,
      record: p.record ? { wins: +p.record.wins || 0, losses: +p.record.losses || 0, ties: +p.record.ties || 0 } : null,
      format: 'online',
    });
  }
  return out;
}

// Players who finished in the top cut: top 8, or top eighth of a big event.
export const madeTopCut = l => l.placeMin != null && l.placeMin <= Math.max(8, Math.ceil((l.players || 0) / 8));
