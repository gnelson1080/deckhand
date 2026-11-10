// Deck rules (Comprehensive Rules 5-1-2), deck text import/export, and meta-based tips. Pure.
export const DECK_SIZE = 50;
export const MAX_COPIES = 4;
const PLAYABLE = ['Character', 'Event', 'Stage'];

export const deckTotal = deck => (deck?.entries || []).reduce((n, e) => n + e.count, 0);
const countOf = (deck, id) => deck.entries.find(e => e.id === id)?.count || 0;
const offColors = (card, leader) => (card.colors || []).filter(c => !(leader?.colors || []).includes(c));

export function parseDeckText(text, cards) {
  let leaderId = null;
  const counts = new Map();
  const bad = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\d{1,2})\s*x?\s*([A-Z0-9]+-[A-Z0-9]+)(?![A-Z0-9-])/i);
    if (!m) { bad.push({ line, reason: 'Not a deck line. Use the form 4xOP01-016.' }); continue; }
    const count = +m[1];
    const id = m[2].toUpperCase();
    const card = cards.get(id);
    if (!card) { bad.push({ line, reason: `Card ${id} not found.` }); continue; }
    if (card.type === 'Leader') { if (!leaderId) leaderId = id; else bad.push({ line, reason: 'A deck has only one Leader.' }); continue; }
    counts.set(id, (counts.get(id) || 0) + count);
  }
  return { leaderId, entries: [...counts].map(([id, count]) => ({ id, count })), bad };
}

export function formatDeckText(deck, cards) {
  const key = e => [cards?.get(e.id)?.cost ?? 99, e.id];
  const sorted = [...deck.entries].sort((a, b) => key(a)[0] - key(b)[0] || a.id.localeCompare(b.id));
  return [deck.leaderId ? `1x${deck.leaderId}` : null, ...sorted.map(e => `${e.count}x${e.id}`)].filter(Boolean).join('\n');
}

export function canAdd(deck, card, cards) {
  if (!card) return { ok: false, reason: 'That card is missing from the card list.' };
  if (!deck.leaderId) return { ok: false, reason: 'Pick a Leader first. It decides which colors you can use.' };
  if (!PLAYABLE.includes(card.type)) return { ok: false, reason: `${card.type === 'Leader' ? 'A Leader' : 'That card'} can't go in the 50-card deck.` };
  const leader = cards.get(deck.leaderId);
  const off = offColors(card, leader);
  if (off.length) return { ok: false, reason: `This card is ${off.join(' and ')}, and your Leader isn't. Every color on a card must be on your Leader.` };
  if (countOf(deck, card.id) >= MAX_COPIES) return { ok: false, reason: `You already have 4 copies. That's the most a deck can have.` };
  if (deckTotal(deck) >= DECK_SIZE) return { ok: false, reason: 'Your deck already has 50 cards. Remove one first.' };
  return { ok: true };
}

export function validateDeck(deck, cards) {
  const problems = [];
  const total = deckTotal(deck);
  const leader = deck.leaderId ? cards.get(deck.leaderId) : null;
  if (!leader) problems.push({ code: 'no-leader', msg: 'Pick a Leader.' });
  if (total !== DECK_SIZE) problems.push({ code: 'count', msg: total < DECK_SIZE ? `Add ${DECK_SIZE - total} more card${DECK_SIZE - total === 1 ? '' : 's'} (decks need exactly 50).` : `Remove ${total - DECK_SIZE} card${total - DECK_SIZE === 1 ? '' : 's'} (decks need exactly 50).` });
  for (const e of deck.entries) {
    const c = cards.get(e.id);
    if (!c) { problems.push({ code: 'unknown', id: e.id, msg: `Unknown card ${e.id}. It may have been removed from the card list.` }); continue; }
    if (e.count > MAX_COPIES) problems.push({ code: 'copies', id: e.id, msg: `${c.name}: ${e.count} copies. The limit is 4.` });
    if (!PLAYABLE.includes(c.type)) problems.push({ code: 'type', id: e.id, msg: `${c.name} is a ${c.type} and can't be in the deck.` });
    if (leader) { const off = offColors(c, leader); if (off.length) problems.push({ code: 'color', id: e.id, msg: `${c.name} is ${off.join(' and ')}, which isn't on your Leader.` }); }
  }
  return { ok: problems.length === 0, total, problems };
}

const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function metaHints(deck, meta, cards) {
  if (!meta?.decks?.length || !deck?.leaderId) return [];
  const same = meta.decks.filter(d => d.leaderId === deck.leaderId).flatMap(d => d.lists || []);
  const pool = same.length ? same : meta.decks.flatMap(d => d.lists || []);
  if (!pool.length) return [];
  const hints = [];
  const have = new Map(deck.entries.map(e => [e.id, e.count]));

  // Staples: in 2+ winning lists for this Leader but not in this deck.
  if (same.length >= 2) {
    const seen = new Map();
    for (const l of same) for (const c of l.cards) { const s = seen.get(c.id) || { lists: 0, copies: 0 }; s.lists++; s.copies += c.count; seen.set(c.id, s); }
    const staples = [...seen].filter(([id, s]) => s.lists >= 2 && !have.has(id)).sort((a, b) => b[1].lists - a[1].lists || b[1].copies - a[1].copies).slice(0, 2);
    for (const [id, s] of staples) hints.push(`${s.lists} of ${same.length} winning lists with this Leader play ${cards.get(id)?.name || id} (usually ${Math.round(s.copies / s.lists)} copies).`);
  }
  const counterCount = l => l.cards.reduce((n, c) => n + (cards.get(c.id)?.counter ? c.count : 0), 0);
  const avgCost = l => { let n = 0, sum = 0; for (const c of l.cards) { const k = cards.get(c.id)?.cost; if (k != null) { n += c.count; sum += k * c.count; } } return n ? sum / n : null; };
  const mine = { cards: deck.entries };
  const metaCounters = avg(pool.map(counterCount));
  if (metaCounters != null && deckTotal(deck) >= 30 && counterCount(mine) < metaCounters - 4) hints.push(`You have ${counterCount(mine)} cards with a Counter. Winning lists average about ${Math.round(metaCounters)}, so your hand may struggle to defend.`);
  const metaCost = avg(pool.map(avgCost).filter(x => x != null));
  const myCost = avgCost(mine);
  if (metaCost != null && myCost != null && deckTotal(deck) >= 30 && myCost > metaCost + 0.7) hints.push(`Your average cost is ${myCost.toFixed(1)}. Winning lists average ${metaCost.toFixed(1)}, so you may be slow in the first turns.`);
  return hints.slice(0, 4);
}
