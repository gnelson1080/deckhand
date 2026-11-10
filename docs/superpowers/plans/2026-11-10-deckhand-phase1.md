# Deckhand Phase 1 (Core App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-first, installable static site that teaches the One Piece Card Game from zero (11 lessons + quizzes), with card search, a daily-refreshed meta tab with beginner deck guides, and a glossary.

**Architecture:** Plain HTML/CSS/ES-module JS, no framework, hash-based router, four tabs. A Node script (no deps) snapshots card data (optcgapi.com, fallback Limitless card pages) and meta data (Limitless) into `data/*.json`; a scheduled GitHub Action reruns it daily and deploys to GitHub Pages. Hand-written content lives in `content/*.json`.

**Tech Stack:** HTML/CSS/JS (ES2022 modules), Node 22 (`node:test`, global `fetch`), Playwright (pre-installed, via `createRequire`), GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-11-10-deckhand-design.md`

Phases 2 (deck builder, price history, backup code) and 3 (practice game vs. computer) get their own plans after Phase 1 ships.

## Global Constraints

- No runtime dependencies; no build step for the app itself. No dev dependencies except the pre-installed Playwright.
- Phone first: designed at 390×844, works down to 360px wide, 16px side gutter, no horizontal scroll, tap targets ≥ 44px.
- Every `localStorage` access wrapped in try/catch; app works fully without it.
- All motion disabled or reduced under `prefers-reduced-motion: reduce`.
- Visual direction "ship's logbook": aged paper, ink-black, red accent, brass details; dark mode "night at sea" (navy, lantern gold). No purple gradients, no glassmorphism, no emoji-as-icons. Colors as CSS custom properties on `:root`, dark mode via `prefers-color-scheme` plus `[data-theme]` override.
- No One Piece logos or official branding. Footer + About: "Unofficial fan-made learning tool. Not affiliated with Bandai, Eiichiro Oda, Shueisha, Toei Animation or TCGplayer. Card images © their owners."
- Every card shows a "View on TCGplayer" link: `https://www.tcgplayer.com/search/one-piece-card-game/product?q=<CARD_ID>`.
- Rules content must match Bandai's official rule manual / Comprehensive Rules (fetched during Task 6, URL recorded in `content/SOURCES.md`).
- Card IDs use the printed format `OP11-041`, `ST01-012`, `EB01-001`, `P-001`.
- Fetch script identifies itself with User-Agent `Deckhand-data-bot (GitHub Pages fan project)`; ≥ 300 ms between Limitless requests.

## Review Focus

1. Offline / flaky phone network → app shell, lessons and last cached data still load (service worker); data screens show "Updated <date>" not a blank screen. Test in Task 10.
2. `localStorage` throwing (private mode) → lessons still open and quizzes still run; progress just isn't kept. Test in Task 2.
3. A meta decklist card ID missing from optcgapi (e.g. newest set OP-18) → card still shows name + image via Limitless fallback, never "undefined". Test in Task 1.
4. Cards with null cost/power/counter (Leaders, Events, DON!!) → rendered as "—", search filters don't crash. Test in Task 1 (normalize) and Task 4 (filter).
5. Search over ~2,500 unique cards on a mid-range phone → typing stays responsive (debounced, results rendered in pages of 60 with lazy images). Test in Task 4.

---

### Task 1: Data pipeline (cards + meta snapshot)

**Files:**
- Create: `scripts/fetch-data.mjs`, `scripts/lib/normalize-cards.mjs`, `scripts/lib/parse-limitless.mjs`, `package.json` (`"type":"module"`, scripts `test`, `fetch-data`, `e2e`)
- Create (generated, committed): `data/cards.json`, `data/meta.json`, `data/updated.json`
- Test: `tests/normalize-cards.test.mjs`, `tests/parse-limitless.test.mjs`, fixtures in `tests/fixtures/` (trimmed copies of a real optcgapi record set, Limitless `/decks`, `/decks/<id>`, `/decks/list/<id>`, `/cards/<id>` pages)

**Interfaces:**
- Produces `normalizeCards(rawOptcg: object[]): Card[]` where
  `Card = {id, name, set, setName, rarity, colors: string[], type: 'Leader'|'Character'|'Event'|'Stage'|'DON!!', cost: number|null, power: number|null, counter: number|null, life: number|null, attribute: string|null, traits: string[], text: string, img: string, altImgs: string[], price: number|null}`.
  Groups records by `card_set_id`; base record = the one whose `card_image_id === card_set_id`; others' images go to `altImgs`. Colors split on space/"/". Traits split on "/". Numbers parsed, "-"/"" → null. Merges ST cards from `allSTCards`.
