// Interactive practice board for lessons. Rules live in lib/board.js; this file only draws and listens.
// It looks like the practice game: a real playmat, card backs for Life, real DON!! cards, and the same
// card movement and battle effects (attack arrow, BLOCK!, Counters, clash, hits, K.O., Trigger banner).
import { boardReducer, powerOf } from '../lib/board.js';
import { SCENARIOS, startScenario } from '../lib/scenarios.js';
import { getCards } from '../data.js';
import { thumb } from '../lib/search.js';
import { escapeHtml } from './rich-text.js';
import { stamp, shake, buzz } from './fx.js';
import * as fx from './table-fx.js';

// The standard DON!! card (Bandai), from TCGplayer like every other card picture. Same as the practice game.
const DON_IMG = 'https://tcgplayer-cdn.tcgplayer.com/product/672598_200w.jpg';
const n = x => Number(x || 0).toLocaleString('en-US');

export async function createBoard(name, el, onDone) {
  const sc = SCENARIOS[name];
  if (!sc) { el.innerHTML = '<p class="muted">This practice board is missing.</p>'; return; }
  const cards = await getCards().catch(() => new Map());
  const art = id => thumb(cards.get(id)?.img || '');

  let s = startScenario(sc);
  let mode = null; // { kind: 'give' } | { kind: 'attack', from }
  let done = false;
  let resolveTimer = null;

  el.classList.add('board');
  el.innerHTML = `<p class="board-prompt">${escapeHtml(sc.prompt)}</p>
    <div class="board-table" role="group" aria-label="Practice table" style="--don-img:url('${DON_IMG}')">
      <div class="b-mat opp" aria-label="Opponent's side"></div>
      <div class="b-mid"></div>
      <div class="b-mat me" aria-label="Your side"></div>
      <div class="b-hand" aria-label="Your hand"></div>
    </div>
    <div class="board-bar"><p class="board-msg" aria-live="polite"></p><button type="button" class="btn board-reset">Start over</button></div>`;
  const table = el.querySelector('.board-table');
  const msg = el.querySelector('.board-msg');
  const $ = sel => table.querySelector(sel);

  // ---------- drawing ----------
  const all = () => [s.me.leader, ...s.me.chars, s.opp.leader, ...s.opp.chars];
  const nameOf = id => all().find(c => c.id === id)?.name || '';

  const cardBtn = (c, who, { inHand = false } = {}) => {
    const pw = inHand ? null : powerOf(s, who, c.id);
    const cls = [
      'gc bcard', c.rested && 'rested', inHand && 'in-hand',
      s.battle?.target === c.id && 'target', s.battle?.attacker === c.id && 'attacker',
      mode?.from === c.id && 'sel',
      canTap(c, who, inHand) && 'can',
    ].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" data-id="${escapeHtml(c.id)}" data-uid="${escapeHtml(c.id)}" data-who="${who}" data-hand="${inHand}"
      aria-label="${escapeHtml(c.name)}${pw != null ? `, ${pw} power` : ''}${c.rested ? ', rested' : ''}${inHand && c.counter ? `, counter +${c.counter}` : ''}${inHand && c.cost != null ? `, cost ${c.cost}` : ''}">
      <img src="${escapeHtml(art(c.art))}" alt="" draggable="false">
      ${pw != null ? `<span class="gc-pow ${pw > c.power ? 'up' : ''}">${n(pw)}</span>` : ''}
      ${c.don ? `<span class="gc-dons" aria-hidden="true">${'<i></i>'.repeat(Math.min(c.don, 5))}</span><span class="gc-don">+${c.don}</span>` : ''}
      ${inHand && c.counter ? `<span class="bctr">+${n(c.counter)}</span>` : ''}
      ${inHand && c.cost != null && s.turn === who ? `<span class="bcost">${c.cost}</span>` : ''}
    </button>`;
  };
  // Gentle glow on what you can tap next (like the practice game).
  function canTap(c, who, inHand) {
    if (done || s.pendingTrigger) return false;
    if (s.turn === 'opp') return who === 'me' && (inHand ? !!c.counter : !!c.blocker && !c.rested && !s.battle?.blocked && !s.battle?.countered);
    if (s.battle) return false;
    if (inHand) return (c.cost || 0) <= s.me.donActive;
    if (mode?.kind === 'give') return who === 'me';
    if (mode?.kind === 'attack') return who === 'opp' && (c === s.opp.leader || c.rested);
    return false;
  }
  const lifeCol = (p, label) => `<span class="life-col" aria-label="${label} Life: ${p.life}">${Array.from({ length: Math.max(p.life, 0) }, (_, i) => `<span class="cb life" style="--k:${i}"></span>`).join('') || '<span class="slot sm"></span>'}<b class="pile-n life-n">${p.life}</b></span>`;
  const slots = (p, who) => Array.from({ length: 5 }, (_, i) => (p.chars[i] ? cardBtn(p.chars[i], who) : '<span class="slot" aria-hidden="true"></span>')).join('');
  const donRow = p => `<span class="don-row" aria-label="Cost area: ${p.donActive} active DON!!, ${p.donRested} rested">
      ${Array.from({ length: p.donActive }, (_, i) => `<button type="button" class="dn a${mode?.kind === 'give' && i === p.donActive - 1 ? ' sel' : ''}${s.turn === 'me' && !s.battle && !done ? ' can' : ''}" data-don aria-label="Active DON!!"></button>`).join('')}
      ${'<i class="dn r" aria-hidden="true"></i>'.repeat(p.donRested)}
      ${p.donActive + p.donRested ? '' : '<span class="b-none">No DON!!</span>'}
    </span>`;

  function draw() {
    const { me, opp } = s;
    $('.b-mat.opp').innerHTML = `
      <div class="z z-leader" data-zone="Leader">${cardBtn(opp.leader, 'opp')}</div>
      <div class="z z-life" data-zone="Life">${lifeCol(opp, 'Opponent')}</div>
      <div class="z z-chars" data-zone="Character area">${slots(opp, 'opp')}</div>`;
    $('.b-mat.me').innerHTML = `
      <div class="z z-life" data-zone="Life">${lifeCol(me, 'Your')}</div>
      <div class="z z-chars" data-zone="Character area">${slots(me, 'me')}</div>
      <div class="z z-leader" data-zone="Leader">${cardBtn(me.leader, 'me')}</div>
      <div class="z z-cost" data-zone="Cost area">${donRow(me)}</div>`;
    const b = s.battle, t = s.pendingTrigger;
    $('.b-mid').innerHTML = t ? `<div class="trigger-ask"><img src="${escapeHtml(art(t.art))}" alt=""><div><p><b>${escapeHtml(t.name)}</b> came from your Life and has <b>[Trigger] Play this card</b>.</p>
         <div class="b-btns"><button type="button" class="btn btn-primary" data-act="useTrigger">Use Trigger</button><button type="button" class="btn" data-act="skipTrigger">Add to hand</button></div></div></div>`
      : b ? `<div class="battle-banner"><span>${escapeHtml(nameOf(b.attacker))} <b>${n(powerOf(s, s.turn, b.attacker))}</b></span><span class="vs">vs</span><span>${escapeHtml(nameOf(b.target))} <b>${n(powerOf(s, s.turn === 'me' ? 'opp' : 'me', b.target))}</b></span></div>
         ${s.turn === 'opp' ? '<button type="button" class="btn btn-primary b-finish" data-act="resolve">Finish battle</button>' : ''}`
        : '<div class="sea-line" aria-hidden="true"></div>';
    $('.b-hand').innerHTML = me.hand.length ? me.hand.map(c => cardBtn(c, 'me', { inHand: true })).join('') : '';
    $('.b-hand').hidden = !me.hand.length;
    requestAnimationFrame(arrow);
  }
  const arrow = () => {
    if (!table.isConnected) return;
    const b = s.battle;
    fx.arrowBetween(table, b && $(`.gc[data-id="${CSS.escape(b.attacker)}"]`), b && $(`.gc[data-id="${CSS.escape(b.target)}"]`), { blocked: b?.blocked, key: b ? `${b.attacker}>${b.target}` : '' });
  };

  // ---------- movement + battle effects ----------
  function snap() {
    const m = new Map();
    for (const c of table.querySelectorAll('.gc[data-id]')) m.set(c.dataset.id, { rect: fx.rectOf(c), tf: fx.tfOf(c), w: c.offsetWidth, h: c.offsetHeight, html: c.outerHTML });
    const dn = table.querySelector('.b-mat.me .dn.a');
    return { cards: m, don: dn && fx.rectOf(dn), life: { me: fx.rectOf($('.b-mat.me .life-col')), opp: fx.rectOf($('.b-mat.opp .life-col')) }, hand: fx.rectOf($('.b-hand')), mid: fx.rectOf($('.b-mid img')) };
  }

  function animate(before, prev) {
    if (fx.reduced()) return;
    const k = 1;
    const elOf = id => $(`.gc[data-id="${CSS.escape(id)}"]`);
    const rectNow = id => fx.rectOf(elOf(id)) || before.cards.get(id)?.rect;
    let t = 0;
    for (const e of s.log.slice(prev.log.length)) {
      switch (e.t) {
        case 'don': {
          const tuck = table.querySelector(`.gc[data-id="${CSS.escape(e.id)}"] .gc-dons i:last-child`);
          if (tuck && before.don) {
            const tc = fx.center(fx.rectOf(tuck)), o = fx.center(before.don);
            tuck.animate([{ transform: `translate(${o.x - tc.x}px, ${o.y - tc.y}px) ${fx.tfOf(tuck)} scale(1.4)` }, { transform: fx.tfOf(tuck) || 'none' }], { duration: 480 * k, easing: fx.EASE });
          }
          const r = rectNow(e.id);
          if (r) { fx.burst(table, fx.center(r), 'don', 380 * k, k); fx.floatText(table, { x: fx.center(r).x, y: r.top + r.height * .3 }, '+1,000', 'up', 300 * k, k); }
          break;
        }
        case 'play': {
          const rested = [...table.querySelectorAll('.b-mat.me .dn.r')].slice(-(prev.me.donActive - s.me.donActive) || 0);
          rested.forEach((d, i) => d.animate([{ transform: 'none', filter: 'none' }, { transform: fx.tfOf(d) || 'none' }], { duration: 380 * k, delay: (300 + i * 90) * k, easing: fx.EASE, fill: 'backwards' }));
          break;
        }
        case 'attack': {
          t += 120 * k;
          const r = rectNow(e.target); if (r) fx.floatText(table, { x: fx.center(r).x, y: r.top }, 'ATTACK!', 'atk', t, k);
          t += 380 * k; break;
        }
        case 'block': {
          const r = rectNow(e.id); if (!r) break;
          fx.burst(table, fx.center(r), 'shield', t, k); fx.stamp(table, r, 'BLOCK!', 'block', t, k); t += 650 * k; break;
        }
        case 'counter': {
          const b0 = before.cards.get(e.id), target = prev.battle?.target, tr = target && rectNow(target);
          if (b0 && tr) {
            const c0 = fx.center(b0.rect), d = fx.center(tr);
            fx.ghost(table, { html: b0.html, rect: b0.rect, w: b0.w, h: b0.h }, fx.pathOf([{ ...c0 }, { x: (c0.x + d.x) / 2, y: Math.min(c0.y, d.y) - 30, s: 1.2, o: .45 }, { ...d, s: .5 }], 620), { k });
            fx.burst(table, d, 'guard', 520 * k, k);
            fx.floatText(table, { x: d.x, y: tr.top + tr.height * .3 }, `+${n(e.amount)}`, 'up', 520 * k, k);
          }
          break;
        }
        case 'result': {
          const b = prev.battle; if (!b) break;
          const ar = rectNow(b.attacker), tr = rectNow(b.target);
          if (!ar || !tr) break;
          const a = fx.center(ar), c = fx.center(tr);
          const dx = (c.x - a.x) * .55, dy = (c.y - a.y) * .55;
          elOf(b.attacker)?.animate([{ translate: '0 0' }, { translate: `${-dx * .08}px ${-dy * .08}px`, offset: .25 }, { translate: `${dx}px ${dy}px`, offset: .55 }, { translate: '0 0' }], { duration: 520 * k, delay: t, easing: 'cubic-bezier(.5,0,.2,1)', composite: 'add' });
          fx.floatText(table, { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }, `${n(e.a)} vs ${n(e.d)}`, e.hit ? 'vs hit' : 'vs miss', t + 120 * k, k);
          if (!e.hit) { fx.burst(table, c, 'parry', t + 280 * k, k); fx.stamp(table, tr, 'HELD!', 'held', t + 320 * k, k); t += 620 * k; break; }
          fx.burst(table, c, 'hit', t + 280 * k, k);
          const defWho = prev.turn === 'me' ? 'opp' : 'me';
          const isLeader = prev[defWho].leader.id === b.target;
          t += 620 * k;
          if (isLeader) {
            fx.burst(table, c, 'hit big', t, k);
            fx.floatText(table, { x: c.x, y: tr.top }, '−1 LIFE', 'dmg', t, k);
            fx.shakeEl($(`.b-mat.${defWho}`), t, k, 9);
            // The top Life card comes off the stack and goes to the hand (face down, flipping up on the way).
            const from = before.life[defWho], dest = defWho === 'me' ? (s.pendingTrigger ? fx.rectOf($('.b-mid img')) : fx.rectOf($('.b-hand'))) : null;
            if (from) {
              const o = fx.center(from), to = dest ? fx.center(dest) : { x: o.x, y: o.y - 60 };
              const w = Math.min(from.width, 60);
              fx.ghost(table, { img: art(prev[defWho].lifeCards[0]?.art || ''), rect: { left: o.x - w / 2, top: o.y - w * .7, width: w, height: w * 1.397 }, w }, fx.pathOf([{ ...o }, { x: (o.x + to.x) / 2, y: Math.min(o.y, to.y) - 40, s: 1.4, o: .5 }, { ...to, s: 1 }], 760), { delay: t, k, fromBack: true });
            }
            t += 420 * k;
          } else {
            const b0 = before.cards.get(b.target);
            fx.stamp(table, tr, 'K.O.!', 'ko', t, k);
            if (b0) { fx.ghost(table, { html: b0.html, rect: b0.rect, w: b0.w, h: b0.h, tf: b0.tf }, fx.pathOf([{ ...c, tf: b0.tf }, { x: c.x, y: c.y + 10, s: .9, o: .5 }, { x: c.x, y: c.y + 40, s: .5 }], 700), { delay: t + 300 * k, k }); }
            t += 700 * k;
          }
          break;
        }
        default: break;
      }
    }
    if (s.pendingTrigger && !prev.pendingTrigger) {
      fx.banner(table, { title: 'TRIGGER!', sub: s.pendingTrigger.name, img: art(s.pendingTrigger.art), cls: 'trigger' }, t, k, 1000);
      $('.b-mid .trigger-ask')?.animate([{ opacity: 0 }, { opacity: 0 }], { duration: t + 1100 * k, fill: 'backwards' });
    }

    // Cards that moved (played from hand, rested, blocked) slide and turn; new cards come from where they were.
    let newIdx = 0;
    for (const c of table.querySelectorAll('.gc[data-id]')) {
      const id = c.dataset.id, b = before.cards.get(id);
      const r = fx.rectOf(c), c1 = fx.center(r), tf1 = fx.tfOf(c);
      if (b) {
        const c0 = fx.center(b.rect), dx = c0.x - c1.x, dy = c0.y - c1.y, dist = Math.hypot(dx, dy);
        if (dist < 2 && b.tf === tf1) continue;
        const lift = Math.min(28, dist * .12);
        c.animate(dist < 2
          ? [{ transform: `${b.tf} ` || 'none' }, { transform: `${b.tf} translateY(-6px) scale(1.05)`, offset: .35 }, { transform: tf1 || 'none' }]
          : [{ transform: `translate(${dx}px, ${dy}px) ${b.tf}` }, { transform: `translate(${dx * .5}px, ${dy * .5 - lift}px) ${tf1} scale(1.12)`, offset: .45 }, { transform: tf1 || 'none' }],
        { duration: (dist < 2 ? 380 : 520) * k, easing: fx.EASE });
        continue;
      }
      const from = before.mid || before.life.me;
      const delay = newIdx++ * 90 * k;
      if (!from) { c.animate([{ opacity: 0, transform: `${tf1} scale(.85)` }, { opacity: 1, transform: tf1 || 'none' }], { duration: 320 * k, delay, easing: fx.EASE, fill: 'backwards' }); continue; }
      const c0 = fx.center(from), dx = c0.x - c1.x, dy = c0.y - c1.y, s0 = Math.max(.35, Math.min(1.4, from.width / r.width));
      c.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s0})` }, { transform: `translate(${dx * .45}px, ${dy * .45 - 26}px) scale(${(s0 + 1.1) / 2})`, offset: .5 }, { transform: tf1 || 'none' }], { duration: 560 * k, delay, easing: fx.EASE, fill: 'backwards' });
    }
  }

  // ---------- acting ----------
  function apply(action) {
    const before = snap(), prev = s;
    s = boardReducer(s, action);
    if (s.error) { say(s.error, true); s = { ...s, error: null }; return false; }
    if (action.type === 'resolve' || action.type === 'useTrigger' || action.type === 'skipTrigger') mode = null;
    draw();
    animate(before, prev);
    if (action.type === 'attack' && s.turn === 'me') { clearTimeout(resolveTimer); resolveTimer = setTimeout(() => { if (table.isConnected) apply({ type: 'resolve' }); }, fx.reduced() ? 300 : 950); }
    if (action.type === 'resolve') {
      const r = s.log.at(-1);
      if (r?.t === 'result') say(r.hit ? `Hit: ${n(r.a)} vs ${n(r.d)}.` : `Blocked: ${n(r.a)} can't beat ${n(r.d)}.`);
    }
    check();
    return true;
  }
  function say(text, bad = false) { msg.textContent = text; msg.classList.toggle('bad', bad); if (bad) { shake(table); buzz([30, 40, 30]); } }
  function check() {
    if (done || !sc.goal(s)) return;
    done = true;
    mode = null;
    say(sc.success);
    setTimeout(() => { if (!table.isConnected) return; draw(); stamp(el, 'Nice!'); buzz(15); }, fx.reduced() ? 0 : 1300);
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
  el.querySelector('.board-reset').addEventListener('click', () => { clearTimeout(resolveTimer); s = startScenario(sc); mode = null; done = false; say(''); draw(); });
  const ro = new ResizeObserver(() => { if (!table.isConnected) { ro.disconnect(); return; } arrow(); });
  ro.observe(table);
  draw();
  if (s.battle) {
    say(`${nameOf(s.battle.attacker)} is attacking your ${nameOf(s.battle.target)}!`);
    setTimeout(() => { if (!s.battle) return; const r = fx.rectOf($(`.gc[data-id="${CSS.escape(s.battle.target)}"]`)); if (r && !fx.reduced()) fx.floatText(table, { x: fx.center(r).x, y: r.top }, 'ATTACK!', 'atk', 0, 1); }, 650); // after the lesson page scrolls into place
  }
}
