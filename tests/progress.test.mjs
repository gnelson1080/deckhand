import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeLesson, currentLesson, emptyProgress } from '../js/lib/progress.js';

test('completing a lesson records it once and keeps the best score', () => {
  let p = completeLesson(emptyProgress(), 2, 3);
  p = completeLesson(p, 2, 2);
  p = completeLesson(p, 1, 2);
  assert.deepEqual(p, { completed: [1, 2], quiz: { 1: 2, 2: 3 } });
});
test('current lesson is the first one not completed', () => {
  assert.equal(currentLesson(emptyProgress(), 11), 1);
  assert.equal(currentLesson({ completed: [1, 2, 4] }, 11), 3);
  assert.equal(currentLesson({ completed: [1, 2, 3] }, 3), 3);
});
test('completeLesson tolerates missing or corrupt progress', () => {
  assert.deepEqual(completeLesson(null, 1, 3), { completed: [1], quiz: { 1: 3 } });
});
