// Interactive practice board for lessons. Rules live in lib/board.js; this file only draws and listens.
import { boardReducer, powerOf } from '../lib/board.js';
import { SCENARIOS, startScenario } from '../lib/scenarios.js';
import { getCards } from '../data.js';
import { thumb } from '../lib/search.js';
import { escapeHtml } from './rich-text.js';
import { stamp, shake, buzz } from './fx.js';

export async function createBoard(name, el, onDone) {
  const sc = SCENARIOS[name];
  if (!sc) { el.innerHTML = '<p class="muted">This practice board is missing.</p>'; return; }
  const cards = await getCards().catch(() => new Map());
  const art = id => thumb(cards.get(id)?.img || '');

  let s = startScenario(sc);
  let mode = null; // { kind: 'give' } | { kind: 'attack', from }
  let done = false;

  el.classList.add('board');
  el.innerHTML = `<p class="board-prompt">${escapeHtml(sc.prompt)}</p>
    <div class="board-table" role="group" aria-label="Practice table"></div>
    <div class="board-bar"><p class="board-msg" aria-live="polite"></p><button type="button" class="btn board-reset">Start over</button></div>`;
  const table = el.querySelector('.board-table');
  const msg = el.querySelector('.board-msg');

  const cardBtn = (c, who, { inHand = false, life = false } = {}) => {
    const pw = inHand ? null : powerOf(s, who, c.id);
    const target = s.battle?.target === c.id ? ' is-target' : '';
    const attacker = s.battle?.attacker === c.id ? ' is-attacker' : '';
    const sel = mode?.from === c.id ? ' is-selected' : '';
    return `<button type="button" class="bcard${c.rested ? ' rested' : ''}${target}${attacker}${sel}${inHand ? ' in-hand' : ''}" data-id="${escapeHtml(c.id)}" data-who="${who}" data-hand="${inHand}"
      aria-label="${escapeHtml(c.name)}${pw != null ? `, ${pw} power` : ''}${c.rested ? ', rested' : ''}${inHand && c.counter ? `, counter +${c.counter}` : ''}${inHand && c.cost != null ? `, cost ${c.cost}` : ''}">
      <img src="${escapeHtml(art(c.art))}" alt="" draggable="false">
      ${pw != null ? `<span class="bpow" data-pow="${pw}">${pw.toLocaleString()}</span>` : ''}
      ${c.don ? `<span class="bdon">+${c.don} DON!!</span>` : ''}
      ${inHand && c.counter ? `<span class="bctr">+${c.counter}</span>` : ''}
      ${inHand && c.cost != null && s.turn === who ? `<span class="bcost">${c.cost}</span>` : ''}
    </button>`;
  };
  const donRow = p => `<div class="don-row" aria-label="Cost area: ${p.donActive} active DON!!, ${p.donRested} rested">
      ${Array.from({ length: p.donActive }, (_, i) => `<button type="button" class="don${mode?.kind === 'give' && i === 0 ? ' is-selected' : ''}" data-don aria-label="Active DON!!">DON!!</button>`).join('')}
      ${Array.from({ length: p.donRested }, () => `<span class="don rested" aria-hidden="true">DON!!</span>`).join('')}
    </div>`;
  const lifeStack = (p, label) => `<div class="life" aria-label="${label} Life: ${p.life}">${Array.from({ length: Math.max(p.life, 0) }, () => '<span></span>').join('')}<b>${p.life}</b><small>Life</small></div>`;

  function draw(flash) {
    const { me, opp } = s;
    table.innerHTML = `
      <div class="zone opp">
        <div class="zone-row">${lifeStack(opp, 'Opponent')}${cardBtn(opp.leader, 'opp')}</div>
        <div class="zone-row chars">${opp.chars.map(c => cardBtn(c, 'opp')).join('') || '<span class="empty-slot">No Characters</span>'}</div>
      </div>
      ${s.battle ? `<div class="battle-banner"><span>${escapeHtml(nameOf(s.battle.attacker))} <b>${powerOf(s, s.turn, s.battle.attacker).toLocaleString()}</b></span><span class="vs">vs</span><span>${escapeHtml(nameOf(s.battle.target))} <b>${powerOf(s, s.turn === 'me' ? 'opp' : 'me', s.battle.target).toLocaleString()}</b></span></div>` : '<div class="sea-line" aria-hidden="true"></div>'}
      <div class="zone me">
        <div class="zone-row chars">${me.chars.map(c => cardBtn(c, 'me')).join('') || '<span class="empty-slot">No Characters</span>'}</div>
        <div class="zone-row">${lifeStack(me, 'Your')}${cardBtn(me.leader, 'me')}${donRow(me)}</div>
        ${me.hand.length ? `<div class="hand" aria-label="Your hand">${me.hand.map(c => cardBtn(c, 'me', { inHand: true })).join('')}</div>` : ''}
      </div>
      ${s.pendingTrigger ? `<div class="trigger-ask"><img src="${escapeHtml(art(s.pendingTrigger.art))}" alt=""><div><p><b>${escapeHtml(s.pendingTrigger.name)}</b> came from your Life and has <b>[Trigger] Play this card</b>.</p>
         <button type="button" class="btn btn-primary" data-act="useTrigger">Use Trigger</button> <button type="button" class="btn" data-act="skipTrigger">Add to hand</button></div></div>` : ''}
      ${s.battle && s.turn === 'opp' ? `<button type="button" class="btn btn-primary btn-block" data-act="resolve">Finish battle</button>` : ''}`;
    if (flash) table.querySelectorAll(`[data-id="${CSS.escape(flash)}"] .bpow`).forEach(p => p.classList.add('bump'));
  }
  const nameOf = id => [s.me.leader, ...s.me.chars, s.opp.leader, ...s.opp.chars].find(c => c.id === id)?.name || '';

  function apply(action) {
    const before = s;
    s = boardReducer(s, action);
    if (s.error) { say(s.error, true); s = { ...s, error: null }; return false; }
    draw(action.target || action.card);
    if (action.type === 'attack' && s.turn === 'me') setTimeout(() => apply({ type: 'resolve' }), 750);
    if (action.type === 'resolve') {
      const r = s.log.at(-1);
      if (r?.t === 'result') say(r.hit ? `Hit: ${r.a.toLocaleString()} vs ${r.d.toLocaleString()}.` : `Blocked: ${r.a.toLocaleString()} can't beat ${r.d.toLocaleString()}.`);
    }
    check(before);
    return true;
  }
  function say(text, bad = false) { msg.textContent = text; msg.classList.toggle('bad', bad); if (bad) { shake(table); buzz([30, 40, 30]); } }
  function check() {
    if (done || !sc.goal(s)) return;
    done = true;
    mode = null;
    say(sc.success);
    stamp(el, 'Nice!');
    buzz(15);
    onDone?.();
  }

  table.addEventListener('click', e => {
    const actBtn = e.target.closest('[data-act]');
    if (actBtn) { apply({ type: actBtn.dataset.act }); return; }
    if (e.target.closest('[data-don]')) {
      if (s.turn !== 'me') return say('DON!! can only be given during your own turn.', true);
      mode = mode?.kind === 'give' ? null : { kind: 'give' };
      say(mode ? 'Now tap your Leader or one of your Characters to give it this DON!!.' : '');
      draw(); return;
    }
    const b = e.target.closest('.bcard'); if (!b) return;
    const { id, who } = b.dataset;
    const inHand = b.dataset.hand === 'true';
    if (s.turn === 'opp') { // defending
      if (inHand) return apply({ type: 'useCounter', card: id });
      if (who === 'me') return apply({ type: 'block', blocker: id });
      return say('It\'s your opponent\'s turn. Defend with a Blocker or with Counters from your hand.', true);
    }
    if (inHand) { mode = null; return apply({ type: 'play', card: id }); }
    if (mode?.kind === 'give' && who === 'me') { mode = null; return apply({ type: 'giveDon', target: id }); }
    if (mode?.kind === 'attack' && who === 'opp') { const from = mode.from; mode = null; return apply({ type: 'attack', attacker: from, target: id }); }
    if (who === 'me') {
      mode = { kind: 'attack', from: id };
      say('Now tap what to attack: their Leader, or one of their rested Characters.');
      draw(); return;
    }
    say('First tap one of your own cards to attack with.', true);
  });
  el.querySelector('.board-reset').addEventListener('click', () => { s = startScenario(sc); mode = null; done = false; say(''); draw(); });
  draw();
  if (s.battle) say(`${nameOf(s.battle.attacker)} is attacking your ${nameOf(s.battle.target)}!`);
}
