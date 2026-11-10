// Parsers for TCGplayer's public deck feed (infinite-api.tcgplayer.com), One Piece vertical.
import { splitTraits } from './normalize-cards.mjs';

export const TCG_API = 'https://infinite-api.tcgplayer.com';
export const deckIndexUrl = (rows, offset) => `${TCG_API}/content/decks/one%20piece/?rows=${rows}&offset=${offset}`;
export const deckDetailUrl = id => `${TCG_API}/deck/one%20piece/${id}/?subDecks=true&cards=true`;

const isoDate = s => {
  const m = String(s || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};
const num = v => (v === null || v === undefined || v === '' ? null : (Number.isNaN(Number(v)) ? null : Number(v)));
const pyList = s => Array.isArray(s) ? s : [...String(s || '').matchAll(/'([^']*)'|"([^"]*)"/g)].map(m => m[1] ?? m[2]);

export const stripHtml = s => String(s || '')
  .replace(/<span[^>]*color:\s*red[^>]*>[\s\S]*?<\/span>/gi, '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .split('\n').map(l => l.trim()).filter(Boolean).join('\n');

export function parseDeckIndex(json) {
  return (json.result || [])
    .filter(r => r.vertical === 'one piece' && r.contentType === 'Deck')
    .map(r => ({
      deckId: String(r.deckID),
      name: r.deckData?.deckName?.trim() || r.title,
      event: r.deckData?.eventName || null,
      date: isoDate(r.deckData?.eventDate),
      place: r.deckData?.eventRank || null,
      player: r.deckData?.playerName || null,
      format: r.deckData?.format || null,
      price: num(r.deckData?.marketPrice),
    }));
}

export function tcgCardToCard(c) {
  const type = c.cardType || null;
  const counter = num(c.counter);
  return {
    id: c.number,
    name: c.displayName || String(c.name || '').replace(/\s*\([^)]*\)\s*$/, ''),
    set: c.set || null,
    setName: c.setName || null,
    rarity: c.rarity || null,
    colors: pyList(c.colors),
    type,
    cost: type === 'Leader' ? null : num(c.cost),
    power: type === 'Event' ? null : num(c.power),
    counter: counter ? counter : null,
    life: type === 'Leader' ? num(c.life) : null,
    attribute: c.attribute || null,
    traits: pyList(c.subtypes).length ? pyList(c.subtypes) : splitTraits(c.subtypes),
    text: stripHtml(c.description),
    img: c.tcgImageURL || null,
    altImgs: [],
    price: num(c.marketPrice),
    tcgUrl: c.tcgProductURL || null,
  };
}

export function parseDeckDetail(json) {
  const r = json.result;
  const deck = r.deck;
  const info = r.cards || {};
  let leaderId = null;
  const counts = new Map();
  for (const e of deck.subDecks?.maindeck || []) {
    const c = info[String(e.cardID)];
    if (!c?.number) continue;
    if (c.cardType === 'Leader') { leaderId = c.number; continue; }
    counts.set(c.number, (counts.get(c.number) || 0) + e.quantity);
  }
  return {
    name: deck.name?.trim(),
    leaderId,
    cards: [...counts].map(([id, count]) => ({ id, count })),
    event: deck.eventName || null,
    date: isoDate(deck.eventDate),
    place: deck.eventRank || null,
    placeMin: num(deck.eventPlacementMin),
    players: num(deck.eventPlayers),
    player: deck.playerName || null,
    format: deck.format || null,
    url: `https://www.tcgplayer.com/content${r.canonicalURL}`,
    cardInfo: Object.values(info).filter(c => c.number).map(tcgCardToCard),
  };
}

export function aggregateMeta(details, { maxDecks = 10, listsPerDeck = 3, colorsOf = () => [] } = {}) {
  const groups = new Map();
  for (const d of details) {
    if (!d.leaderId) continue;
    if (!groups.has(d.leaderId)) groups.set(d.leaderId, []);
    groups.get(d.leaderId).push(d);
  }
  const total = details.filter(d => d.leaderId).length || 1;
  const best = g => Math.min(...g.map(d => d.placeMin ?? 999));
  const mostCommon = arr => [...arr.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0][0];
  const decks = [...groups].sort((a, b) => b[1].length - a[1].length || best(a[1]) - best(b[1])).slice(0, maxDecks)
    .map(([leaderId, g], i) => ({
      rank: i + 1,
      name: mostCommon(g.map(d => d.name)),
      leaderId,
      colors: colorsOf(leaderId),
      points: g.length,
      share: Math.round((g.length / total) * 10000) / 100,
      url: [...g].sort((a, b) => (a.placeMin ?? 999) - (b.placeMin ?? 999))[0].url,
      lists: [...g].sort((a, b) => (a.placeMin ?? 999) - (b.placeMin ?? 999) || String(b.date).localeCompare(String(a.date)))
        .slice(0, listsPerDeck)
        .map(d => ({ place: d.place, placeMin: d.placeMin, player: d.player, event: d.event, date: d.date, players: d.players, url: d.url, cards: d.cards })),
    }));
  const dates = details.map(d => d.date).filter(Boolean).sort();
  return { source: 'TCGplayer', format: details.find(d => d.format)?.format || null, sampleSize: total, from: dates[0] || null, to: dates.at(-1) || null, decks };
}
