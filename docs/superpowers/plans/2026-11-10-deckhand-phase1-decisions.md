# SDD ledger — plan: docs/superpowers/plans/2026-11-10-deckhand-phase1.md
Pre-flight:
- T1→T4/T5/T7 Card shape: consumers use id,name,type,cost,power,counter,life,colors,traits,text,img,altImgs,price — consistent.
- T2 router views include 'deck' consumed by T7 #/deck/<rank> — consistent.
- T3 richText consumed by T4 card detail — consistent.
- T5 lesson format consumed by T6 — consistent. T6 L11 reads meta+guides (T7 produced later) — Ruling: write L11 content after T7 guides exist (do T7 before finishing L11) — cost if wrong: none, order only.
Task 1: Ruling: meta source switched to TCGplayer deck feed (infinite-api.tcgplayer.com, 60-day window, up to 250 lists) with Limitless as fallback — Limitless's newest OP results are July 2026 (stale); TCGplayer has Sept–Nov 2026 regionals and the user asked for TCGplayer — cost if wrong: undocumented API may change; fallback + keep-previous covers it.
Task 1: Ruling: cards gain optional `tcgUrl` (direct TCGplayer product link) and `source`; missing meta cards fill from TCGplayer card info first, then Limitless — cost if wrong: UI must fall back to search URL when tcgUrl absent.
Task 1: Ruling: counter 0 normalized to null (0 = "no counter") — cost if wrong: none; UI shows "—".
Task 1: Ruling: meta.json shape extended with source/sampleSize/from/to and list.url/placeMin/players; `points` = number of top-placing lists — cost if wrong: UI labels.
Task 1: complete (commits 72c2d93..b617cd7, tests: npm test → # duration_ms 128.582767)
Task 2: Ruling: visual direction refined from "aged-paper logbook" to "navigator's sea chart" (pale chart paper + grid, navy ink, signal-flag red/yellow; Alfa Slab One + Atkinson Hyperlegible) — the cream-paper/serif/red look is a generic AI-design default; the spec's intent (nautical, hand-crafted, not AI-looking) is kept — cost if wrong: palette swap in tokens.css.
Task 2: Ruling: store keeps values in memory for the session when localStorage throws (test updated to expect that) — better than forgetting mid-session — cost if wrong: none.
Task 2: Ruling: added data.getLessonIndex() (content/lessons/index.json), scripts/serve.mjs and scripts/shot.mjs helpers — needed by lesson map, e2e and screenshot review — cost if wrong: none.
Task 2: complete (commits b617cd7..7570804, tests: npm test → # duration_ms 128.403441)
Task 3: Ruling: glossary entries carry `group` (sections) and optional `pattern` (regex for DON!! xN / DON!! −N); richText also renders {Type} refs as trait buttons — needed by real card text — cost if wrong: none.
Task 3: Ruling: rules checked against official Comprehensive Rules v1.2.1 (8/28/2026), en.onepiece-cardgame.com/pdf/rule_comprehensive.pdf — record in SOURCES.md in Task 6.
Task 3: Ruling: displayName() test was written after the helper (TDD slip, small pure helper) — cost if wrong: none, test covers it now.
Task 3: complete (commits 7570804..927c73d, tests: npm test → # duration_ms 211.125495)
Task 4: Ruling: primary card source is now TCGplayer's catalog via tcgcsv.com (87 groups incl. OP18), optcgapi fills missing numbers + empty fields (fillGaps) — user asked for TCGplayer; catalog has product links/prices/newest set — cost if wrong: tcgcsv outage → optcgapi fallback → previous file.
Task 4: Ruling: "SAMPLE" watermark on many images is Bandai's official scan policy (same on Bandai's site); kept TCGplayer images — cost if wrong: cosmetic.
Task 4: Ruling: tilt-on-drag moved from grid tiles to the detail card (tiles would fight page scrolling); tiles get a press effect instead — cost if wrong: none.
Task 4: Ruling: added popularFirst() default browse order (meta-played cards first) and a "Seen in the meta" section on card detail — beginner relevance — cost if wrong: none.
Task 4: Ruling: mergeCardLists tests were written after the function (TDD slip) — covered now.
Task 4: complete (commits 927c73d..ce92c45, tests: npm test → # duration_ms 310.760274)
Task 5: Ruling: board rules core lives in js/lib/board.js + js/lib/scenarios.js (pure, Node-testable); js/ui/miniboard.js only renders — plan put boardReducer in miniboard.js — cost if wrong: none.
Task 5: Ruling: added defending actions (block/useCounter/resolve) and Trigger choice to the reducer, plus scenario solution tests — needed for blocker/counter/life-trigger boards.
Task 5: Ruling: lesson html marks glossary words as <kw>Term</kw> (validated by content tests) — cost if wrong: none.
Task 5: Ruling: mergeCardLists ranks exact home group > related group (PRE/RE) > reprint — fixes pre-release variants winning — test added RED→GREEN.
Task 5: Ruling: progress.js was written before its test; verified RED by moving the module away, then GREEN — cost if wrong: none.
Task 5: complete (commits ce92c45..28d86a1, tests: npm test → # duration_ms 425.98955)
Task 6: Ruling: lessons are generated from scripts/make-lessons.py (single source, easier to edit than 11 JSON files) — cost if wrong: none; JSON is committed too.
Task 6: Ruling: lesson 11 uses a dynamic {type:'deckpick'} step, rendered in Task 7 from meta + guides (pre-flight ruling) — content test allows it.
Task 6: Ruling: lesson example cards are recent Standard-legal commons (OP13–ST31) so callout pins match the standard frame and cards are tournament-legal — cost if wrong: none.
Task 6: complete (commits 28d86a1..5474454, tests: npm test → # duration_ms 401.338236)
Task 7: Ruling: both card sources drop the "−" sign (DON!! −1, give −1000 power); added scripts/lib/text.mjs fixMinusSigns applied to all card text — misleading rules text otherwise — cost if wrong: a rare false positive on a "give ... N power" clause.
Task 7: Ruling: guides written for ST30-001, OP14-020, OP13-001, OP13-004, OP09-062 (5 colors, difficulty 1–3); claims checked against card text; matchup notes kept general — cost if wrong: guide edits.
Task 7: Ruling: lesson 11 deckpick step renders the 3 easiest guided meta decks; lesson 10 notes Block 1 reprint exception (OP01-055 is in Standard lists via PRB-02 reprint).
Task 7: Ruling: global img { height:auto } — width-only CSS with height attrs stretched images.
Task 7: complete (commits 5474454..1c3e505, tests: npm test → # duration_ms 525.505254)
Task 8: Ruling: PRECACHE list is generated by scripts/precache.mjs (content-hash version) and a test fails if any app file is missing from it — keeps offline complete without a build step — cost if wrong: forgetting to rerun → test fails.
Task 8: Ruling: added About page (sources, install steps, reset progress, disclaimer) — spec mentions About/disclaimer.
Task 8: complete (commits 1c3e505..fdd07c2, tests: npm test → # duration_ms 502.517792)
Task 9: Ruling: workflow runs fetch-data before tests (content tests need fresh cards.json ids) — plan had tests first — cost if wrong: none; a failing test still blocks deploy.
Task 9: complete (commits fdd07c2..5813b9f, tests: npm test → # duration_ms 479.094972)
Task 10: complete-ish: e2e 10/10; fixed blocked-storage crash (store test RED→GREEN); fixed 360px horizontal scroll.
Final: review by fresh reviewer (opus): 0 Critical, 6 Important, 12 Minor.
Final: fixed SW caches error/portal pages — tests/sw.test.mjs cacheable RED→GREEN, suite 163/163
Final: fixed no timeout on data fetch — networkFirst timeout test RED→GREEN, suite 163/163
Final: fixed render-blocking Google Fonts — self-hosted fonts test RED→GREEN, suite 163/163
Final: fixed opaque image quota — SW fetches CORS copies, opaque never cached (test RED→GREEN), suite 163/163
Final: fixed unescaped third-party fields/URL schemes — safeUrl/safeColors + pipeline coercion tests RED→GREEN, suite 163/163
Final: fixed missing card stats/types — fillGaps backfill tests RED→GREEN; data now 0 leaders w/o life, 0 chars w/o power, suite 163/163
Final: Ruling: re-graded Minor 5 (block after counters), 6 (multicolor wording), 8 (disclaimer text) to Important — a learning app teaching a wrong rule or showing junk text misleads beginners — fixed with RED→GREEN tests.
Final: Ruling: Declined-to-judge "Standard = Blocks 2–5 Apr 2026–Mar 2027" — verified against Bandai topics/013.php (recorded in SOURCES.md); stands.
Final: Ruling: Declined-to-judge deck-guide strategy claims — each claim was checked against card text when written; matchup notes kept general — cost if wrong: guide edits.
Final: minor (deferred): pwa test doesn't assert sw VERSION equals content hash
Final: minor (deferred): skipWaiting+clients.claim can mismatch modules in a tab open during deploy
Final: minor (deferred): card/deck views lack error states when data is unreachable and uncached
Final: minor (deferred): fixMinusSigns could misfire on hypothetical "with 4000 or 5000 power" wordings (none in data)
Final: minor (deferred): browse/filter sort ~30ms desktop (precompute ranks)
Final: minor (deferred): deploy publishes tests/docs/scripts; push race on main skips a day; content-test drift can block deploys
Final: minor (deferred): router decodeURIComponent throws on malformed hash; #/lesson/99 says "check connection"; deck price wording
Final: minor (deferred): lesson/glossary say counters boost "the card being attacked" (CR allows Leader or any 1 Character)
