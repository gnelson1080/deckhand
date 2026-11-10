# Source of truth for content/lessons/*.json. Edit here, then run: python3 scripts/make-lessons.py
import json, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'content', 'lessons')

def T(html): return {"type": "text", "html": html}
def TIP(html): return {"type": "tip", "html": html}
def CARD(cid, callouts, html=None):
    d = {"type": "card", "cardId": cid, "callouts": [{"part": p, "label": l} for p, l in callouts]}
    if html: d["html"] = html
    return d
def BOARD(s, html=None):
    d = {"type": "board", "scenario": s}
    if html: d["html"] = html
    return d
def Q(q, choices, answer, why): return {"q": q, "choices": choices, "answer": answer, "why": why}

L = []

L.append(dict(id=1, title="What is the One Piece Card Game?", minutes=2,
  goal="Learn what you're trying to do in a game, and what you need to play.",
  steps=[
    T("<p>The One Piece Card Game is a battle between <strong>two pirate captains</strong>. You are one of them.</p><p>Your captain is a card called your <kw>Leader</kw>. You build a crew of <kw term=\"Character\">Characters</kw>, attack your opponent's Leader, and protect your own.</p>"),
    T("<p><strong>How you win:</strong></p><ul><li>Every Leader starts with a few face-down <kw>Life</kw> cards. Each time you hit your opponent's Leader, they lose 1 Life.</li><li>When they have <strong>0 Life</strong> and you hit their Leader <strong>one more time</strong>, you win.</li><li>You also win if your opponent's <kw>Deck</kw> runs out of cards.</li></ul>"),
    T("<p><strong>What each player brings:</strong></p><ul><li><strong>1 Leader</strong> card.</li><li>A <strong>50-card deck</strong> of Characters, Events and Stages.</li><li><strong>10 <kw>DON!!</kw> cards.</strong> DON!! are your energy. You spend them to play cards.</li></ul>"),
    TIP("<p>A game usually takes 20 to 30 minutes. Don't worry about memorizing anything yet. Every underlined word in Deckhand can be tapped to see what it means.</p>"),
  ],
  quiz=[
    Q("Your opponent has 0 Life cards left. What happens when you hit their Leader once more?", ["They draw a card", "You win the game", "They get 1 Life back", "Nothing, Leaders can't be hit at 0 Life"], 1, "At 0 Life, the next hit on the Leader ends the game."),
    Q("How many cards are in your main deck?", ["40", "50", "60", "Any number"], 1, "A deck is exactly 50 cards. Your Leader and your 10 DON!! are kept separate."),
    Q("What are DON!! cards for?", ["They are your Life", "They are your energy for playing cards", "They are extra Leaders", "They are only used in tournaments"], 1, "You spend DON!! to pay for cards, and you can attach them to cards to make them stronger."),
  ]))

