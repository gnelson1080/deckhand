import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeQuiz } from '../js/lib/quiz.js';

const qs = [{ answer: 1 }, { answer: 0 }, { answer: 3 }];
test('2 of 3 correct passes', () => assert.deepEqual(gradeQuiz(qs, [1, 0, 2]), { score: 2, total: 3, passed: true }));
test('1 of 3 correct does not pass', () => assert.deepEqual(gradeQuiz(qs, [0, 0, 2]), { score: 1, total: 3, passed: false }));
test('missing picks count as wrong', () => assert.equal(gradeQuiz(qs, [1]).score, 1));
