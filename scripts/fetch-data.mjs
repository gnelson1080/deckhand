#!/usr/bin/env node
// Snapshots card data (optcgapi.com, Limitless fallback) and meta data (Limitless) into data/*.json.
// Any source that fails keeps the previous file; the script always exits 0.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeCards } from './lib/normalize-cards.mjs';
import { fixMinusSigns } from './lib/text.mjs';
import { updatePriceHistory } from './lib/prices.mjs';
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
  maxDecks = 10, listsPerDeck = 3, windowDays = 60, maxTcgDecks = 250, useCatalog = true, prev = { cards: [], meta: null }, prevUpdated = {}, log = console.log,
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
      const add = extra.filter(c => !have.has(c.id)).map(c => ({ ...c, source: 'optcgapi' }));
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

  // 1) TCGplayer tournament decklists (most current).
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
    const recent = dated.filter(d => d.date >= cutoff).slice(0, maxTcgDecks);
    const details = [];
    for (const d of recent) {
      try {
        const det = parseDeckDetail(await tcg(deckDetailUrl(d.deckId)));
        for (const c of det.cardInfo) if (!tcgCards.has(c.id)) tcgCards.set(c.id, c);
        details.push(det);
      } catch (e) { log(`WARN tcg deck ${d.deckId} (${e.message})`); }
    }
    if (!details.length) throw new Error('no deck details');
    const colorsOf = id => tcgCards.get(id)?.colors || cards.find(c => c.id === id)?.colors || [];
    meta = { ...aggregateMeta(details, { maxDecks, listsPerDeck, colorsOf }), fetchedAt: new Date().toISOString() };
    log(`meta: ${meta.decks.length} decks from ${details.length} TCGplayer lists (${meta.from}..${meta.to})`);
  } catch (e) {
    log(`WARN TCGplayer meta failed (${e.message}); trying Limitless`);
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

const readJSON = (p, fallback) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; } };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = new URL('../data/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  const prev = { cards: readJSON(new URL('cards.json', dir), []), meta: readJSON(new URL('meta.json', dir), null) };
  const prevUpdated = readJSON(new URL('updated.json', dir), {});
  const { cards, meta, updated } = await buildData({ prev, prevUpdated });
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