L.append(dict(id=2, title="The five kinds of cards", minutes=4,
  goal="Recognize Leaders, Characters, Events, Stages and DON!! at a glance.",
  steps=[
    CARD("OP13-001", [("power", "Power: how strong it is in a fight (5000)."), ("life", "Life: you start the game with this many Life cards (4)."), ("color", "Color: your deck may only use these colors (green and red)."), ("effect", "Effect: a special ability. Leaders have one that works all game.")],
      "<p>This is a <kw>Leader</kw>. You have exactly one, and it stays on the table all game. Tap the numbered pins.</p>"),
    CARD("ST31-002", [("cost", "Cost: rest this many DON!! to play it (5)."), ("power", "Power: its strength in battle (6000)."), ("counter", "Counter: trash it from your hand while defending to add +1000 power."), ("effect", "Effect: Jinbe has [Blocker]. Tap it to see what that means."), ("type", "Type: the groups he belongs to (Fish-Man and Straw Hat Crew)."), ("color", "Color: red.")],
      "<p>This is a <kw>Character</kw>, the most common kind of card. Characters are your crew: they attack, block and protect.</p>"),
    CARD("OP13-039", [("cost", "Cost: 2 DON!!."), ("effect", "[Counter]: you can use it while your opponent attacks you."), ("trigger", "[Trigger]: a free effect if this card is flipped from your Life.")],
      "<p>This is an <kw>Event</kw>. You pay its cost, do what it says once, then it goes to your <kw>Trash</kw>.</p>"),
    CARD("OP13-022", [("cost", "Cost: 1 DON!!."), ("effect", "Effect: works again and again while the Stage stays on the table.")],
      "<p>This is a <kw>Stage</kw>, a place that gives you a lasting bonus. You can only have 1 Stage at a time. Stages can't attack and can't be attacked.</p>"),
    T("<p>And then there's <kw>DON!!</kw>. DON!! cards aren't in your deck. You get new ones every turn and use them to pay costs or to power up your cards.</p><p>Quick sort:</p><ul><li><strong>Leader:</strong> you, the captain. 1 per deck.</li><li><strong>Character:</strong> crew that stays and fights.</li><li><strong>Event:</strong> a one-time move.</li><li><strong>Stage:</strong> a place with a lasting bonus.</li><li><strong>DON!!:</strong> energy.</li></ul>"),
  ],
  quiz=[
    Q("Which card type goes to the trash right after you use it?", ["Character", "Stage", "Event", "Leader"], 2, "Events are one-time effects. Pay, resolve, trash."),
    Q("Where do you find how many DON!! a Character costs?", ["Top-left corner", "Bottom-right corner", "On the back", "In the effect text"], 0, "The cost is the big number in the top-left corner."),
    Q("What does the number in a Leader's Life spot tell you?", ["How much it costs", "How many Life cards you start with", "How many times it can attack", "How many Characters you can have"], 1, "You start the game with that many face-down Life cards."),
  ]))

L.append(dict(id=3, title="Setting up a game", minutes=3,
  goal="Get both sides of the table ready, step by step.",
  steps=[
    T("<p>Before the first turn, each player does this, in order:</p><ol><li>Shuffle your 50-card deck and put it face down.</li><li>Put your <kw>Leader</kw> face up in front of you.</li><li>Put your 10 <kw>DON!!</kw> cards to the side. This is your <kw>DON!! deck</kw>.</li><li>Play rock-paper-scissors. The winner chooses to go first or second.</li></ol>"),
    T("<p>Next, the opening hand:</p><ol start=\"5\"><li>Draw 5 cards.</li><li>If you don't like them, you may do one <kw>Mulligan</kw>: shuffle all 5 back and draw 5 new cards. The player going first decides first. You must keep the second hand.</li></ol>"),
    T("<p>Last, your Life:</p><ol start=\"7\"><li>Take cards from the top of your deck equal to your Leader's Life number and place them <strong>face down</strong> as your <kw>Life</kw>. Don't look at them.</li></ol><p>Now the first player starts their turn.</p>"),
    TIP("<p><strong>Going first or second?</strong> Going first lets you set up sooner, but on your very first turn you don't draw a card and you only get 1 DON!!. Many players still choose to go first.</p>"),
  ],
  quiz=[
    Q("How many cards are in your opening hand?", ["4", "5", "6", "7"], 1, "Everyone draws 5 to start."),
    Q("What do you do with your Life cards?", ["Look at them, then place them face up", "Place them face down without looking", "Shuffle them into your hand", "Put them in the trash"], 1, "Life cards go face down, unseen, from the top of your deck."),
    Q("How many times can you mulligan (redraw) your opening hand?", ["Never", "Once", "Twice", "As many times as you want"], 1, "You get one redraw, and you must keep the new hand."),
  ]))

