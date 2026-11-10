# Deckhand Phase 2 (Deck Tools) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deck builder with live rule checks and meta hints, daily price history with charts, and a progress/deck backup code — on top of the shipped Phase 1 app.

**Architecture:** Same static app (plain ES modules, hash router). New pure libs (`js/lib/deck.js`, `js/lib/decks-store.js`, `js/lib/backup.js`, `scripts/lib/prices.mjs`) carry all logic and are unit-tested in Node; views only render. Price history is written by the existing daily fetch job into per-set shards `data/prices/<SET>.json`.

**Tech Stack:** as Phase 1 (HTML/CSS/ES modules, Node 22 `node:test`, Playwright e2e).

**Spec:** `docs/superpowers/specs/2026-11-10-deckhand-design.md` (section 6, Phase 2). Phase 1 decisions: `docs/superpowers/plans/2026-11-10-deckhand-phase1-decisions.md`.

## Global Constraints

- All Phase 1 Global Constraints still apply (no runtime deps, phone-first 360–390px, no horizontal scroll, try/catch storage via `store()`, reduced motion, sea-chart design tokens, escape all third-party text, `safeUrl` for links, `safeColors` for colors).
- Deck rules (Comprehensive Rules 5-1-2): exactly 1 Leader; exactly 50 cards; only Character/Event/Stage cards; max 4 per card number; every color on a card must be on the Leader.
- Deck text format (import/export), one entry per line: `<count>x<CARD-ID>`, Leader as `1x<LEADER-ID>` first. Import also accepts `<count> <CARD-ID>`, `<count>x <CARD-ID>`, and trailing names.
- Price history keeps at most 400 daily points per card; a missing day is skipped, never invented.
- Backup code format: `DH1.` + base64url(JSON `{v:1, progress, decks, theme}`); restoring validates shape and never throws.
- After adding/removing app files run `node scripts/precache.mjs` (test enforces).

## Review Focus

1. Importing messy pasted text (blank lines, names after ids, unknown ids, Windows line endings) → valid lines import, bad lines are listed, nothing crashes. Test in Task 1.
2. A saved deck referencing a card that later disappears from `cards.json` → deck still opens, card shown as "Unknown card <id>", counts still add up. Test in Tasks 1 and 3.
3. First run of the price job (no history yet) and a source outage (prices null) → history file created / day skipped, chart says "Not enough price history yet" instead of drawing a broken line. Tests in Tasks 4 and 5.
4. Restoring a corrupted, truncated or old-version backup code → clear error message, existing data untouched. Test in Task 6.
5. Adding the 5th copy, an off-color card, a Leader or a DON!! card in the builder → the add is refused with a plain-English reason, not silently accepted. Test in Tasks 1 and 3.

---

### Task 1: Deck rules library

**Files:** Create `js/lib/deck.js`; Test `tests/deck.test.mjs`

**Interfaces:**
- `Deck = { id: string, name: string, leaderId: string|null, entries: {id, count}[], updatedAt: ISO }`
- `parseDeckText(text, cards: Map) -> { leaderId, entries, bad: {line, reason}[] }` — first Leader-type card becomes the leader; duplicates are summed.
- `formatDeckText(deck) -> string` — leader line first, then entries sorted by cost then id.
- `canAdd(deck, card, cards) -> { ok: boolean, reason?: string }` — reasons: no leader yet, is a Leader/DON!!, 4 copies already, off-color (names the color), deck already 50.
- `validateDeck(deck, cards) -> { ok, total, problems: {code: 'no-leader'|'count'|'copies'|'color'|'type'|'unknown', id?, msg}[] }`
- `metaHints(deck, meta, cards) -> string[]` — up to 4 hints: counters vs. average of meta lists for the same leader (or all lists), missing cards that appear in ≥ 2 meta lists for this leader (with typical count), cost curve heavier than typical (avg cost > meta avg + 0.7).

- [ ] Tests: round-trip format→parse; parse messy text (blank lines, `4 OP01-016 Nami`, `\r\n`, unknown id listed in `bad`, summed duplicates); `canAdd` refuses 5th copy / off-color multicolor card (Blue/Red into Red/Green) / Leader / when 50; `validateDeck` reports each problem code; unknown card id gives `unknown` problem but total still counts; `metaHints` suggests a staple present in 2+ lists. Run → FAIL. Implement. Run → PASS. Commit.

### Task 2: Saved decks store

**Files:** Create `js/lib/decks-store.js`; Test `tests/decks-store.test.mjs`

**Interfaces:** `createDecks(store)` → `{ list(): Deck[] (newest first), get(id), save(deck) -> Deck (assigns id + updatedAt), remove(id), duplicate(id) -> Deck }`; storage key `decks`; ids `d_<base36 time><rand>`; corrupt stored value → `[]`.