- Produces `parseMetaTable(html): {rank, deckPath, leaderId, name, colors, points, share}[]`, `parseArchetypeLists(html): {format, place, player, event, listPath}[]`, `parseDecklist(html): {leaderId, cards: {id, count}[]}`, `parseCardPage(html): Partial<Card>` (name, type, colors, life, power, text, traits, img, legality string e.g. "Block 3").
- `data/meta.json` = `{format, fetchedAt, decks: [{rank, name, leaderId, colors, points, share, url, lists: [{place, player, event, date, cards:{id,count}[]}] }]}` — top 10 decks, up to 3 lists each.
- `data/updated.json` = `{cards: ISODate, meta: ISODate}`.

- [ ] Step 1: Save fixtures (curl the real pages/JSON into `tests/fixtures/`, trimmed to ≤ 30 KB each).
- [ ] Step 2: Write failing tests: `normalizeCards` groups `OP01-077` + `OP01-077_p1` into one card with 1 alt image; a Leader has `cost === null` and `life` a number; Event `power === null`; `colors` for "Blue Yellow" is `['Blue','Yellow']`. `parseMetaTable` on fixture returns rank 1 `{name:'Nami', leaderId:'OP11-041', colors:['Blue','Yellow'], share:23.52}`. `parseDecklist` returns counts summing to 51 (1 leader + 50). `parseCardPage` returns name 'Nami', life 4, legality 'Block 3'.
- [ ] Step 3: Run `node --test tests/` → FAIL (modules missing).
- [ ] Step 4: Implement the parsers with regexes over the structures in the fixtures (`data-id`/`data-count` attributes, `.deck-link`, `.card-text-section`).
- [ ] Step 5: Implement `fetch-data.mjs`: fetch optcgapi `allSetCards` + `allSTCards`, normalize; fetch Limitless meta + lists; for every list card ID not in cards, fetch `/cards/<id>` and add it (Review Focus 3). On any source failure keep the previous file and log a warning; exit 0. Write files sorted by id, 2-space JSON only for meta, compact for cards.
- [ ] Step 6: Add test: card ID present in a decklist but absent from optcgapi input is filled by `parseCardPage` result (inject fetcher). Run `npm test` → PASS. Run `npm run fetch-data` → files written, `cards.json` > 2,000 cards.
- [ ] Step 7: Commit.

### Task 2: App shell, design system, router, storage

**Files:**
- Create: `index.html`, `css/tokens.css`, `css/base.css`, `css/components.css`, `css/motion.css`, `js/app.js`, `js/router.js`, `js/store.js`, `js/data.js`, `js/icons.js`, `assets/fonts/` (self-host via Google Fonts CSS link is allowed; prefer `<link>` to Google Fonts), `assets/paper.svg` (noise texture)
- Test: `tests/store.test.mjs`, `tests/router.test.mjs`

**Interfaces:**
- `router.js`: `parseHash(hash: string): {view: 'learn'|'lesson'|'cards'|'card'|'meta'|'deck'|'glossary'|'about', param: string|null}`; `onRoute(cb)`; routes `#/learn`, `#/lesson/<n>`, `#/cards`, `#/card/<id>`, `#/meta`, `#/deck/<rank>`, `#/glossary`, `#/about`. Unknown → learn.
- `store.js`: `createStore(storage = globalThis.localStorage)` → `{get(key, fallback), set(key, value)}`; JSON-encodes; never throws.
  Keys: `progress` = `{completed: number[], quiz: {[lessonId]: bestScore}}`, `theme` = `'light'|'dark'|null`, `seenIntro` = boolean.
- `data.js`: `loadJSON(path): Promise<any>` (memoized), `getCards(): Promise<Map<id, Card>>`, `getMeta()`, `getUpdated()`, `getGlossary()`, `getLesson(n)`, `getDeckGuide(leaderId)`.
- `icons.js`: `icon(name, {size})` returns inline SVG string for: compass, map, spyglass, scroll, anchor, ship, check, close, search, back, sun, moon.

