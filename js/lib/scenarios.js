// Practice boards used inside lessons. `art` is a real card number for the picture;
// stats are set here so each puzzle teaches exactly one rule.
import { makeBoard, boardReducer, powerOf } from './board.js';

const luffyL = { id: 'me-L', art: 'ST01-001', name: 'Luffy', power: 5000 };
const kidL = { id: 'op-L', art: 'ST02-001', name: 'Kid', power: 5000 };

export const SCENARIOS = {
  'pay-cost': {
    title: 'Play a Character',
    prompt: 'Jinbe costs 3. You have 3 active DON!!. Tap Jinbe in your hand to play him.',
    success: 'Jinbe is on the table. See how 3 DON!! turned sideways? They are spent for this turn.',
    board: { me: { leader: luffyL, don: 3, life: 5, hand: [{ id: 'jinbe', art: 'ST01-005', name: 'Jinbe', cost: 3, power: 5000 }] }, opp: { leader: kidL, life: 5 } },
    solution: [{ type: 'play', card: 'jinbe' }],
    goal: s => s.me.chars.some(c => c.id === 'jinbe'),
  },
  'give-don': {
    title: 'Power up with DON!!',
    prompt: 'Your Luffy has 5000 power. Get him to 7000 by giving him DON!!: tap a DON!!, then tap Luffy. Do it twice.',
    success: 'Luffy is at 7000. Each DON!! you give adds +1000 during your turn, and it comes back at the start of your next turn.',
    board: { me: { leader: luffyL, don: 2, life: 5 }, opp: { leader: kidL, life: 5 } },
    solution: [{ type: 'giveDon', target: 'me-L' }, { type: 'giveDon', target: 'me-L' }],
    goal: s => powerOf(s, 'me', 'me-L') >= 7000,
  },
  'attack-leader': {
    title: 'Attack the Leader',
    prompt: 'Tap your Zoro, then tap Kid (their Leader). Zoro has 5000 and Kid has 5000. Who wins a tie?',
    success: 'Hit! The attacker wins ties. Kid lost 1 Life, and that Life card went into their hand.',
    board: { me: { leader: luffyL, life: 5, chars: [{ id: 'zoro', art: 'ST01-013', name: 'Zoro', power: 5000 }] }, opp: { leader: kidL, life: 3 } },
    solution: [{ type: 'attack', attacker: 'zoro', target: 'op-L' }, { type: 'resolve' }],
    goal: s => s.opp.life === 2,
  },
  blocker: {
    title: 'Block an attack',
    prompt: 'Hawkins (6000) attacks your Leader! Chopper has [Blocker]. Tap Chopper to block, then tap Finish battle.',
    success: 'Chopper took the hit instead. He was K.O.\'d, but your Leader kept all of its Life.',
    board: { turn: 'opp', me: { leader: luffyL, life: 4, chars: [{ id: 'chopper', art: 'ST01-006', name: 'Chopper', power: 1000, blocker: true }] },
      opp: { leader: kidL, life: 5, chars: [{ id: 'hawkins', art: 'ST02-010', name: 'Hawkins', power: 6000 }] } },
    auto: [{ type: 'attack', attacker: 'hawkins', target: 'me-L' }],
    solution: [{ type: 'block', blocker: 'chopper' }, { type: 'resolve' }],
    goal: s => !s.battle && s.me.life === 4 && s.log.some(l => l.t === 'result'),
  },
  counter: {
    title: 'Counter from your hand',
    prompt: 'Hawkins attacks your Leader with 7000. Luffy has 5000. Tap cards in your hand to add their Counter power, then tap Finish battle. Careful: ties go to the attacker.',
    success: 'Blocked by power! 8000 beats 7000. You spent 2 cards from your hand, but kept your Life.',
    board: { turn: 'opp', me: { leader: luffyL, life: 4, hand: [{ id: 'vivi', art: 'ST01-009', name: 'Vivi', cost: 2, power: 4000, counter: 1000 }, { id: 'brook', art: 'ST01-011', name: 'Brook', cost: 2, power: 3000, counter: 2000 }] },
      opp: { leader: kidL, life: 5, chars: [{ id: 'hawkins', art: 'ST02-010', name: 'Hawkins', power: 6000, don: 1 }] } },
    auto: [{ type: 'attack', attacker: 'hawkins', target: 'me-L' }],
    solution: [{ type: 'useCounter', card: 'vivi' }, { type: 'useCounter', card: 'brook' }, { type: 'resolve' }],
    goal: s => !s.battle && s.me.life === 4 && s.log.some(l => l.t === 'result'),
  },
  'life-trigger': {
    title: 'Take damage, flip a Trigger',
    prompt: 'You can\'t stop this 7000 attack. Tap Finish battle and take the hit. Then look at the Life card you get.',
    success: 'Carrot had [Trigger] Play this card, so taking damage put a free Character on your side. Losing Life isn\'t all bad.',
    board: { turn: 'opp', me: { leader: luffyL, life: 2, lifeCards: [{ id: 'carrot', art: 'OP01-009', name: 'Carrot', cost: 2, power: 3000, counter: 1000, trigger: 'play' }] },
      opp: { leader: kidL, life: 5, chars: [{ id: 'hawkins', art: 'ST02-010', name: 'Hawkins', power: 6000, don: 1 }] } },
    auto: [{ type: 'attack', attacker: 'hawkins', target: 'me-L' }],
    solution: [{ type: 'resolve' }, { type: 'useTrigger' }],
    goal: s => s.me.chars.some(c => c.id === 'carrot'),
  },
};

export function startScenario(sc) {
  let s = makeBoard(structuredClone(sc.board));
  for (const a of sc.auto || []) s = boardReducer(s, a);
  return s;
}