L.append(dict(id=4, title="The five steps of a turn", minutes=3,
  goal="Know what happens, in order, every time it's your turn.",
  steps=[
    T("<p>Every turn has the same five steps:</p><ol><li><kw>Refresh Phase</kw>: take back DON!! you attached to cards, then stand all your sideways cards back up.</li><li><kw>Draw Phase</kw>: draw 1 card.</li><li><kw>DON!! Phase</kw>: take 2 new DON!! from your DON!! deck.</li><li><kw>Main Phase</kw>: play cards, attach DON!!, use effects and attack.</li><li><kw>End Phase</kw>: end-of-turn effects happen, then it's your opponent's turn.</li></ol>"),
    T("<p><strong>The first turn is special.</strong></p><ul><li>The player going first <strong>doesn't draw</strong> on their first turn.</li><li>The player going first gets only <strong>1 DON!!</strong> on their first turn.</li><li><strong>Nobody can attack</strong> on their own first turn.</li></ul>"),
    T("<p>Your DON!! grow each turn: 1 or 2 on your first turn, then +2 every turn until you have all 10. That's why cheap cards come out early and big cards come out later.</p>"),
    TIP("<p>The Main Phase is where almost everything happens. You can do things in any order and as many times as you can afford, so plan your DON!! before you spend them.</p>"),
  ],
  quiz=[
    Q("Which step comes right after the Draw Phase?", ["Main Phase", "DON!! Phase", "Refresh Phase", "End Phase"], 1, "Refresh, Draw, DON!!, Main, End."),
    Q("How many new DON!! do you normally get each turn?", ["1", "2", "3", "All 10"], 1, "2 per turn. The first player gets only 1 on their very first turn."),
    Q("Can you attack on your very first turn?", ["Yes, with your Leader", "Yes, if you go second", "No, nobody can attack on their first turn", "Only with Events"], 2, "Neither player can attack on their own first turn."),
  ]))

L.append(dict(id=5, title="DON!! and paying costs", minutes=4,
  goal="Spend DON!! to play cards, and give DON!! to make your cards stronger.",
  steps=[
    T("<p>DON!! you've received sit in your <kw>Cost area</kw>. Upright DON!! are <kw>Active</kw>, ready to use. To pay a cost, you turn that many DON!! sideways. Now they're <kw>Rested</kw> until your next turn.</p>"),
    BOARD("pay-cost"),
    T("<p>DON!! have a second use. During your Main Phase you can <kw term=\"Give DON!!\">give</kw> an active DON!! to your Leader or a Character by tucking it under the card.</p><ul><li>Each given DON!! is worth <strong>+1000 power during your turn</strong>.</li><li>At the start of your next turn, given DON!! come back to your cost area.</li></ul>"),
    BOARD("give-don"),
    T("<p>Two DON!! words you'll see on cards:</p><ul><li><kw term=\"DON!! xN\">[DON!! x1]</kw>: this effect only works while the card has at least 1 DON!! given to it.</li><li><kw term=\"DON!! −N\">DON!! −1</kw>: to use this effect, return 1 DON!! from your table to your DON!! deck.</li></ul>"),
  ],
  quiz=[
    Q("A Character costs 4. How do you play it?", ["Trash 4 cards from your hand", "Rest 4 active DON!!", "Return 4 DON!! to your DON!! deck", "Rest your Leader"], 1, "Paying a cost means resting that many active DON!!."),
    Q("Your Leader has 5000 power and 2 DON!! given to it. What is its power during your turn?", ["5000", "6000", "7000", "10000"], 2, "Each given DON!! adds +1000 during your turn: 5000 + 2000 = 7000."),
    Q("What does [DON!! x1] on a card mean?", ["It costs 1 DON!!", "The effect works while it has 1 or more DON!! given", "It gives you 1 DON!!", "It can attack once"], 1, "It's a condition: give the card at least 1 DON!! to turn the effect on."),
  ]))

