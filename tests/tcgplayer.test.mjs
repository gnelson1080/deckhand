import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDeckIndex, parseDeckDetail, tcgCardToCard, aggregateMeta } from '../scripts/lib/tcgplayer.mjs';

const fx = n => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));

test('parseDeckIndex lists One Piece decks with ISO event dates', () => {
  const rows = parseDeckIndex(fx('tcg-decks.json'));
  assert.equal(rows.length, 6);
  assert.deepEqual(
    { deckId: rows[0].deckId, name: rows[0].name, event: rows[0].event, date: rows[0].date, place: rows[0].place },
    { deckId: '552644', name: 'Red/Green Luffy', event: 'Regional Pomona', date: '2026-11-08', place: '9th-16th' });
});

test('parseDeckDetail splits leader from the 50-card main deck', () => {
  const d = parseDeckDetail(fx('tcg-deck.json'));
  assert.equal(d.leaderId, 'OP13-001');
  assert.equal(d.cards.reduce((s, c) => s + c.count, 0), 50);
  assert.ok(!d.cards.some(c => c.id === 'OP13-001'));
  assert.equal(d.placeMin, 9);
  assert.equal(d.players, 1536);
  assert.equal(d.url, 'https://www.tcgplayer.com/content/one-piece/deck/Red-Green-Luffy/552644');
  assert.ok(d.cardInfo.length >= 17);
});

test('tcgCardToCard parses colors, numbers and strips html + reprint disclaimer', () => {
  const raw = Object.values(fx('tcg-deck.json').result.cards);
  const leader = tcgCardToCard(raw.find(c => c.number === 'OP13-001'));
  assert.deepEqual(leader.colors, ['Green', 'Red']);
  assert.equal(leader.life, 4);
  assert.equal(leader.power, 5000);
  assert.equal(leader.cost, null);
  assert.deepEqual(leader.traits, ['Straw Hat Crew', 'Supernovas']);
  assert.match(leader.tcgUrl, /^https:\/\/www\.tcgplayer\.com\/product\/657250/);
  const ev = tcgCardToCard(raw.find(c => c.number === 'OP01-055'));
  assert.equal(ev.text, '[Main] You may rest 2 of your Characters: Draw 2 cards.');
  assert.equal(ev.cost, 1);
  assert.equal(ev.power, null);
});

test('aggregateMeta groups decks by leader and ranks by count', () => {
  const base = parseDeckDetail(fx('tcg-deck.json'));
  const mk = (leaderId, placeMin, name) => ({ ...base, leaderId, placeMin, name });
  const meta = aggregateMeta([mk('A-1', 9, 'Alpha'), mk('A-1', 1, 'Alpha'), mk('B-1', 2, 'Beta')], { colorsOf: () => ['Red'] });
  assert.equal(meta.source, 'TCGplayer');
  assert.deepEqual(meta.decks.map(d => [d.rank, d.leaderId, d.points]), [[1, 'A-1', 2], [2, 'B-1', 1]]);
  assert.equal(meta.decks[0].share, 66.67);
  assert.equal(meta.decks[0].lists[0].place, base.place);
  assert.equal(meta.decks[0].lists.length, 2);
  assert.ok(meta.decks[0].lists[0].placeMin <= meta.decks[0].lists[1].placeMin);
});

test('deck detail coerces counts to numbers and drops unknown colors', () => {
  const j = fx('tcg-deck.json');
  const first = j.result.deck.subDecks.maindeck[1];
  first.quantity = '4"><b>';
  const leader = Object.values(j.result.cards).find(c => c.cardType === 'Leader');
  leader.colors = "['Green', 'Red\"><img>']";
  const d = parseDeckDetail(j);
  assert.ok(d.cards.every(c => Number.isInteger(c.count)));
  assert.deepEqual(d.cardInfo.find(c => c.id === leader.number).colors, ['Green']);
});