- [ ] Step 1: Failing tests: `parseHash('#/card/OP11-041')` → `{view:'card', param:'OP11-041'}`; `parseHash('#/nope')` → learn. `createStore` with a storage whose `getItem`/`setItem` throw returns fallback and does not throw (Review Focus 2).
- [ ] Step 2: Run → FAIL. Implement. Run → PASS.
- [ ] Step 3: Build the shell: header with title + theme toggle, `<main>` view slot, bottom tab bar (Learn/compass, Cards/scroll, Meta/spyglass, Glossary/map) with an animated ink-underline indicator; page-turn transition between views (View Transitions API where supported, CSS fallback). Load the `frontend-design` skill before writing the CSS and follow it.
- [ ] Step 4: Open at 390×844 with Playwright, screenshot light + dark, check the look against Global Constraints; fix.
- [ ] Step 5: Commit.

### Task 3: Glossary + tap-to-define keyword text

**Files:**
- Create: `content/glossary.json`, `js/views/glossary.js`, `js/ui/rich-text.js`, `js/ui/sheet.js` (bottom sheet)
- Test: `tests/rich-text.test.mjs`, `tests/content.test.mjs` (started here, extended in later tasks)

**Interfaces:**
- `glossary.json`: `[{term, aliases: string[], short: string (≤ 200 chars), long: string, example?: cardId}]`. Must cover at least: Leader, Character, Event, Stage, DON!!, DON!! deck, Cost area, Active, Rested, Life, Trigger, Counter, Power, Attack, Block, KO, Trash, Hand, Deck, Mulligan, Refresh Phase, Draw Phase, DON!! Phase, Main Phase, End Phase, Rush, Blocker, Double Attack, Banish, On Play, When Attacking, On Block, On K.O., On Your Opponent's Attack, Activate: Main, Main, Counter (event), Trigger, End of Your Turn, DON!! xN, Your Turn, Opponent's Turn, Once Per Turn, Give DON!!, Return DON!!, Unblockable, Type/Trait, Attribute, Color, Block (rotation), Standard format.
- `richText(text: string, glossary): string` → HTML where every `[Keyword]` and `DON!! −N` / `DON!! xN` token matching a glossary term/alias becomes `<button class="kw" data-term="…">`; all other text HTML-escaped.
- `openSheet({title, html})`, `closeSheet()`; sheet slides up, drag-down to close, Esc closes, focus trapped.

- [ ] Step 1: Failing tests: `richText('[On Play] Draw 1 card.')` contains `data-term="On Play"`; `<script>` in input is escaped; unknown `[Foo]` stays plain escaped text. Content test: every glossary entry has non-empty `term` and `short` ≤ 200 chars; no duplicate terms/aliases.
- [ ] Step 2: Run → FAIL. Implement + write glossary (plain English, a 10-year-old could follow). Run → PASS.
- [ ] Step 3: Glossary view: sticky search, A–Z jump rail, each entry expands with a smooth height animation.
- [ ] Step 4: Commit.

### Task 4: Cards tab + card detail

**Files:**
- Create: `js/views/cards.js`, `js/views/card.js`, `js/ui/card-tile.js`, `js/lib/search.js`
- Test: `tests/search.test.mjs`

**Interfaces:**
- `searchCards(cards: Card[], {q, colors: string[], types: string[], costMin, costMax, set}): Card[]` — case/accent-insensitive name + id + trait match; null cost excluded only when a cost filter is set; sorted by name then id.
- Card tile: lazy `<img loading="lazy">` with paper-colored placeholder and fade-in; tilt-on-drag (pointer events, max 12°).
- Card detail (`#/card/<id>`): image flips in (3D), stats row (Cost/Power/Counter/Life, null → "—"), colors as chips, traits, `richText(text)`, "What this means" plain-English block for each keyword found, alt arts strip, market price + TCGplayer link.

- [ ] Step 1: Failing tests: search `q:'nami'` includes `OP11-041`; filter `types:['Event']` + cost 1–2 returns only Events cost 1–2; card with `cost:null` doesn't throw under cost filter (Review Focus 4); 2,500-card search runs < 20 ms in test.
- [ ] Step 2: Run → FAIL. Implement. Run → PASS.
- [ ] Step 3: Build views: search input debounced 120 ms, filter chips (colors in their game colors), results grid 3 columns, rendered 60 at a time with IntersectionObserver "load more" (Review Focus 5).
- [ ] Step 4: Screenshot check at 390×844 + 360×740; commit.

