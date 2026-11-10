import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickTournaments, parseStandings, cardId } from '../scripts/lib/limitless-play.mjs';

const fx = n => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));

test('cardId joins set and number, including promos', () => {
  assert.equal(cardId({ set: 'OP17', number: '039' }), 'OP17-039');
  assert.equal(cardId({ set: 'P', number: '088' }), 'P-088');
  assert.equal(cardId({ set: 'ST10', number: '10' }), 'ST10-010');
});
test('pickTournaments keeps big enough Standard events in the window', () => {
  const t = pickTournaments(fx('ltplay-tournaments.json'), { from: '2026-11-01', minPlayers: 16 });
  assert.ok(t.length >= 1);
  for (const x of t) { assert.ok(x.players >= 16); assert.notEqual(x.format, 'EXTRA'); assert.ok(x.date >= '2026-11-01'); }
});
test('parseStandings turns players into decklists with records and places', () => {
  const tour = { id: '6aec5b87e94eae0f94747bc0', name: '[EB05] ChinoizeCup #133 MONDAY', date: '2026-11-09T19:00:00.000Z', players: 60 };
  const lists = parseStandings(fx('ltplay-standings.json'), tour);
  assert.equal(lists.length, 10, 'players without a decklist are skipped');
  const first = lists[0];
  assert.equal(first.leaderId, 'OP17-039');
  assert.equal(first.placeMin, 1);
  assert.equal(first.place, '1st');
  assert.equal(first.date, '2026-11-09');
  assert.equal(first.players, 60);
  assert.equal(first.cards.reduce((n, c) => n + c.count, 0), 50);
  assert.deepEqual(first.record, { wins: 6, losses: 0, ties: 0 });
  assert.match(first.url, /^https:\/\/play\.limitlesstcg\.com\/tournament\/6aec5b87e94eae0f94747bc0/);
  assert.equal(first.source, 'Limitless Play');
});