- [ ] Tests with an in-memory store: save/list order, update keeps id, remove, duplicate gets new id and "(copy)" name, corrupt data → empty list. RED → GREEN. Commit.

### Task 3: Decks tab + builder UI

**Files:** Create `js/views/decks.js` (`#/decks`), `js/views/build.js` (`#/build/<id>`, `#/build/new`, `#/build/from/<rank>/<listIndex>`); Modify `js/router.js` (views `decks`, `build`), `js/app.js` (5th tab "Decks", icon `anchor`), `js/views/deck.js` (button "Copy into my decks"), `css/components.css`.
Test: extend `tests/router.test.mjs`; e2e in Task 7.

- Decks list: "New deck", "Import a list" (paste box using `parseDeckText`, shows `bad` lines), each saved deck as a card with leader art, name, total/50 ring, price; actions Open / Duplicate / Delete (confirm).
- Builder: step 1 pick a Leader (searchable leader grid); step 2 add cards — search panel limited to legal colors and non-Leader types (reuses `searchCards`); tapping a result adds 1 (`canAdd` reason shown as toast on refusal, with shake); deck list grouped by type with −/+ steppers; sticky bottom bar: count "37/50" with progress ring that turns green at 50, Problems button (validateDeck), price total; sections: cost curve (`costCurve`), counters stat, meta hints, export (copy text / share via `navigator.share` when present).
- Autosave on every change (`decks-store.save`), name editable inline.

- [ ] Router test for new routes RED→GREEN. Build views. Screenshot 360/390, light/dark. Commit.

### Task 4: Price history pipeline

**Files:** Create `scripts/lib/prices.mjs`; Modify `scripts/fetch-data.mjs` (write `data/prices/<SET>.json`, read previous); Test `tests/prices.test.mjs`

**Interfaces:** shard `{ dates: 'YYYY-MM-DD'[], p: { [cardId]: (number|null)[] } }` aligned to `dates`. `appendPrices(shard|null, cards: Card[], date) -> shard` — same date replaces; cards new to the shard are left-padded with null; `null` price stored as null; trims to last 400 dates. `shardKey(cardId) -> 'OP14'` (prefix before '-').

- [ ] Tests: first run creates shard; second day appends; same day replaces; new card padded; trim at 400; null price kept as null. RED→GREEN. Wire into fetch (prices written only for set shards that have cards; failure to read old shard → start new). Run fetch-data → `data/prices/*.json` exist. Commit.

### Task 5: Price chart on card detail

**Files:** Create `js/lib/price-series.js` (pure), `js/ui/price-chart.js`; Modify `js/views/card.js`, `js/data.js` (`getPriceShard(set)`), `css/components.css`; Test `tests/price-series.test.mjs`

**Interfaces:** `priceSeries(shard, id, range: '7d'|'30d'|'all') -> {date, price}[]` (nulls dropped); `pctChange(series) -> number|null` (first→last, null when < 2 points).
Chart (dataviz rules): single sea-blue 2px line, one y-axis starting at a rounded floor, recessive grid, crosshair + tooltip on pointer/touch, range chips 7d / 30d / All, % change label colored by status token with ▲/▼ glyph (never color alone). Fewer than 2 points → "Not enough price history yet. Prices are recorded once a day."

- [ ] Tests for `priceSeries`/`pctChange` incl. empty shard, unknown id, range cut. RED→GREEN. Build chart, screenshot. Commit.

### Task 6: Backup & restore

**Files:** Create `js/lib/backup.js`; Modify `js/views/about.js` (rename section "Your progress" → "Back up and restore"); Test `tests/backup.test.mjs`

**Interfaces:** `makeBackup({progress, decks, theme}) -> string`; `readBackup(code) -> { ok: true, data } | { ok: false, error: string }` (accepts surrounding whitespace / line breaks; rejects bad prefix, bad base64, bad JSON, wrong `v`, wrong shapes). UI: "Copy backup code", "Download backup file" (`.txt`), "Restore": textarea + file picker → preview ("3 lessons, 2 decks") → confirm → writes store.

- [ ] Tests: round-trip; whitespace tolerant; truncated → error; `DH9.` → error; decks with wrong shape → error. RED→GREEN. UI. Commit.

### Task 7: E2E, precache, review

**Files:** Modify `tests/e2e/smoke.mjs`

- [ ] Add e2e steps: create deck → pick Leader → add 4 copies then 5th refused → import a meta list via "Copy into my decks" → shows 50/50; card detail shows price section; backup code copy → restore into a fresh context restores progress.
- [ ] `node scripts/precache.mjs`, `npm test`, `npm run e2e` all green; screenshots 360px both themes, no horizontal scroll.
- [ ] Final whole-branch review (fresh reviewer), fix Critical/Important, merge.
