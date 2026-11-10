#!/usr/bin/env node
// Snapshots card data (optcgapi.com, Limitless fallback) and meta data (Limitless) into data/*.json.
// Any source that fails keeps the previous file; the script always exits 0.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeCards } from './lib/normalize-cards.mjs';
import { fixMinusSigns } from './lib/text.mjs';
import { updatePriceHistory } from './lib/prices.mjs';
import { banStatus } from '../js/lib/deck.js';
import { tournamentsUrl, standingsUrl, pickTournaments, parseStandings, madeTopCut } from './lib/limitless-play.mjs';
import { TCGCSV, tcgcsvToCards, mergeCardLists, isCardGroup, fillGaps } from './lib/tcgcsv.mjs';
import { parseDeckIndex, parseDeckDetail, aggregateMeta, deckIndexUrl, deckDetailUrl } from './lib/tcgplayer.mjs';
import { parseMetaTable, parseArchetypeLists, parseDecklist, parseCardPage } from './lib/parse-limitless.mjs';

const OPTCG = 'https://optcgapi.com/api';
const LIMITLESS = 'https://onepiece.limitlesstcg.com';
const UA = 'Deckhand-data-bot (GitHub Pages fan project)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);

const defaultText = async url => {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};
const defaultJSON = async url => {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

export async function buildData({
  fetchText = defaultText, fetchJSON = defaultJSON, delayMs = 300,
  maxDecks = 10, listsPerDeck = 3, windowDays = 60, onlineDays = 30, maxTcgDecks = 250, useCatalog = true, prev = { cards: [], meta: null }, prevUpdated = {}, log = console.log, rules = null,
} = {}) {
  const updated = { cards: prevUpdated.cards || null, meta: prevUpdated.meta || null };
  let cards = null;
  // 1) TCGplayer catalog (via tcgcsv.com): clean images, prices, product links, newest sets.
  if (useCatalog) try {
    const groups = (await fetchJSON(`${TCGCSV}/groups`)).results.filter(isCardGroup);
    const lists = [];
    for (const g of groups) {
      if (delayMs) await sleep(delayMs);
      const [products, prices] = await Promise.all([fetchJSON(`${TCGCSV}/${g.groupId}/products`), fetchJSON(`${TCGCSV}/${g.groupId}/prices`)]);
      lists.push(tcgcsvToCards(products.results, prices.results, { groupName: g.name, abbreviation: g.abbreviation }));
    }
    cards = mergeCardLists(lists);
    if (!cards.length) throw new Error('catalog returned no cards');
    log(`cards: ${cards.length} from TCGplayer catalog (${groups.length} groups)`);
  } catch (e) {
    cards = null;
    log(`WARN TCGplayer catalog failed (${e.message})`);
  }
  // 2) optcgapi.com: fills card numbers the catalog lacks, or replaces it if the catalog failed.
  try {
    const [set, st] = await Promise.all([fetchJSON(`${OPTCG}/allSetCards/`), fetchJSON(`${OPTCG}/allSTCards/`)]);
    const extra = normalizeCards([...set, ...st]);
    if (!cards) { cards = extra; log(`cards: ${cards.length} from optcgapi`); }
    else {
      const have = new Set(cards.map(c => c.id));
      cards = fillGaps(cards, extra);
      const add = extra.filter(c => !have.has(c.id) && !/_/.test(c.id)).map(c => ({ ...c, source: 'optcgapi' }));
      cards.push(...add);
      log(`cards: +${add.length} only on optcgapi`);
    }
  } catch (e) {
    log(`WARN optcgapi failed (${e.message})`);
  }
  if (cards) updated.cards = today();
  else { cards = prev.cards || []; log('WARN keeping previous cards'); }

  const limitless = async path => { if (delayMs) await sleep(delayMs); return fetchText(LIMITLESS + path); };
  const tcg = async url => { if (delayMs) await sleep(delayMs); return fetchJSON(url); };
  const tcgCards = new Map();
  let meta = null;

  // Meta from two live sources: TCGplayer (paper top cuts) and Limitless Play (online events with records).
  // A new ban changes the format, so only lists from after the newest ban count.
  const banDate = (rules?.banned || []).map(b => b.since).filter(Boolean).sort().at(-1) || '';
  const details = [];
  const online = [];
  const sources = [];
  // 1) TCGplayer tournament decklists.
  try {
    const index = [];
    for (let offset = 0; index.length < maxTcgDecks; offset += 100) {
      const page = parseDeckIndex(await tcg(deckIndexUrl(100, offset)));
      if (!page.length) break;
      index.push(...page);
    }
    const dated = index.filter(d => d.date && d.event).sort((a, b) => b.date.localeCompare(a.date));
    if (!dated.length) throw new Error('no dated decks');
    const cutoff = new Date(Date.parse(dated[0].date) - windowDays * 864e5).toISOString().slice(0, 10);
    const from = banDate > cutoff ? banDate : cutoff;
    const recent = dated.filter(d => d.date >= from).slice(0, maxTcgDecks);
    let n = 0;
    for (const d of recent) {
      try {
        const det = parseDeckDetail(await tcg(deckDetailUrl(d.deckId)));
        for (const c of det.cardInfo) if (!tcgCards.has(c.id)) tcgCards.set(c.id, c);
        details.push({ ...det, source: 'TCGplayer' });
        n++;
      } catch (e) { log(`WARN tcg deck ${d.deckId} (${e.message})`); }
    }
    if (n) sources.push('TCGplayer');
    log(`meta: ${n} TCGplayer lists since ${from}`);
  } catch (e) {
    log(`WARN TCGplayer meta failed (${e.message})`);
  }
  // 2) Limitless Play online events: every decklist counts toward win rates; top cuts count toward the ranking.
  try {
    const cutoff = new Date(Date.now() - onlineDays * 864e5).toISOString().slice(0, 10);
    const from = banDate > cutoff ? banDate : cutoff;
    const tours = [];
    for (let page = 1; page <= 5; page++) {
      const list = await tcg(tournamentsUrl(100, page));
      if (!Array.isArray(list) || !list.length) break;
      tours.push(...pickTournaments(list, { from, minPlayers: 16 }));
      if (String(list.at(-1).date).slice(0, 10) < from) break;
    }
    for (const t of tours) {
      try { online.push(...parseStandings(await tcg(standingsUrl(t.id)), t)); }
      catch (e) { log(`WARN online event ${t.id} (${e.message})`); }
    }
    const tops = online.filter(madeTopCut);
    details.push(...tops);
    if (tops.length) sources.push('Limitless Play');
    log(`meta: ${online.length} online lists from ${tours.length} events since ${from} (${tops.length} top cuts)`);
  } catch (e) {
    log(`WARN Limitless Play failed (${e.message})`);
  }
  try {
    const legal = details.filter(d => isLegalList(d.leaderId, d.cards.map(c => c.id), rules));
    if (legal.length < details.length) log(`meta: skipped ${details.length - legal.length} lists with banned cards`);
    if (!legal.length) throw new Error('no deck details');
    const colorsOf = id => tcgCards.get(id)?.colors || cards.find(c => c.id === id)?.colors || [];
    const agg = aggregateMeta(legal, { maxDecks, listsPerDeck, colorsOf });
    // Online win/loss records for each Leader (every player, not just top cuts).
    const rec = new Map();
    for (const l of online) {
      if (!l.record || !isLegalList(l.leaderId, l.cards.map(c => c.id), rules)) continue;
      const r = rec.get(l.leaderId) || { wins: 0, losses: 0, ties: 0, players: 0 };
      r.wins += l.record.wins; r.losses += l.record.losses; r.ties += l.record.ties; r.players++;
      rec.set(l.leaderId, r);
    }
    const ORDER = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'];
    const shortName = id => {
      const n = String(cards.find(c => c.id === id)?.name || id);
      if (n.includes('&')) return n;
      const parts = n.split(/[.\s]+/).filter(Boolean);
      return /^(Monkey|Portgas|Marshall|Trafalgar|Nico|Dracule|Donquixote|Charlotte|Boa|Roronoa|Jewelry|Eustass)$/.test(parts[0]) ? parts.at(-1) : parts[0];
    };
    const colorName = id => [...colorsOf(id)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join('/');
    agg.decks = agg.decks.map(d => ({ ...d, name: d.name || `${colorName(d.leaderId)} ${shortName(d.leaderId)}`.trim(), online: rec.get(d.leaderId) || null }));
    agg.source = sources.join(' + ') || agg.source;
    const rotatedSets = rules?.rotation?.rotatedSets || [];
    const stillPlayed = [...new Set([...online, ...legal].flatMap(l => l.cards.map(c => c.id)).filter(id => rotatedSets.includes(id.split('-')[0])))].sort();
    meta = { ...agg, stillPlayed, onlineEvents: new Set(online.map(l => l.event)).size, onlinePlayers: online.length, sinceBan: banDate || null, fetchedAt: new Date().toISOString() };
    log(`meta: ${meta.decks.length} decks from ${legal.length} lists (${meta.from}..${meta.to})`);
  } catch (e) {
    log(`WARN live meta failed (${e.message}); trying Limitless`);
  }

  // 2) Limitless fallback.
  if (!meta) try {
    const rows = parseMetaTable(await limitless('/decks')).slice(0, maxDecks);
    const decks = [];
    let format = null;
    for (const row of rows) {
      const lists = [];
      for (const l of parseArchetypeLists(await limitless(row.deckPath)).slice(0, listsPerDeck)) {
        format ||= l.format;
        const d = parseDecklist(await limitless(l.listPath));
        lists.push({ place: l.place, player: l.player, event: l.event, date: l.date, url: LIMITLESS + l.listPath, cards: d.cards });
      }
      decks.push({ rank: row.rank, name: row.name, leaderId: row.leaderId, colors: row.colors, points: row.points, share: row.share, url: LIMITLESS + row.deckPath, lists });
    }
    meta = { source: 'Limitless', format, fetchedAt: new Date().toISOString(), decks };
    log(`meta: ${decks.length} decks from Limitless (${format})`);
  } catch (e) {
    log(`WARN Limitless meta failed (${e.message})`);
  }
  if (meta && rules) {
    meta.decks = meta.decks.filter(d => !banStatus(d.leaderId, rules).banned)
      .map(d => ({ ...d, lists: d.lists.filter(l => isLegalList(d.leaderId, l.cards.map(c => c.id), rules)) }))
      .filter(d => d.lists.length).map((d, i) => ({ ...d, rank: i + 1 }));
    meta.banListChecked = rules.checked || null;
  }
  if (meta) updated.meta = today();
  else { meta = prev.meta; log('WARN keeping previous meta'); }

  // Add TCGplayer product links to cards we already have.
  for (const c of cards) {
    const t = tcgCards.get(c.id);
    if (t && !c.tcgUrl) c.tcgUrl = t.tcgUrl;
  }

  // Fill any card used in meta that the card API doesn't have yet (e.g. a brand-new set).
  const have = new Set(cards.map(c => c.id));
  const needed = new Set();
  for (const d of meta?.decks || []) {
    if (d.leaderId) needed.add(d.leaderId);
    for (const l of d.lists) for (const c of l.cards) needed.add(c.id);
  }
  for (const id of needed) {
    if (have.has(id)) continue;
    if (tcgCards.has(id)) { cards.push({ ...tcgCards.get(id), source: 'tcgplayer' }); have.add(id); log(`filled ${id} from TCGplayer`); continue; }
    try {
      const c = parseCardPage(await limitless(`/cards/${id}`));
      cards.push({ set: id.split('-')[0], setName: null, rarity: null, price: null, ...c, id, source: 'limitless' });
      have.add(id);
      log(`filled ${id} from Limitless`);
    } catch (e) {
      log(`WARN could not fill ${id} (${e.message})`);
    }
  }
  cards = cards.map(c => ({ ...c, text: fixMinusSigns(String(c.text || '').replace(/\s*Disclaimer:[^\n]*/g, '').trim()) }));
  cards.sort((a, b) => a.id.localeCompare(b.id));
  return { cards, meta, updated };
}

export function isLegalList(leaderId, ids, rules) {
  const all = [leaderId, ...ids].filter(Boolean);
  if (all.some(id => banStatus(id, rules).banned)) return false;
  return !(rules?.pairs || []).some(p => p.ids.every(id => all.includes(id)));
}

const readJSON = (p, fallback) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; } };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = new URL('../data/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  const prev = { cards: readJSON(new URL('cards.json', dir), []), meta: readJSON(new URL('meta.json', dir), null) };
  const prevUpdated = readJSON(new URL('updated.json', dir), {});
  const rules = readJSON(new URL('../content/banlist.json', import.meta.url), null);
  const { cards, meta, updated } = await buildData({ prev, prevUpdated, rules });
  writeFileSync(new URL('cards.json', dir), JSON.stringify(cards));
  if (meta) writeFileSync(new URL('meta.json', dir), JSON.stringify(meta, null, 2));
  writeFileSync(new URL('updated.json', dir), JSON.stringify(updated, null, 2));
  // Price history: only when today's card data actually came in (never re-record stale prices).
  if (updated.cards === new Date().toISOString().slice(0, 10)) {
    const pdir = new URL('prices/', dir);
    mkdirSync(pdir, { recursive: true });
    const sets = updatePriceHistory(cards, updated.cards,
      k => JSON.parse(readFileSync(new URL(`${k}.json`, pdir), 'utf8')),
      (k, shard) => writeFileSync(new URL(`${k}.json`, pdir), JSON.stringify(shard)));
    console.log(`prices: ${sets.length} set files updated`);
  }
}