### Task 5: Lesson engine (lesson view, callouts, mini-boards, quiz)

**Files:**
- Create: `js/views/learn.js` (lesson map), `js/views/lesson.js`, `js/ui/card-callout.js`, `js/ui/miniboard.js`, `js/ui/quiz.js`, `js/ui/fx.js` (confetti, stamp, shake, haptics)
- Test: `tests/quiz.test.mjs`, `tests/miniboard.test.mjs`, extend `tests/content.test.mjs`

**Interfaces:**
- Lesson file `content/lessons/NN.json`: `{id: n, title, minutes, goal: string, steps: Step[], quiz: Question[3]}`.
  `Step` = `{type:'text', html}` | `{type:'card', cardId, callouts: {part:'cost'|'power'|'counter'|'life'|'color'|'effect'|'type'|'attribute'|'trigger', label}[]}` | `{type:'board', scenario, prompt, successText}` | `{type:'tip', html}`.
  `Question` = `{q, choices: string[4], answer: 0-3, why}`.
- `gradeQuiz(questions, picks: number[]): {score, total, passed: score >= 2}`.
- `miniboard.js`: `createBoard(scenario, el, onDone)`. Pure core `boardReducer(state, action)` with actions `giveDon(targetId)`, `attack(attackerId, targetId)`, `useCounter(cardId)`, `block(blockerId)`, `rest(id)`. Scenarios (fixed, defined in `js/ui/scenarios.js`): `pay-cost` (L5), `give-don` (L5), `attack-leader` (L6), `blocker` (L6), `counter` (L7), `life-trigger` (L8). Each scenario declares its goal predicate.
- Callout positions are fixed percentages of the card frame per `part` (one table for Leader layout, one for Character/Event/Stage layout).
- Lesson map (`#/learn`): first visit shows full-screen "Start Here"; otherwise a dotted sea route with 11 islands, a ship at the current lesson, completed islands stamped.
- FX: correct → ink stamp "Correct!" + `navigator.vibrate?.(15)`; wrong → shake + `why`; lesson complete → paper-scrap confetti (canvas, 1.2 s) then route back with the ship sailing to the next island. All FX no-op under reduced motion except text.

- [ ] Step 1: Failing tests: `gradeQuiz` 2/3 passes, 1/3 fails; `boardReducer` attack with 5000 vs 5000 hits (attacker wins ties); counter +2000 makes defender 7000 and attack fails; `giveDon` moves one active DON!! from cost area and adds +1000 power during your turn; resting a rested card is a no-op.
- [ ] Step 2: Run → FAIL. Implement. Run → PASS.
- [ ] Step 3: Content test extension: every lesson has exactly 3 questions with 4 choices and valid `answer`; every `cardId` in lessons exists in `data/cards.json`; every `scenario` exists.
- [ ] Step 4: Build a throwaway `content/lessons/01.json` placeholder to exercise the UI end to end; screenshot; commit.

### Task 6: Lesson content (all 11) — rules-accurate

**Files:**
- Create: `content/lessons/01.json` … `11.json`, `content/SOURCES.md`

**Interfaces:** Consumes lesson format from Task 5, glossary terms from Task 3.

- [ ] Step 1: Fetch Bandai's official rule manual and Comprehensive Rules (en.onepiece-cardgame.com rules page) and record URLs + version/date in `SOURCES.md`. Key facts to confirm and use verbatim in substance: 50-card deck + 1 Leader + 10 DON!!; max 4 copies by card number; deck colors must match Leader; 5-card opening hand, one optional mulligan; Life = Leader's Life value placed face down; first player draws no card and gets 1 DON!! on turn 1, then 2 DON!! per turn; neither player can attack on their first turn... (confirm exact first-turn rule); attacker wins ties; Leader damage moves the top Life card to hand (Trigger may be activated instead); win when a Leader with 0 Life takes damage or opponent deck runs out (confirm the exact deck-out rule); DON!! given to a card gives +1000 during your turn and returns to cost area rested at Refresh; block rotation (current Standard block).
- [ ] Step 2: Write lessons 1–11 per spec section 2. Each ≤ 4 minutes reading, short sentences, one idea per step, a real card image in every lesson from 2 onward, mini-board in lessons 5–8. Lesson 10 uses a starter deck as the worked example. Lesson 11 reads `meta.json` + deck guides and recommends the easiest-difficulty guide deck.
- [ ] Step 3: `npm test` (content tests) → PASS. Read each lesson at phone size; fix anything over 4 minutes or with an unexplained term.
- [ ] Step 4: Commit.

