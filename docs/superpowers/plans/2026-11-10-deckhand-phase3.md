# Deckhand Phase 3 (Practice Game vs. Computer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full, rules-accurate One Piece Card Game match on your phone against a computer opponent, with a coach that explains phases, judges moves and suggests a move when you're stuck.

**Architecture:** A pure, deterministic game engine (`js/game/`) runs entirely in the browser: state + rules reducer, an effect interpreter driven by hand-written per-card effect definitions, and AI players that only ever choose from the engine's own list of legal actions. The UI (`js/views/play.js`, `js/ui/game/*`) renders state and sends actions. Everything is Node-testable; a seeded RNG makes games reproducible.

**Tech Stack:** as Phases 1–2. No dependencies.

**Spec:** `docs/superpowers/specs/2026-11-10-deckhand-design.md` section 6, Phase 3. Rules source: Comprehensive Rules v1.2.1 (`content/SOURCES.md`).

## Global Constraints

- Rules follow the Comprehensive Rules: setup 5-2 (5-card hand, one mulligan, Life from deck top), turn 6-1..6-6 (first player: no draw, 1 DON!!, nobody battles turn 1), DON!! giving 6-5-5 (+1000 on owner's turn, returns rested at Refresh), attack targets 7-1 (Leader or rested Character), Block step then Counter step, attacker wins ties, damage/Trigger 7-1-4 + 10-1-5, max 5 Characters (trash one to play a 6th), 1 Stage, defeat 1-2-1-1 (0 Life + damage, or 0 cards in deck), card text overrides rules.
- Supported card pool = the five guide decks (ST30-001 Luffy & Ace, OP14-020 Mihawk, OP13-001 Luffy, OP13-004 Sabo, OP09-062 Robin) using their top meta list; every card in them has a coded effect and a test. Cards outside the pool are never offered in play.
- The engine exposes `legalActions(state)`; UI and AI may only dispatch actions from that list. Any other action is rejected with a reason.
- Deterministic: `createGame({ seed })`; same seed + same actions = same game.
- Phone-first UI at 360–390px; reduced motion respected; all text escaped; the game autosaves to the store and can be resumed.
- Hidden information stays hidden in the UI and is never used by Easy/Normal AI (they see only what a player could see). Hard AI may use opponent's hand size but never its contents.

## Review Focus

1. A random-play fuzz run (500 games, many seeds, all deck pairs) never throws, never reaches a state with no legal action and no winner, and every game ends within 60 turns. Test in Task 9.
2. Effects with "up to" and no valid targets resolve as no-ops (CR 1-3-2), not errors. Test in Task 3.
3. Playing a 6th Character asks which one to trash (CR 3-7-6-1), and that trash is not a K.O. (no [On K.O.]). Test in Task 2.
4. Deck-out loss happens at rule processing when the deck reaches 0, not only when a draw fails (CR 1-2-2-2). Test in Task 2.
5. Resuming a saved game after an app update with a changed card pool → clear "This saved game can't continue" message, not a crash. Test in Task 8.

---

### Task 1: Game state, seeded RNG, setup
**Files:** `js/game/rng.js`, `js/game/state.js`; Test `tests/game/setup.test.mjs`
**Interfaces:** `mulberry32(seed) -> () => number`; `createGame({ seed, decks: [DeckSpec, DeckSpec], first: 0|1 }) -> State` where `DeckSpec = { leaderId, entries }`; `State = { seed, rngState, turn, active: 0|1, phase: 'mulligan'|'refresh'|'draw'|'don'|'main'|'end'|'over', players: [P, P], battle: null|{...}, pending: null|Choice, log: Event[], winner: null|0|1 }`; `P = { leader, deck: Inst[], hand, life, trash, chars, stage, donDeck: number, donActive, donRested, firstTurnDone }`; `Inst = { uid, id, rested, don, mods: [] }`.
- [ ] Tests: deterministic shuffle by seed; 5-card hands; mulligan once (first player decides first); Life = Leader life, top-of-deck placed so the top card is bottom of Life (CR 5-2-1-7). RED→GREEN→commit.

### Task 2: Turn structure and core rules
**Files:** `js/game/rules.js`; Test `tests/game/rules.test.mjs`
**Interfaces:** `dispatch(state, action) -> State` (pure); `legalActions(state) -> Action[]`; actions: `mulligan`, `keep`, `play {uid, trashUid?}`, `giveDon {targetUid}`, `attack {uid, targetUid}`, `block {uid}`, `counter {uid}`, `noBlock`, `endCounter`, `useTrigger`, `skipTrigger`, `activate {uid, ability}`, `choose {...}` (answers `pending`), `endTurn`.
- [ ] Tests (each cites a CR rule): refresh returns given DON rested then stands all; first player no draw + 1 DON; DON cap at 10; no battle turn 1 for both players; summoning sickness except [Rush]; targets: Leader or rested Characters only; block step before counter step, one block; attacker wins ties; Leader damage moves Life to hand / Trigger choice; [Double Attack] 2 damage; [Banish] trashes Life without Trigger; K.O. on lost battle; 6th Character → `pending` choose-trash, not a K.O.; Stage replacement; defeat by 0 Life + damage and by deck 0 at rule processing; `legalActions` never lists an illegal action (property test over random states). RED→GREEN→commit.

### Task 3: Effect interpreter
**Files:** `js/game/effects.js`; Test `tests/game/effects.test.mjs`
**Interfaces:** effect = `{ when: 'onPlay'|'whenAttacking'|'onKO'|'onBlock'|'onOppAttack'|'activateMain'|'main'|'counter'|'trigger'|'endOfTurn'|'static', once?: true, cond?: Cond, cost?: Cost[], steps: Step[] }`. Steps: `draw n`, `trashFromHand n`, `look {n, filter, take, rest:'bottom'|'trash'}`, `ko {filter, upTo}`, `rest {filter, upTo}`, `setDonActive n`, `addDon {active, rested}`, `returnDon n`, `giveDon {n, target}`, `power {target, amount, until}`, `cost {target, amount, until}`, `bounce {filter, upTo}`, `playFrom {zone:'hand'|'trash', filter, rested?}`, `lifeFromDeck n`, `lifeToHand {who}`, `keyword {target, kw, until}`, `lock {target, what:'attack'|'rest'|'refresh', until}`, `choose [Step[]...]`. Conds: `leaderName`, `leaderType`, `lifeAtMost/AtLeast`, `donOnField`, `hasCharCost>=`, `handSize`. Costs: `restDon n`, `restCards n`, `donMinus n`, `trashHand {n, filter}`, `restSelf`, `trashSelf`. "Up to" + no targets = no-op. Choices create `pending` for the acting player.
- [ ] Tests per primitive and for choice resolution, durations ("during this turn", "until end of opponent's next End Phase"), [Once Per Turn], [DON!! xN] conditions, static auras recomputed every read. RED→GREEN→commit.

### Task 4: Card pool — 70 cards across the five guide decks
**Files:** `js/game/cards/index.js` (+ one file per deck: `luffy-ace.js`, `mihawk.js`, `luffy.js`, `sabo.js`, `robin.js`); `js/game/decks.js` (the five decks from `data/meta.json` top lists, frozen into code so games don't change daily); Test `tests/game/cards.test.mjs`
- [ ] For every card: an effect definition transcribed from its printed text, plus one scenario test that the effect does what the text says. A coverage test fails if any card in the five decks lacks a definition or test. Vanilla cards are declared `vanilla: true`. RED→GREEN→commit per deck.

### Task 5: AI players
**Files:** `js/game/ai.js`; Test `tests/game/ai.test.mjs`
**Interfaces:** `chooseAction(state, player, level: 'easy'|'normal'|'hard', rng) -> Action` (always from `legalActions`).
- Easy: random legal action, biased to finish turns. Normal: heuristics — mulligan hands without a ≤2 cost play; spend DON on the best-value affordable plays; give DON to make attacks win; attack Leader when it wins, rested Characters when it trades up; block/counter to save the Leader at ≤2 Life or a Character worth more than the counter spent; use Triggers. Hard: Normal's candidate moves scored by a 1-turn lookahead with an evaluation (Life diff, board power, hand size, DON) using only public info.
- [ ] Tests: AI only returns legal actions over 200 random states; Normal wins ≥ 70% vs Easy over 100 seeded games; Hard ≥ 55% vs Normal. RED→GREEN→commit.

### Task 6: Coach
**Files:** `js/game/coach.js`; Test `tests/game/coach.test.mjs`
**Interfaces:** `phaseTip(state) -> string`; `judge(prevState, action, nextState) -> { tone: 'good'|'ok'|'risky', text } | null`; `hint(state) -> { action, text }` (Normal AI's choice + a plain-English reason).
- [ ] Tests: tips exist for every phase; judge flags attacking into a guaranteed loss, ending the turn with unspent DON and playable cards, over-countering a non-lethal hit; hint returns a legal action with text. RED→GREEN→commit.

### Task 7: Game UI
**Files:** `js/views/play.js` (`#/play`: choose your deck, opponent deck, difficulty, coach on/off, resume), `js/views/game.js` (`#/game`), `js/ui/game/board.js`, `js/ui/game/hand.js`, `js/ui/game/actions.js` (bottom action sheet for the tapped card), `js/ui/game/battle.js` (defender overlay: block / counters / done), `js/ui/game/coachbox.js`, `js/ui/game/log.js`; Modify `js/app.js` (entry "Play" on the Learn map after Lesson 8 and a "Play a practice game" button on the Learn tab; Lesson 11 links to it), router, CSS.
- Board: opponent zone top (Leader, Life stack, Characters, Stage, DON count, hand count), mine bottom, my hand as an overlapping fan. Tap a card → action sheet listing only legal actions for it. Rested cards rotate 90°, DON!! cards slide to their target, attacks lunge, K.O. cards fade to trash, Life cards flip. Computer moves play out with 500–900 ms pacing and a "Skip animations" toggle.
- [ ] Screenshot review 360/390 light/dark; e2e in Task 9. Commit.

### Task 8: Save & resume
**Files:** `js/game/save.js`; Test `tests/game/save.test.mjs`
**Interfaces:** `saveGame(state) -> string`, `loadGame(str, pool) -> { ok, state } | { ok: false, error }` (rejects version mismatch or cards outside the current pool).
- [ ] Tests incl. Review Focus 5. RED→GREEN→commit.

### Task 9: Fuzz, e2e, review, merge
- [ ] Fuzz test (Review Focus 1): 500 seeded Easy-vs-Easy and Normal-vs-Normal games across all deck pairs.
- [ ] e2e: start a game as Luffy & Ace vs Mihawk on Easy with coach on, mulligan, play a card, give DON, attack, defend with a counter, use a hint, finish a turn; resume after reload.
- [ ] Full suite + e2e green; precache; screenshots; fresh whole-branch review; fix Critical/Important; merge.
