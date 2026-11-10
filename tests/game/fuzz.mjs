// Fuzz run (Review Focus 1): many seeded AI-vs-AI games across all deck pairs.
// Every game must end, never throw, and never reach a live state with no legal action.
// Run: node tests/game/fuzz.mjs [games=500]
import { createGame, legalActions } from '../../js/game/engine.js';
import { autoplay } from '../../js/game/ai.js';
import { mulberry32 } from '../../js/game/rng.js';
import { DECKS } from '../../js/game/pool-data.js';

const N = Number(process.argv[2]) || 500;
const keys = Object.keys(DECKS);
let over = 0, maxTurn = 0, errors = 0;
const levels = [['easy', 'easy'], ['normal', 'normal'], ['normal', 'easy']];
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const a = keys[i % 5], b = keys[Math.floor(i / 5) % 5];
  const lv = levels[i % levels.length];
  try {
    const g = autoplay(createGame({ seed: 1000 + i, decks: [DECKS[a], DECKS[b]], first: i % 2 }), lv, mulberry32(i), 6000);
    if (g.phase === 'over') over++;
    else if (!legalActions(g).length) throw new Error('stuck: no legal actions');
    maxTurn = Math.max(maxTurn, g.turn);
    if (g.turn > 60) throw new Error(`game ${i} lasted ${g.turn} turns`);
  } catch (e) {
    errors++;
    console.log(`game ${i} (${a} vs ${b}, ${lv}):`, e.message.split('\n')[0]);
    if (errors > 10) break;
  }
}
console.log(`${N} games, ${over} finished, ${errors} errors, longest ${maxTurn} turns, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(errors || over < N ? 1 : 0);
