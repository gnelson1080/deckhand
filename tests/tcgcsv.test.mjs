import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tcgcsvToCards, isCardGroup } from '../scripts/lib/tcgcsv.mjs';

const fx = n => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8')).results;
const cards = tcgcsvToCards(fx('tcgcsv-products.json'), fx('tcgcsv-prices.json'), { groupName: "The World's Strongest Warriors", abbreviation: 'OP17' });
const byId = new Map(cards.map(c => [c.id, c]));

test('one card per card number; alt arts become altImgs', () => {
  const s = byId.get('OP17-020');
  assert.equal(s.name, 'Shanks');
  assert.equal(s.altImgs.length, 1);
  assert.match(s.img, /tcgplayer-cdn\.tcgplayer\.com\/product\/\d+_in_1000x1000\.jpg$/);
  assert.match(s.tcgUrl, /^https:\/\/www\.tcgplayer\.com\/product\//);
});
test('sealed products and DON!! cards are skipped', () => {
  assert.equal(cards.length, 3);
});
test('leader stats parsed: life, power, null cost, colors', () => {
  const s = byId.get('OP17-020');
  assert.equal(s.type, 'Leader');
  assert.equal(s.life, 5);
  assert.equal(s.cost, null);
  assert.deepEqual(s.colors, ['Green']);
  assert.equal(s.set, 'OP17');
});
test('character text keeps reminder text but no html; traits split on semicolons', () => {
  const b = byId.get('OP17-028');
  assert.equal(b.text, "[Blocker] (After your opponent declares an attack, you may rest this card to make it the new target of the attack.)\n[On Play] K.O. up to 1 of your opponent's rested Characters with a cost of 6 or less.");
  assert.deepEqual(b.traits, ['Animal', 'Red-Haired Pirates']);
  assert.equal(b.counter, 1000);
  assert.equal(b.cost, 4);
  assert.equal(b.price, 0.08);
});
test('event has null power', () => {
  const e = byId.get('OP17-037');
  assert.equal(e.type, 'Event');
  assert.equal(e.power, null);
});
test('base price comes from the base printing, not the alt art', () => {
  assert.ok(byId.get('OP17-020').price < 100);
});
test('isCardGroup skips sealed/merch groups by name', () => {
  assert.equal(isCardGroup({ name: 'Learn Together Deck Set', abbreviation: 'LTD' }), true);
  assert.equal(isCardGroup({ name: 'One Piece Card Game Playmats', abbreviation: 'PM' }), false);
});

test('mergeCardLists keeps the home-set printing and pools reprint art', async () => {
  const { mergeCardLists } = await import('../scripts/lib/tcgcsv.mjs');
  const base = { id: 'OP01-055', set: 'OP01', name: 'X', img: 'home.jpg', altImgs: ['home-alt.jpg'], price: 1, _group: 'OP01' };
  const reprint = { ...base, img: 'reprint.jpg', altImgs: [], price: 0.5, setName: 'Premium', _group: 'PRB-02' };
  const [m] = mergeCardLists([[reprint], [base]]);
  assert.equal(m.img, 'home.jpg');
  assert.deepEqual(m.altImgs.sort(), ['home-alt.jpg', 'reprint.jpg']);
  assert.equal(m.price, 1);
  assert.ok(!('_group' in m));
});
test('mergeCardLists matches ST-01 group to ST01 card numbers', async () => {
  const { mergeCardLists } = await import('../scripts/lib/tcgcsv.mjs');
  const a = { id: 'ST01-012', set: 'ST01', img: 'promo.jpg', altImgs: [], price: 3, _group: 'OP-PR' };
  const b = { id: 'ST01-012', set: 'ST01', img: 'starter.jpg', altImgs: [], price: 2, _group: 'ST-01' };
  assert.equal(mergeCardLists([[a], [b]])[0].img, 'starter.jpg');
});

test('fillGaps copies missing colors/text/traits from a backup source', async () => {
  const { fillGaps } = await import('../scripts/lib/tcgcsv.mjs');
  const main = [{ id: 'A-1', colors: [], text: '', traits: [], name: 'A' }, { id: 'B-1', colors: ['Red'], text: 'x', traits: ['T'] }];
  const backup = [{ id: 'A-1', colors: ['Blue'], text: '[On Play] Draw 1 card.', traits: ['Navy'] }, { id: 'B-1', colors: ['Green'], text: 'y', traits: [] }];
  const out = fillGaps(main, backup);
  assert.deepEqual(out[0].colors, ['Blue']);
  assert.equal(out[0].text, '[On Play] Draw 1 card.');
  assert.deepEqual(out[0].traits, ['Navy']);
  assert.deepEqual(out[1].colors, ['Red']);
  assert.equal(out[1].text, 'x');
});
test('fillGaps ignores backup reprint disclaimers as text', async () => {
  const { fillGaps } = await import('../scripts/lib/tcgcsv.mjs');
  const out = fillGaps([{ id: 'A-1', colors: ['Red'], text: '', traits: [] }], [{ id: 'A-1', colors: ['Red'], text: 'Disclaimer: This card was reprinted', traits: [] }]);
  assert.equal(out[0].text, '');
});

test('mergeCardLists prefers the exact home group over a pre-release variant group', async () => {
  const { mergeCardLists } = await import('../scripts/lib/tcgcsv.mjs');
  const pre = { id: 'ST01-012', set: 'ST01', img: 'pre.jpg', altImgs: [], price: 9, _group: 'ST-01 PRE' };
  const home = { id: 'ST01-012', set: 'ST01', img: 'home.jpg', altImgs: [], price: 2, _group: 'ST-01' };
  assert.equal(mergeCardLists([[pre], [home]])[0].img, 'home.jpg');
  assert.equal(mergeCardLists([[home], [pre]])[0].img, 'home.jpg');
});

test('cleanName strips a trailing " - OP14-020" number suffix', async () => {
  const { cleanName } = await import('../scripts/lib/tcgcsv.mjs');
  assert.equal(cleanName('Dracule Mihawk - OP14-020'), 'Dracule Mihawk');
  assert.equal(cleanName('Shanks (020) (Alternate Art)'), 'Shanks');
  assert.equal(cleanName('Eustass"Captain"Kid'), 'Eustass"Captain"Kid');
});

test('fillGaps backfills missing life, power, cost and counter from the backup', async () => {
  const { fillGaps } = await import('../scripts/lib/tcgcsv.mjs');
  const main = [{ id: 'L-1', type: 'Leader', colors: ['Red'], traits: ['T'], text: 'x', life: null, power: 5000, cost: null, counter: null },
                { id: 'C-1', type: 'Character', colors: ['Red'], traits: ['T'], text: 'x', life: null, power: null, cost: null, counter: null }];
  const backup = [{ id: 'L-1', life: 5, power: 5000 }, { id: 'C-1', power: 3000, cost: 2, counter: 1000 }];
  const [l, c] = fillGaps(main, backup);
  assert.equal(l.life, 5);
  assert.equal(l.cost, null, 'leaders never get a cost');
  assert.deepEqual([c.power, c.cost, c.counter], [3000, 2, 1000]);
});
test('a Character with no power anywhere is shown as 0 power', async () => {
  const { fillGaps } = await import('../scripts/lib/tcgcsv.mjs');
  const [c] = fillGaps([{ id: 'C-1', type: 'Character', colors: ['Red'], traits: [], text: '', power: null, cost: 1 }], []);
  assert.equal(c.power, 0);
});
test('a "Character" with no power whose backup says Event becomes an Event', async () => {
  const { fillGaps } = await import('../scripts/lib/tcgcsv.mjs');
  const [c] = fillGaps([{ id: 'E-1', type: 'Character', colors: ['Red'], traits: [], text: '[Counter] +2000', power: null, cost: 1 }], [{ id: 'E-1', type: 'Event' }]);
  assert.equal(c.type, 'Event');
  assert.equal(c.power, null);
});
test('reprint/errata disclaimer sentences are removed from card text', async () => {
  const { stripTcgHtml } = await import('../scripts/lib/tcgcsv.mjs');
  assert.equal(stripTcgHtml('[On Play] Draw 1 card.<br>Disclaimer: This card has been re-printed with new errata. Details here.'), '[On Play] Draw 1 card.');
  assert.equal(stripTcgHtml('[Main] Draw 2. Disclaimer: This card was reprinted from the original set.'), '[Main] Draw 2.');
});
