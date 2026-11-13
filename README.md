# Deckhand

Learn the One Piece Card Game from zero, on your phone or computer. On first open, Deckhand asks which version you want (switch anytime with the button at the top).

- **Learn:** 12 short lessons with practice boards and a 3-question check after each one.
- **Cards:** every card with its picture, effect in plain English, and TCGplayer price.
- **Meta:** the decks winning tournaments right now, with beginner guides for five of them.
- **Glossary:** every game word explained. Tap any underlined word in the app to see it.

Deckhand is an unofficial fan-made learning tool. It is not affiliated with or endorsed by Bandai,
Eiichiro Oda, Shueisha, Toei Animation or TCGplayer. Card names, text and images belong to their owners.

## Run it on your computer

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm run serve
```

Then open http://localhost:8080.

## Put it online (free, with GitHub Pages)

1. Create a new repository on GitHub and push this folder to its `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Open the **Actions** tab and run **Refresh data and deploy** (or push any commit).

The site address appears on the workflow run, usually `https://<your-name>.github.io/<repo-name>/`.
After that, the workflow refreshes card prices and tournament decks every day at 09:17 UTC.

## Where the data comes from

| What | Source | Refreshed |
|---|---|---|
| Cards, images, prices, product links | TCGplayer catalog via [tcgcsv.com](https://tcgcsv.com) | daily |
| Backup card data | [optcgapi.com](https://optcgapi.com) | daily |
| Tournament decklists | TCGplayer deck feed, with [Limitless](https://onepiece.limitlesstcg.com) as backup | daily |
| Rules | Bandai Comprehensive Rules v1.2.1 (see `content/SOURCES.md`) | by hand |

If a source is down, the previous day's data is kept and the app shows when it was last updated.

## Editing content

| To change | Edit | Then run |
|---|---|---|
| Lessons | `scripts/make-lessons.py` | `python3 scripts/make-lessons.py` |
| Glossary | `content/glossary.json` | nothing |
| Deck guides | `content/deck-guides/<LEADER-ID>.json` | nothing |
| Practice boards | `js/lib/scenarios.js` | nothing |

After adding or removing any file under `js/`, `css/`, `content/` or `assets/`, run
`node scripts/precache.mjs` so the offline copy includes it. `npm test` checks every lesson,
glossary entry, guide and board, and fails if the offline list is out of date.

## Tests

```bash
npm test        # rules engine, parsers, search, content checks
npm run e2e     # opens the app in a headless phone-sized browser
```
