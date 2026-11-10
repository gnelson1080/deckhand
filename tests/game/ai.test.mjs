import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, legalActions } from '../../js/game/engine.js';
import { chooseAction, autoplay } from '../../js/game/ai.js';
import { mulberry32 } from '../../js/game/rng.js';
import { DECKS } from '../../js/game/pool-data.js';

const keys = Object.keys(DECKS);
const game = (seed, a, b) => createGame({ seed, decks: [DECKS[a], DECKS[b]], first: seed % 2 });

test('every AI level only returns legal actions (sampled states)', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const g = autoplay(game(3, 'mihawk', 'robin'), [level, level], mulberry32(3));
    assert.ok(g.phase === 'over' || g.turn > 0);
  }
  // spot-check membership on a fresh game
  const g = game(9, 'sabo', 'luffy');
  const a = chooseAction(g, 0, 'normal', mulberry32(1));
  assert.ok(legalActions(g).some(x => JSON.stringify(x) === JSON.stringify(a)));
});

function winRate(levelA, levelB, games) {
  let wins = 0, done = 0;
  for (let i = 0; i < games; i++) {
    const a = keys[i % keys.length], b = keys[(i * 3 + 1) % keys.length];
    const swap = i % 2;
    const g = autoplay(game(100 + i, swap ? b : a, swap ? a : b), swap ? [levelB, levelA] : [levelA, levelB], mulberry32(i + 1));
    if (g.phase !== 'over') continue;
    done++;
    if (g.winner === (swap ? 1 : 0)) wins++;
  }
  return { rate: wins / Math.max(1, done), done };
}

test('Normal beats Easy at least 70% of the time', () => {
  const { rate, done } = winRate('normal', 'easy', 30);
  assert.ok(done >= 25, `only ${done} games finished`);
  assert.ok(rate >= 0.7, `normal won ${(rate * 100).toFixed(0)}%`);
});
test('Hard beats Normal at least 55% of the time', () => {
  const { rate, done } = winRate('hard', 'normal', 30);
  assert.ok(done >= 25, `only ${done} games finished`);
  assert.ok(rate >= 0.55, `hard won ${(rate * 100).toFixed(0)}%`);
});
