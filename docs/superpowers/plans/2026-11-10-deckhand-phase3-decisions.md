# SDD ledger — plan: docs/superpowers/plans/2026-11-10-deckhand-phase3.md
Pre-flight: T1 state shape consumed by T2-T8; T3 effect schema consumed by T4; legalActions (T2) consumed by T5/T6/T7 — consistent.
Task 1: Ruling: card pool frozen into js/game/pool-data.js by scripts/make-game-pool.mjs (moved from Task 4) — setup tests need decks — cost if wrong: none.
Task 2: Ruling: block step is skipped automatically when the defender has no usable Blocker (fewer taps); effect frames may hold function refs, so engine uses its own deep copy — save/load must only save at stable points (Task 8).
Task 2: Ruling: OP17-095 Zoro's optional removal replacement is applied automatically when possible (almost always beneficial) — cost if wrong: player can't decline it.
Task 2: Ruling: triggered effects resolve in a fixed order (attacker's first) instead of player-chosen order (CR 8) — cost if wrong: rare ordering differences.
Task 1: complete (commits bb02833..e484017, tests: npm test → # duration_ms 841.639775)
Task 2: complete (commits bb02833..e484017, tests: npm test → # duration_ms 832.986142)
Task 4: Ruling: all 70 card definitions live in one file js/game/cards/index.js (plan said one per deck) — shared helpers; 73 per-card tests + coverage test — cost if wrong: none.
Task 4: Ruling: Kin'emon 'rest your attribute Leader' read as <Slash> Leader (attribute icon lost in source text); OP09-078 'Then draw 2' resolves only if the Straw Hat condition holds (CR 4-10-1).
Task 4: Ruling: a Counter from a Character card always powers the battle target (the usual choice) instead of letting the defender pick any card (CR 7-1-3-1-1).
Task 3: complete (commits e484017..e6de6d2, tests: npm test → # duration_ms 973.030335)
Task 4: complete (commits e484017..e6de6d2, tests: npm test → # duration_ms 971.060025)
Task 5: Ruling: Hard = play out the rest of its own turn for each candidate with the Normal policy (plus a counter-reserve bonus), not a full opponent-turn search — met the ≥55% vs Normal bar; win-rate tests use 30 games for speed — cost if wrong: Hard is less deep than a true 1-turn minimax.
Task 5: complete (commits e6de6d2..2b57e42, tests: npm test → # duration_ms 21844.716469)
Task 8: Ruling: done before Task 7 (UI needs it); saving returns null mid-effect and the UI saves at the next stable moment.
Task 6: complete (commits 2b57e42..0c76390, tests: npm test → # duration_ms 21455.745966)
Task 8: complete (commits 2b57e42..0c76390, tests: npm test → # duration_ms 21883.267697)
Task 7: Ruling: actions open as buttons in a bottom panel (incl. one button per attack target with both powers) instead of tap-the-target mode — fewer mis-taps on a phone; tab bar hidden during games with an Exit button (game is saved).
Task 7: complete (commits 0c76390..65d4a3c, tests: npm test → # duration_ms 22304.597687)
Task 9: fuzz 500/500 games finished, 0 errors, longest 51 turns; found+fixed budget-pick legal-action bug (test RED→GREEN); e2e 24/24.
Final: review by fresh reviewer (opus): 0 Critical, 3 Important, 13 Minor; all 70 card definitions judged faithful to printed text.
Final: fixed counter-step removal check (CR 7-1-3-1-3) — review-fixes test RED→GREEN, suite 329/329
Final: fixed AI/hint hidden-information leak — AI simulates on publicView (opponent hand, all Life and decks blanked) — test RED→GREEN; AI win-rate tests still pass
Final: fixed Rematch leaving a live AI loop — shared unmount; e2e (pinned seed) RED→GREEN, e2e 25/25
Final: Ruling: re-graded Minor 'declining a Trigger cost trashes the card' to Important (rules error in the Robin deck) — now goes to hand; test RED→GREEN
Final: Ruling: re-graded Minor '"cannot be rested" ignored by rest effects' to Important (Oden vs Shanks/Yasopp) — test RED→GREEN
Final: Ruling: re-graded Minor 'Hard AI freezes UI' to Important — 300 ms time budget (Normal's pick always considered); timing test
Final: Ruling: Declined-to-judge Mihawk 'Then, you cannot play Characters' scope — kept inside the If per CR 4-10-1.
Final: Ruling: Declined-to-judge phone layout at 320 px — app targets 360 px+, screenshots at 375 px reviewed.
Final: minor (deferred): Double Attack at 1 Life ends the game (no pool card has Double Attack)
Final: minor (deferred): simultaneous deck-out makes only the active player lose
Final: minor (deferred): negated Character's [On K.O.] still fires (ruling uncertain)
Final: minor (deferred): effect-played Characters' [On Play] resolves before the rest of the parent effect
Final: minor (deferred): Thousand Sunny ability requires a rested DON!! to be activatable
Final: minor (deferred): stale playPrefs.level could crash the setup page
Final: minor (deferred): saves don't validate limbo card ids
Final: minor (deferred): exit mid-look effect then resume lets you re-see deck top
Final: minor (deferred): misleading comment in playFrom; odd mulligan expression
Task 9: complete (commits 65d4a3c..4252533, tests: npm test → # duration_ms 12279.156087)
