# SDD ledger — plan: docs/superpowers/plans/2026-11-10-deckhand-phase2.md
Pre-flight:
- T1 deck.js consumed by T3 (canAdd/validateDeck/parseDeckText/formatDeckText/metaHints) and T6 (decks shape) — consistent.
- T2 decks-store consumed by T3/T6 — consistent.
- T4 shard shape consumed by T5 priceSeries — consistent.
Task 1: Ruling: card-id pattern in deck import accepts any XXX-YYY token (A-Z0-9) — covers P-093, PRB-xx and future formats — cost if wrong: a stray hyphenated word becomes an 'unknown card' bad line, which is reported, not imported.
Task 1: Ruling: npm 'pretest' runs scripts/precache.mjs so the offline list and sw VERSION are always current (also resolves Phase 1 deferred minor) — cost if wrong: none.
Task 1: complete (commits 4a0dc56..9900197, tests: npm test → # duration_ms 711.673276)
Task 2: complete (commits 39ebf58..1a0911e, tests: npm test → # duration_ms 689.969939)
Task 3: Ruling: builder is one screen with Add / My deck / Check sections and a sticky 50-card bar (phone-friendly) instead of separate pages; long-press a card tile opens its detail — cost if wrong: layout only.
Task 3: Ruling: changing Leader removes off-color cards after a confirm — keeps deck legal-by-construction — cost if wrong: user loses those entries after confirming.
Task 3: Ruling: router decodeURIComponent made non-throwing (Phase 1 deferred minor) with test RED→GREEN.
Task 3: complete (commits 1a0911e..308de36, tests: npm test → # duration_ms 665.403682)
Task 4: Ruling: price history is recorded only when today's card data arrived (stale prices are never re-recorded as a new day); added updatePriceHistory(read, write) helper with tests — cost if wrong: a missed day on outages, by design.
Task 4: complete (commits 308de36..358fdc3, tests: npm test → # duration_ms 696.097587)
Task 5: Ruling: price change shown with ▲/▼ glyph in ink color, not green/red — status colors are reserved and a price rise isn't 'good' or 'bad'; table view included per dataviz rules; card page now has an offline error state (Phase 1 deferred minor).
Task 5: complete (commits 358fdc3..6697c11, tests: npm test → # duration_ms 706.244355)
Task 6: Ruling: backup lives on the About page (linked from My decks); restore previews contents and replaces this device's data only after a tap — cost if wrong: none.
Task 6: complete (commits 6697c11..9805f80, tests: npm test → # duration_ms 774.987506)
Task 7: e2e extended to 20 steps (deck builder, meta copy, price section, backup→restore on a fresh context, review regressions).
Final: review by fresh reviewer (opus): 1 Critical, 4 Important, 11 Minor.
Final: fixed CRITICAL restored-backup XSS via quiz scores — backup tests 'quiz scores must be whole numbers 0-3' + learn.js Number() RED→GREEN, suite 206/206
Final: fixed missing-Leader deck unopenable — e2e 'a deck whose Leader vanished opens the Leader picker' + canAdd reason unit test RED→GREEN, suite 206/206, e2e 20/20
Final: fixed backups that fail their own restore (0x lines, >99 counts) — parse 0x test + 'makeBackup output always passes readBackup' RED→GREEN
Final: fixed builder click-listener leak on #view + IntersectionObserver cleanup — e2e listener-count test RED→GREEN
Final: fixed stale price chart drawn on the next card — e2e slow-shard race test RED→GREEN (service worker blocked so stubs apply)
Final: Ruling: re-graded Minor 'reserved/duplicate deck ids in backups' to Important (a restored deck could be unopenable) — backup id test RED→GREEN
Final: Ruling: re-graded Minor 'restore reports success without saving' to Important (silent data loss) — store.set returns persisted flag; e2e quota test RED→GREEN
Final: Ruling: re-graded Minor 'malformed meta entry crashes builder' to Important (blank screen) — e2e test RED→GREEN
Final: fixed unhandled 'Transition was skipped' rejection on fast navigation (found by e2e page-error check)
Final: Ruling: Declined-to-judge Block 1 enforcement — out of Phase 2 scope; Check tab shows it as a note; card data has no block numbers.
Final: Ruling: Declined-to-judge CR 5-1-2-4 deck-building exceptions (cards allowing >4 copies) — not in scope; such decks would show as not legal; noted for later.
Final: Ruling: Declined-to-judge 5-tab bar at 320px and chart touch-action — app targets 360px+; chart hit area inherits pan-y from the svg.
Final: minor (deferred): abandoned 'New deck' entries pile up in My decks
Final: minor (deferred): tapping Import twice in the same sheet saves a duplicate deck
Final: minor (deferred): price chart spaces points evenly, so gaps from null days look continuous
Final: minor (deferred): price rows for cards that left the data stay as nulls until trimmed
Final: minor (deferred): price shards grow the repo by a few MB a year
Final: minor (deferred): toast has both role=status and aria-live=assertive
Task 7: complete (commits 9805f80..24955aa, tests: npm test → # duration_ms 733.257169)
