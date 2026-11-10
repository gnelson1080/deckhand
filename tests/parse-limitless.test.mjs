import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMetaTable, parseArchetypeLists, parseDecklist, parseCardPage } from '../scripts/lib/parse-limitless.mjs';

const fx = n => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

test('parseMetaTable reads ranked decks', () => {
  const rows = parseMetaTable(fx('limitless-decks.html'));
  assert.ok(rows.length >= 5);
  assert.deepEqual(
    { rank: rows[0].rank, name: rows[0].name, leaderId: rows[0].leaderId, colors: rows[0].colors, share: rows[0].share, deckPath: rows[0].deckPath },
    { rank: 1, name: 'Nami', leaderId: 'OP11-041', colors: ['Blue', 'Yellow'], share: 23.52, deckPath: '/decks/74' });
  assert.equal(rows[0].points, 1386);
});

test('parseArchetypeLists reads placements with event names', () => {
  const lists = parseArchetypeLists(fx('limitless-archetype.html'));
  assert.equal(lists[0].format, 'OP16');
  assert.equal(lists[0].place, '1st');
  assert.equal(lists[0].player, 'LA/Smile');
  assert.equal(lists[0].listPath, '/decks/list/6738');
  assert.match(lists[0].event, /Treasure Cup Puebla/);
  assert.match(lists[0].date, /July 2026/);
});

test('parseDecklist returns leader + 50 cards', () => {
  const d = parseDecklist(fx('limitless-list.html'));
  assert.equal(d.leaderId, 'OP11-041');
  assert.equal(d.cards.reduce((s, c) => s + c.count, 0), 50);
  assert.ok(d.cards.every(c => /^[A-Z]+\d*-\d+$/.test(c.id)));
});

test('parseCardPage reads name, life, text, legality', () => {
  const c = parseCardPage(fx('limitless-card.html'));
  assert.equal(c.name, 'Nami');
  assert.equal(c.id, 'OP11-041');
  assert.equal(c.type, 'Leader');
  assert.equal(c.life, 4);
  assert.equal(c.power, 5000);
  assert.deepEqual(c.colors, ['Blue', 'Yellow']);
  assert.match(c.text, /^\[Your Turn\]/);
  assert.ok(c.text.includes('\n'));
  assert.equal(c.legality, 'Block 3');
  assert.match(c.img, /OP11-041_EN\.webp$/);
});
