import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../js/game/rng.js';
import { createGame, dispatch, actor } from '../../js/game/engine.js';
import { DECKS } from '../../js/game/pool-data.js';

const decks = [DECKS['luffy-ace'], DECKS.mihawk];
const ids = p => p.map(c => c.id);

test('rng is deterministic per seed', () => {
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
  const xa = [a(), a(), a()], xb = [b(), b(), b()];
  assert.deepEqual(xa, xb);
  assert.notDeepEqual(xa, [c(), c(), c()]);
});
test('same seed gives the same shuffled decks and hands', () => {
  const g1 = createGame({ seed: 7, decks, first: 0 }), g2 = createGame({ seed: 7, decks, first: 0 });
  assert.deepEqual(ids(g1.players[0].hand), ids(g2.players[0].hand));
  assert.deepEqual(ids(g1.players[1].deck), ids(g2.players[1].deck));
  const g3 = createGame({ seed: 8, decks, first: 0 });
  assert.notDeepEqual(ids(g1.players[0].deck), ids(g3.players[0].deck));
});
test('each player starts with 5 cards, 45 in deck, Leader out, 10 DON!! in DON deck', () => {
  const g = createGame({ seed: 1, decks, first: 0 });
  for (const p of g.players) {
    assert.equal(p.hand.length, 5);
    assert.equal(p.deck.length, 45);
    assert.equal(p.donDeck, 10);
    assert.ok(p.leader.id);
  }
  assert.equal(g.phase, 'mulligan');
});
test('mulligan: first player decides first, one redraw only, then Life is placed', () => {
  let g = createGame({ seed: 3, decks, first: 1 });
  assert.equal(actor(g), 1);
  const before = ids(g.players[1].hand);
  g = dispatch(g, { type: 'mulligan' });
  assert.equal(g.players[1].hand.length, 5);
  assert.notDeepEqual(ids(g.players[1].hand), before);
  assert.equal(actor(g), 0, 'second player decides next');
  g = dispatch(g, { type: 'keep' });
  // Life: Luffy & Ace = 4, Mihawk = 5; top card of deck ends up at the bottom of Life (CR 5-2-1-7)
  assert.equal(g.players[0].life.length, 4);
  assert.equal(g.players[1].life.length, 5);
  assert.equal(g.phase, 'main');
  assert.equal(g.active, 1);
});
test('Life order: the deck top card becomes the bottom Life card', () => {
  let g = createGame({ seed: 5, decks, first: 0 });
  const top4 = g.players[0].deck.slice(0, 4).map(c => c.uid);
  g = dispatch(g, { type: 'keep' });
  g = dispatch(g, { type: 'keep' });
  assert.deepEqual(g.players[0].life.map(c => c.uid), [...top4].reverse());
});
