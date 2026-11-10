# Deckhand — One Piece TCG Learning App: Design Spec

Date: 2026-11-10 · Status: awaiting user review

## 1. Purpose

Teach someone with **zero knowledge** of the One Piece Card Game (Bandai) to play it,
then point them at a current, beginner-friendly deck. Success = a total beginner can
finish the lessons, pass the quizzes, and understand a real decklist from the current meta.

**User said:** phone-first, step-by-step lessons first, use TCGplayer data where possible
(multiple sources OK), accurate to current meta, looks hand-crafted (not "AI made"),
lots of polish and animation, hosted on GitHub Pages.

**Assumptions (mine):** English only; no accounts; unofficial fan project with a disclaimer;
no One Piece logos or official branding (card images are shown only as card art).

## 2. Screens (bottom tab bar)

1. **Learn** — first open shows one big "Start Here" button → Lesson 1. 11 lessons, 2–4 min each,
   each ending in a 3-question quiz. Progress saved in `localStorage` (wrapped in try/catch).
   Lessons: 1 What the game is · 2 Card types (Leader, Character, Event, Stage, DON!!) ·
   3 Game setup · 4 Turn phases (Refresh, Draw, DON!!, Main, End) · 5 DON!! and costs ·
   6 Attacking & blocking · 7 Counters · 8 Life & Triggers · 9 Keywords ·
   10 Deck building rules · 11 Your first deck (links to Meta).
   Lessons use real card images with callout arrows (cost, power, counter, effect) and
   **interactive mini-boards** (tap DON!! to attach, tap to attack, resolve a counter).
2. **Cards** — search all cards by name; filter by color, type, cost, set. Tap → full card
   view with flip-in animation, stats, effect text where every keyword (e.g. [Rush],
   [Blocker], [On Play]) is tappable for a plain-English explanation, TCGplayer market price,
   and a "View on TCGplayer" link (TCGplayer search URL for the card ID).
3. **Meta** — top decks from recent tournaments (leader, color, share/placements), refreshed
   daily. Top ~5 beginner-friendly decks get hand-written guides: game plan, key cards,
   how it wins, what beats it, difficulty rating.
4. **Glossary** — every game term in 1–2 sentences; the same data powers tap-to-define
   everywhere in the app.

Rules content is checked against Bandai's official rule documents (Comprehensive Rules /
rule manual) while writing.

## 3. Visual direction

Original "ship's logbook" look, not a generic template:
- Aged-paper surfaces, ink-black type, a strong red accent, brass/gold details; dark mode is
  "night at sea" (deep navy, lantern-gold accents).
- Display type: a characterful serif for headings; clean sans for body. Large tap targets.
- No purple gradients, no glassmorphism, no emoji-as-icons; hand-drawn-style SVG icons
  (compass, map, spyglass, scroll).

Motion (all disabled/reduced under `prefers-reduced-motion`):
- Page transitions slide like turning logbook pages.
- Cards: 3D flip on open, tilt on drag, DON!! cards rotate 90° when "rested".
- Quiz: correct answer gets an ink-stamp animation; wrong answer gives a short shake + the
  explanation. Phone vibration on answers where supported.
- Lesson progress is a ship sailing along a dotted route map.
- Lesson complete: confetti of tiny paper scraps.

## 4. Architecture

- Static site: plain HTML/CSS/JS (ES modules), no framework, no runtime dependencies.
  Installable via web app manifest + service worker (offline lessons & cached data).
- `scripts/fetch-data.mjs` (Node, no deps) builds `data/cards.json` (from optcgapi.com:
  id, name, set, color, type, cost, power, counter, life, attribute, subtypes, effect text,
  image URL, TCGplayer market price) and `data/meta.json` (from onepiece.limitlesstcg.com
  tournament pages: top leaders/decks + sample decklists). Writes `data/updated.json`.
- If a source fails, the script keeps the previous file and exits successfully, and the app
  shows "Updated <date>".
- Content lives in `content/lessons/*.json`, `content/glossary.json`,
  `content/deck-guides/*.json` — written by hand, versioned in git.
- GitHub Actions: daily scheduled job runs the fetch script, commits changed data, deploys
  to GitHub Pages. Also deploys on every push to `main`.

## 5. Testing

- Node test script: every lesson/quiz/glossary/guide JSON validates against its expected
  shape; every card ID referenced in lessons and guides exists in `cards.json`; every
  keyword in the glossary resolves.
- Playwright smoke test at phone size: each tab loads, Lesson 1 → quiz → complete works,
  card search returns results, card detail opens.
- Manual screenshot review of every screen in light and dark mode before handoff.

## 6. Full scope — built in three phases, in order

User asked for everything. It is built in phases so each one is usable before the next starts.

**Phase 1 — Core:** everything in sections 2–5.

**Phase 2 — Deck tools:**
- **Deck builder:** pick a Leader, add cards with live rule checks (exactly 50 cards, max 4
  copies per card ID, cards must match the Leader's colors), cost curve + counter-count charts,
  "how this compares to meta lists" hints, total TCGplayer price, import/export in the
  standard text format used by Limitless and online simulators, save multiple decks.
- **Price history:** the daily job appends each card's market price to compact history files;
  card view shows a price chart (7d / 30d / all) and % change. Meta tab shows deck cost.
- **Progress backup:** no server on GitHub Pages, so "accounts" become a backup code /
  file you can export and import on another phone. Saves lessons, quizzes, and decks.

**Phase 3 — Practice game vs. the computer:**
- A playable match on your phone with a real board: Leader, Life, DON!! deck, hand,
  Character area, trash. Drag or tap to play, attach DON!!, attack, block, counter.
- **Coach mode** (on by default): explains what each phase does, why a move is good or bad,
  and suggests a move when you're stuck. Can be turned off.
- Computer opponent with 3 difficulties (Easy = random legal moves, Normal = rule-based
  heuristics, Hard = looks a turn ahead).
- Card effects are coded by hand, so the simulator supports a **curated pool**: the official
  starter decks most beginners buy plus the beginner meta decks from the guides. Every
  supported card's effect is tested. Unsupported cards are clearly marked in the deck builder.
- Rules engine follows the official Comprehensive Rules (turn structure, first-player
  restrictions, DON!! rules, damage/Life/Trigger, blocker/counter windows, win conditions).

**Language:** English for now; all text lives in content files so translations can be added later.