L.append(dict(id=6, title="Attacking and blocking", minutes=4,
  goal="Make an attack, and know how a defender can block it.",
  steps=[
    T("<p>To <kw>Attack</kw>, turn one of your active cards sideways: your Leader or a Character. Then pick a target:</p><ul><li>your opponent's <strong>Leader</strong>, or</li><li>one of their <strong>rested</strong> (sideways) Characters.</li></ul><p>Upright Characters can't be attacked. And a Character can't attack on the turn it was played unless it has <kw>Rush</kw>.</p>"),
    T("<p>Then compare <kw>Power</kw>. If the attacker's power is <strong>equal or higher</strong>, the attacker wins.</p><ul><li>Beat a Leader: it takes 1 <kw>Damage</kw> (loses 1 Life).</li><li>Beat a Character: it's <kw term=\"K.O.\">K.O.'d</kw> and goes to the trash.</li></ul>"),
    BOARD("attack-leader"),
    T("<p>Defenders get a chance to respond. If they have an active Character with <kw>Blocker</kw>, they can rest it to make it the new target. You can block only once per attack.</p>"),
    BOARD("blocker"),
    TIP("<p>Attacking with a Character leaves it sideways during your opponent's turn, so it can be attacked back. Think about that before you swing.</p>"),
  ],
  quiz=[
    Q("Your 5000 Character attacks a 5000 Leader. Who wins?", ["The defender", "The attacker", "Nobody", "Both lose"], 1, "Ties go to the attacker."),
    Q("Which of your opponent's Characters can you attack?", ["Any of them", "Only upright ones", "Only rested (sideways) ones", "None, only the Leader"], 2, "Only rested Characters can be attacked."),
    Q("What does [Blocker] let a card do?", ["Attack twice", "Become the new target of an attack", "Stop all damage this turn", "Return to hand"], 1, "A Blocker rests to take the attack in place of another card."),
  ]))

L.append(dict(id=7, title="Counters: defending from your hand", minutes=3,
  goal="Use Counter cards from your hand to survive attacks.",
  steps=[
    T("<p>After the block step, the defender can use <kw term=\"Counter\">Counters</kw>. Look at the side of your Character cards: many show <strong>+1000</strong> or <strong>+2000</strong>.</p><p>While you're being attacked, you can trash those cards from your hand to add their power to the card being attacked, for this battle only. You can use as many as you want.</p>"),
    CARD("OP13-011", [("counter", "Counter +2000: trash this from your hand while defending to add 2000 power.")]),
    T("<p>Events with <kw>Counter</kw> in brackets work at the same moment. You pay their DON!! cost, then use their effect.</p><p>Remember the tie rule: if your defender ends up <strong>equal</strong> to the attacker, the attacker still wins. You need to go higher.</p>"),
    BOARD("counter"),
    TIP("<p>Your hand is your shield. Every Counter you use is a card you can't play later, so don't spend counters to save 1 Life early in the game unless it really matters.</p>"),
  ],
  quiz=[
    Q("Your 5000 Leader is attacked by a 7000 Character. Which Counters save you?", ["One +2000", "One +1000", "+2000 and +1000 together", "None can"], 2, "You need 8000. 5000 + 2000 would only tie, and ties go to the attacker."),
    Q("When can you use a Character's Counter value?", ["On your turn", "While you're being attacked", "Only during setup", "Any time"], 1, "Counters are used during your opponent's attack, after blockers."),
    Q("What happens to a Character card you use as a Counter?", ["It goes back on top of your deck", "It goes into play", "It goes to your trash", "It becomes a Life card"], 2, "You trash it from your hand to add its power."),
  ]))

