import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash } from '../js/router.js';

test('parses card route with id param', () => {
  assert.deepEqual(parseHash('#/card/OP11-041'), { view: 'card', param: 'OP11-041' });
});
test('parses lesson and deck routes', () => {
  assert.deepEqual(parseHash('#/lesson/3'), { view: 'lesson', param: '3' });
  assert.deepEqual(parseHash('#/deck/2'), { view: 'deck', param: '2' });
});
test('empty or unknown hash falls back to learn', () => {
  assert.deepEqual(parseHash(''), { view: 'learn', param: null });
  assert.deepEqual(parseHash('#/nope'), { view: 'learn', param: null });
});
test('decodes encoded params', () => {
  assert.deepEqual(parseHash('#/glossary/On%20Play'), { view: 'glossary', param: 'On Play' });
});
