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
