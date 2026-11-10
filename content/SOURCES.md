# Sources

Rules content in Deckhand was checked against these official documents:

- **ONE PIECE CARD GAME Comprehensive Rules**, Version 1.2.1, last updated 8/28/2026.
  https://en.onepiece-cardgame.com/pdf/rule_comprehensive.pdf
- **Introduction of the Block Number System** (Bandai, updated July 23, 2025): Standard Regulation
  from April 2026 to March 2027 allows Blocks 2 to 5; Extra Regulation allows all blocks.
  https://en.onepiece-cardgame.com/topics/013.php
- Official rules index: https://en.onepiece-cardgame.com/rules/

Data sources (refreshed daily by `scripts/fetch-data.mjs`):

- Cards, images, prices and product links: TCGplayer catalog via https://tcgcsv.com (category 68).
- Backup card data: https://optcgapi.com
- Tournament decklists (meta): TCGplayer deck feed (https://www.tcgplayer.com/content/one-piece/decks),
  with https://onepiece.limitlesstcg.com as fallback.

Key rule facts used in lessons (rule numbers from the Comprehensive Rules):

- Deck: 1 Leader, 50 cards, 10 DON!!, colors must match Leader, max 4 per card number (5-1-2).
- Setup: 5-card hand, one redraw, first player decides first; Life placed after (5-2-1-6, 5-2-1-7).
- Turn: Refresh, Draw, DON!!, Main, End; first player skips draw and gets 1 DON!! on turn 1 (6-3-1, 6-4-1).
- Nobody can battle on their first turn (6-5-6-1).
- Given DON!!: +1000 power during your turn each; return rested at Refresh (6-5-5-2, 6-2-3).
- Attack targets: Leader or rested Characters; attacker wins ties (7-1, 7-1-4-1).
- One block per battle; Counter step after Block step (7-1-2-1, 7-1-3).
- Damage: top Life card to hand, Trigger may be used instead (7-1-4-1-1-2, 10-1-5).
- Defeat: Leader takes damage at 0 Life, or 0 cards in deck (1-2-1-1).
- Up to 5 Characters; 1 Stage (3-7-6, 3-8-5).
- Online tournament decklists and win/loss records: Limitless Play API (https://play.limitlesstcg.com/api/tournaments?game=OP).
- Ban list, banned pairs and block rotation: Bandai official (https://en.onepiece-cardgame.com/rules/restriction/), stored in content/banlist.json. Update it by hand when Bandai announces a change.
- Meta context (Nov 2026 check): ShonenTCG post-ban tier list, r/OnePieceTCG.