L.append(dict(id=8, title="Life, damage and Triggers", minutes=3,
  goal="Know what happens when your Leader gets hit, and how the game ends.",
  steps=[
    T("<p>When your Leader takes damage, move your top <kw>Life</kw> card into your <strong>hand</strong>. Getting hit hurts, but it also gives you a card. Some players save their Counters early and let a few hits through.</p>"),
    T("<p>Some cards have <kw>Trigger</kw>. If that card is the Life card you take, you can show it and use its Trigger effect for free instead of putting it in your hand.</p>"),
    CARD("OP13-106", [("trigger", "[Trigger] Play this card: if this flips from your Life, it comes into play for free.")]),
    BOARD("life-trigger"),
    T("<p>Two attack keywords change damage:</p><ul><li><kw>Double Attack</kw>: deals 2 damage instead of 1.</li><li><kw>Banish</kw>: the Life card goes to the trash. No card in hand, no Trigger.</li></ul><p><strong>How a game ends:</strong> a Leader with 0 Life takes damage, or a player has 0 cards left in their deck.</p>"),
  ],
  quiz=[
    Q("Your Leader takes 1 damage. Where does your top Life card go?", ["Into your hand", "Into your trash", "Back on your deck", "To your opponent"], 0, "Life cards go to your hand, unless you use a Trigger or it was Banished."),
    Q("Your Life card has [Trigger]. What can you do?", ["Nothing special", "Use its Trigger effect instead of adding it to your hand", "Play it as a second Leader", "Attack immediately"], 1, "A Trigger is a free effect you may use, or you can just add the card to your hand."),
    Q("Which of these makes you lose?", ["Having 0 cards in hand", "Having 0 cards in your deck", "Having 0 DON!!", "Having no Characters"], 1, "If your deck reaches 0 cards, you lose."),
  ]))

L.append(dict(id=9, title="Keywords you'll see everywhere", minutes=4,
  goal="Read card effects quickly by learning the common bracket words.",
  steps=[
    T("<p>Words in [square brackets] are keywords. Here are the ones that tell you <strong>when</strong> something happens:</p><ul><li><kw>On Play</kw>: when you play the card.</li><li><kw>When Attacking</kw>: each time it attacks.</li><li><kw>On K.O.</kw>: when it gets K.O.'d.</li><li><kw>On Block</kw>: when it blocks.</li><li><kw>Activate: Main</kw>: an ability you choose to use in your Main Phase.</li><li><kw>End of Your Turn</kw>: during your End Phase.</li></ul>"),
    T("<p>These ones are <strong>conditions</strong>:</p><ul><li><kw>Your Turn</kw> / <kw>Opponent's Turn</kw>: only works during that turn.</li><li><kw>Once Per Turn</kw>: can be used only once each turn.</li><li><kw term=\"DON!! xN\">[DON!! x2]</kw>: only works with 2 or more DON!! given.</li></ul>"),
    T("<p>And these are <strong>abilities</strong>:</p><ul><li><kw>Rush</kw>: can attack the turn it's played.</li><li><kw>Blocker</kw>: can take an attack for another card.</li><li><kw>Double Attack</kw>, <kw>Banish</kw>, <kw>Unblockable</kw>: make attacks hurt more.</li></ul>"),
    CARD("ST31-001", [("effect", "[DON!! x2]: give Sanji 2 DON!! and he gains [Rush], so he can attack right away.")],
      "<p>Put it together. Tap the pin:</p>"),
    TIP("<p>When a card does something you didn't expect, the card wins: card text overrides the general rules.</p>"),
  ],
  quiz=[
    Q("A Character has [On Play] Draw 1 card. When do you draw?", ["Every turn", "When it attacks", "When you play it", "When it is K.O.'d"], 2, "On Play happens once, right when the card is played."),
    Q("What does [Once Per Turn] mean?", ["You must use it every turn", "It can be used only one time each turn", "It works only on your first turn", "It costs 1 DON!!"], 1, "It limits how often the effect can be used."),
    Q("Which keyword lets a Character attack on the turn it's played?", ["Blocker", "Banish", "Rush", "Trigger"], 2, "Rush removes the usual wait of one turn."),
  ]))

