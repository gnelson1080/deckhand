import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixMinusSigns } from '../scripts/lib/text.mjs';

test('restores DON!! minus costs', () => {
  assert.equal(fixMinusSigns('[On Play] DON!! 1: Draw 1 card.'), '[On Play] DON!! −1: Draw 1 card.');
  assert.equal(fixMinusSigns('[Main] DON!! 2 (You may return the specified number of DON!! cards'), '[Main] DON!! −2 (You may return the specified number of DON!! cards');
  assert.equal(fixMinusSigns('[Counter] DON!! 2, You may trash 1 card'), '[Counter] DON!! −2, You may trash 1 card');
});
test('leaves DON!! x1 and counts alone', () => {
  assert.equal(fixMinusSigns('[DON!! x1] This gains +1000.'), '[DON!! x1] This gains +1000.');
  assert.equal(fixMinusSigns('If you have 6 or less DON!! cards on your field'), 'If you have 6 or less DON!! cards on your field');
  assert.equal(fixMinusSigns('Add up to 1 DON!! card from your DON!! deck'), 'Add up to 1 DON!! card from your DON!! deck');
});
test('restores minus on "give ... N power" debuffs', () => {
  assert.equal(fixMinusSigns("give up to 1 of your opponent's Characters 1000 power during this turn."), "give up to 1 of your opponent's Characters −1000 power during this turn.");
  assert.equal(fixMinusSigns('If you have 4 or more Life cards, give this Leader 1000 power.'), 'If you have 4 or more Life cards, give this Leader −1000 power.');
});
test('does not touch signed or non-give numbers', () => {
  assert.equal(fixMinusSigns('give this Leader -2000 power.'), 'give this Leader -2000 power.');
  assert.equal(fixMinusSigns('Up to 1 of your Characters gains +2000 power'), 'Up to 1 of your Characters gains +2000 power');
  assert.equal(fixMinusSigns('K.O. up to 1 of your opponent\'s Characters with 3000 power or less.'), "K.O. up to 1 of your opponent's Characters with 3000 power or less.");
  assert.equal(fixMinusSigns('Give up to 2 rested DON!! cards to your Leader'), 'Give up to 2 rested DON!! cards to your Leader');
  assert.equal(fixMinusSigns('give up to 1 of your opponent\'s Characters with 5000 power or less −2000 power'), "give up to 1 of your opponent's Characters with 5000 power or less −2000 power");
});
test('restores minus on "give ... N cost"', () => {
  assert.equal(fixMinusSigns("Give up to 1 of your opponent's Characters 3 cost during this turn."), "Give up to 1 of your opponent's Characters −3 cost during this turn.");
});
test('is idempotent', () => {
  const once = fixMinusSigns("[On Play] DON!! 1: give up to 1 of your opponent's Characters 2000 power.");
  assert.equal(fixMinusSigns(once), once);
});
