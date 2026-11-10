import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch } from '../../js/game/engine.js';
import { saveGame, loadGame } from '../../js/game/save.js';
import { POOL, DECKS } from '../../js/game/pool-data.js';
import { board } from './helpers.mjs';

test('save and load round-trip a game in progress', () => {
  let g = createGame({ seed: 4, decks: [DECKS.mihawk, DECKS.sabo], first: 0 });
  g = dispatch(g, { type: 'keep' }); g = dispatch(g, { type: 'keep' });
  const str = saveGame(g, { level: 'normal', you: 0 });
  const r = loadGame(str, POOL);
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.players[0].hand.map(c => c.id), g.players[0].hand.map(c => c.id));
  assert.equal(r.meta.level, 'normal');
});
test('saving in the middle of an effect returns null (saved at the next stable moment)', () => {
  let s = board({ p0: { hand: ['OP12-015', 'OP04-016', 'OP12-018'], donActive: 6 } });
  s = dispatch(s, { type: 'play', uid: s.players[0].hand[0].uid });
  assert.ok(s.stack.length);
  assert.equal(saveGame(s, {}), null);
});
test("a save with cards outside today's practice pool can't continue (clear message)", () => {
  const g = createGame({ seed: 4, decks: [DECKS.mihawk, DECKS.sabo], first: 0 });
  const bad = saveGame(g, {}).replace(/"OP12-023"/g, '"ZZ99-999"');
  const r = loadGame(bad, POOL);
  assert.equal(r.ok, false);
  assert.match(r.error, /can't continue/);
});
test('garbage and old versions are rejected without throwing', () => {
  assert.equal(loadGame('{nope', POOL).ok, false);
  assert.equal(loadGame(JSON.stringify({ v: 0 }), POOL).ok, false);
  assert.equal(loadGame(null, POOL).ok, false);
});