### Task 7: Meta tab + beginner deck guides

**Files:**
- Create: `js/views/meta.js`, `js/views/deck.js`, `js/ui/charts.js` (share bars, cost curve), `content/deck-guides/<leaderId>.json` (top ~5 beginner-friendly decks from current `meta.json`)
- Test: extend `tests/content.test.mjs`

**Interfaces:**
- Guide: `{leaderId, title, difficulty: 1|2|3, summary, gamePlan: string[], keyCards: {id, why}[], howItWins, weakTo: string[], mulliganTips, sampleListSource: 'meta'}`.
- Meta view: "Updated <date>" badge; ranked list with leader art, color chips, animated share bars (grow on enter); decks with a guide get a "Beginner guide" ribbon and a difficulty rating (1–3 anchors).
- Deck view (`#/deck/<rank>`): guide (if any), decklist from the top list grouped by type with card thumbnails (tap → card detail), cost curve bar chart, counter-count total, list total price from card prices.

- [ ] Step 1: Content tests: each guide's `leaderId` exists in cards; every `keyCards[].id` exists; difficulty in 1–3.
- [ ] Step 2: Pick guide decks from current `meta.json` (choose by: in top 10, simpler effects, starter-deck-accessible), research each deck's plan from its Limitless lists + card texts, write guides. Run tests → PASS.
- [ ] Step 3: Build views; screenshot; commit.

### Task 8: PWA (manifest, icons, service worker, offline)

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `assets/icon-192.png`, `assets/icon-512.png`, `assets/icon-maskable.png` (original ship's-wheel/compass mark, generated from an SVG via Playwright screenshot)
- Modify: `index.html` (manifest link, theme-color, apple-touch-icon, SW registration)

**Interfaces:** SW cache name `deckhand-v<N>`; precache app shell + `content/**`; `data/*.json` network-first with cache fallback; card images cache-first, max 400 entries.

- [ ] Step 1: Implement. Add an "Add to Home Screen" hint on the Learn tab after Lesson 1 (iOS share-sheet instructions vs. Android install prompt via `beforeinstallprompt`).
- [ ] Step 2: Verified in Task 10's offline test. Commit.

### Task 9: GitHub Actions — daily refresh + Pages deploy

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md` (what it is, how to run locally: `npx serve .` or `python3 -m http.server`, how to update guides, the disclaimer)

**Interfaces:** Triggers: push to `main`, `schedule: cron '17 9 * * *'`, `workflow_dispatch`. Job: checkout → setup-node 22 → `npm test` → `npm run fetch-data` → commit `data/` if changed (bot identity) → upload-pages-artifact (repo root) → deploy-pages. Permissions: `contents: write, pages: write, id-token: write`.

- [ ] Step 1: Write workflow; validate YAML parses (`node -e` with a tiny parse or `python3 -c 'import yaml'` if available).
- [ ] Step 2: Commit. (Pushing/enabling Pages is done with the user in the handoff.)

### Task 10: End-to-end check + polish pass

**Files:**
- Create: `tests/e2e/smoke.mjs` (Playwright via `createRequire(import.meta.url)('playwright')`, serves repo with a tiny `node:http` static server)

- [ ] Step 1: Write the smoke test at 390×844: first visit shows "Start Here" → Lesson 1 → step through → quiz 3/3 → "Lesson complete" → map shows island 1 stamped; Cards: search "luffy" shows ≥ 1 tile, tap opens detail with TCGplayer link; Meta: ≥ 5 decks listed, tap #1 shows decklist; Glossary: search "blocker" shows entry; keyword button in card text opens sheet. Offline: after first load, `context.setOffline(true)`, reload → Learn and Lesson 1 still render (Review Focus 1). `localStorage` blocked (init script that throws) → Lesson 1 still opens (Review Focus 2).
- [ ] Step 2: Run `npm run e2e` → PASS.
- [ ] Step 3: Screenshot every screen light + dark at 390×844 and 360×740; review against Global Constraints and the "not AI-made" bar; fix issues; re-run tests.
- [ ] Step 4: Run the `superpowers:requesting-code-review` flow on the branch; address findings; commit.