L.append(dict(id=10, title="Building your first deck", minutes=4,
  goal="Know the deck-building rules and what a healthy deck looks like.",
  steps=[
    T("<p><strong>The rules for a legal deck:</strong></p><ul><li>Exactly <strong>1 Leader</strong>.</li><li>Exactly <strong>50 cards</strong> in the deck (Characters, Events, Stages).</li><li>Every card must match a <kw>Color</kw> on your Leader.</li><li>At most <strong>4 copies</strong> of the same <kw>Card number</kw>.</li><li>Plus <strong>10 DON!!</strong>.</li></ul>"),
    T("<p><strong>Which cards are allowed in tournaments?</strong> Most events use the <kw>Standard format</kw>. Each card has a block number printed in its lower-right corner. From April 2026 to March 2027, Standard allows <strong>Blocks 2 to 5</strong>. Block 1 cards (the oldest ones) are not allowed. Each spring the oldest block rotates out (<kw>Block rotation</kw>).</p>"),
    T("<p><strong>What a healthy deck usually has:</strong></p><ul><li>A spread of costs: plenty of 1 to 5 cost cards, a few big 6+ cost finishers.</li><li>Lots of Counter cards. Most good decks have around 15 to 20 cards with +1000 or +2000 Counters, so your hand can defend you.</li><li>4 copies of the cards your Leader wants most, so you find them every game.</li></ul>"),
    TIP("<p>The easiest start is a <strong>starter deck</strong>: a ready-to-play 50-card deck with a Leader. Play it a few times, then swap in cards one at a time. Check the Cards tab to see what each card does and what it costs on TCGplayer.</p>"),
  ],
  quiz=[
    Q("Your Leader is red and green. Can you put a blue card in your deck?", ["Yes, up to 4", "Yes, but only 1", "No, cards must match your Leader's colors", "Only if it's an Event"], 2, "Every card must share a color with your Leader."),
    Q("How many copies of the same card number can a deck have?", ["2", "3", "4", "Unlimited"], 2, "Up to 4 copies of each card number."),
    Q("Why do good decks run many Counter cards?", ["They are cheaper", "They let your hand defend against attacks", "They draw extra cards", "They are required by the rules"], 1, "Counters in hand are how you survive your opponent's turn."),
  ]))

L.append(dict(id=11, title="Picking your first deck", minutes=3,
  goal="Choose a deck that's fun, strong right now, and easy to learn.",
  steps=[
    T("<p>You know the rules. Now pick a ship. Three good ways to choose:</p><ol><li><strong>A starter deck</strong> in the color you like. Cheap, complete and easy to upgrade.</li><li><strong>A beginner-friendly meta deck.</strong> These are decks winning tournaments right now that are also simple to play.</li><li><strong>Your favorite character.</strong> You'll play more if you love your Leader.</li></ol>"),
    {"type": "deckpick"},
    T("<p>Before you buy:</p><ul><li>Check the deck's guide in the <strong>Meta</strong> tab: game plan, key cards, what beats it.</li><li>Check prices: every card links to TCGplayer.</li><li>Play some games, even against a friend with a starter deck. You'll learn faster by playing than by reading.</li></ul>"),
    TIP("<p>Strong decks change every few months when new sets come out. Deckhand updates its tournament data every day, so come back to the Meta tab to see what's winning.</p>"),
  ],
  quiz=[
    Q("What's a good first deck for someone brand new?", ["The most expensive deck", "A starter deck or a beginner-friendly meta deck", "A random pile of 50 cards", "A deck with no Leader"], 1, "Starter decks and simple meta decks are the easiest way in."),
    Q("Where in Deckhand can you see which decks are winning tournaments now?", ["Glossary tab", "Meta tab", "Learn tab", "Nowhere"], 1, "The Meta tab updates daily from recent tournament results."),
    Q("Why might the best decks change?", ["New sets add new cards every few months", "The rules change every week", "Decks wear out", "They never change"], 0, "New sets, and the yearly block rotation, change what's strong."),
  ]))

os.makedirs(OUT, exist_ok=True)
for l in L:
    json.dump(l, open(f"{OUT}/{l['id']:02d}.json", 'w'), indent=1, ensure_ascii=False)
json.dump([{"id": l['id'], "title": l['title'], "minutes": l['minutes']} for l in L], open(f"{OUT}/index.json", 'w'), indent=1, ensure_ascii=False)
print('wrote', len(L))
