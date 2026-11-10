// Table animations for the practice game: cards move like real cards (deal, flip, slide, rest, tuck DON!!)
// and battles read clearly (attack arrow, block shield, clash, hits, K.O. stamps, power pops, banners).
// Usage: const before = snapshot(root, prev); render(); const ms = animate(root, before, prev, next, { fast });
import { find, def, power } from '../game/engine.js';
import { thumb } from '../lib/search.js';
import { escapeHtml } from './rich-text.js';

const BACK = 'assets/card-back.jpg';
const sideSel = p => (p === 0 ? '.g-zone.me' : '.g-zone.opp');
const rectOf = el => el?.getBoundingClientRect();
const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const tfOf = el => { const t = getComputedStyle(el).transform; return t === 'none' ? '' : t; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.8,.2,1)';

function pileRect(root, p, kind) {
  if (kind === 'hand') return p === 0 ? rectOf(root.querySelector('.g-hand')) : rectOf(root.querySelector('.g-opphand'));
  const z = root.querySelector(`${sideSel(p)} .z-${kind}`);
  return rectOf(z?.querySelector('.pile, .life-col, .don-row') || z);
}
function tableCenter(root) {
  const me = rectOf(root.querySelector('.g-zone.me')), opp = rectOf(root.querySelector('.g-zone.opp'));
  if (!me || !opp) return { x: innerWidth / 2, y: innerHeight / 2 };
  return { x: (me.left + me.right) / 2, y: (opp.bottom + me.top) / 2 };
}

// ---------- snapshot of the old table (taken before re-rendering) ----------
export function snapshot(root, s) {
  const cards = new Map();
  for (const el of root.querySelectorAll('.g-zone .gc[data-uid], .g-hand .gc[data-uid]')) {
    cards.set(el.dataset.uid, { rect: rectOf(el), tf: tfOf(el), w: el.offsetWidth, h: el.offsetHeight, html: el.outerHTML });
  }
  const pw = new Map();
  for (const P of s.players) for (const c of [P.leader, ...P.chars]) pw.set(c.uid, power(s, c.uid));
  return { cards, pw, center: tableCenter(root) };
}

// ---------- overlay helpers ----------
function layer(root) {
  let l = root.querySelector('.fx-layer');
  if (!l) { l = document.createElement('div'); l.className = 'fx-layer'; l.setAttribute('aria-hidden', 'true'); root.querySelector('.game')?.append(l); }
  return l;
}
const at = (root, ms, fn) => setTimeout(() => { if (root.isConnected) fn(); }, ms);

function floatText(root, pt, text, cls, delay, k) {
  at(root, delay, () => {
    const t = document.createElement('div'); t.className = `fx-float ${cls}`; t.textContent = text;
    t.style.left = `${pt.x}px`; t.style.top = `${pt.y}px`; layer(root).append(t);
    t.animate([{ opacity: 0, transform: 'translate(-50%, -30%) scale(.6)' }, { opacity: 1, transform: 'translate(-50%, -70%) scale(1.15)', offset: .25 }, { opacity: 1, transform: 'translate(-50%, -110%) scale(1)', offset: .75 }, { opacity: 0, transform: 'translate(-50%, -150%) scale(.95)' }], { duration: 1100 * k, easing: 'ease-out' }).onfinish = () => t.remove();
  });
}
function burst(root, pt, cls, delay, k) {
  at(root, delay, () => {
    const b = document.createElement('div'); b.className = `fx-burst ${cls}`; b.style.left = `${pt.x}px`; b.style.top = `${pt.y}px`; layer(root).append(b);
    b.animate([{ opacity: .95, transform: 'translate(-50%,-50%) scale(.2)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.6)' }], { duration: 520 * k, easing: 'ease-out' }).onfinish = () => b.remove();
  });
}
function stamp(root, rect, text, cls, delay, k) {
  at(root, delay, () => {
    const st = document.createElement('div'); st.className = `fx-stamp ${cls}`; st.textContent = text;
    const c = center(rect); st.style.left = `${c.x}px`; st.style.top = `${c.y}px`; layer(root).append(st);
    st.animate([{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-14deg) scale(2.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) rotate(-14deg) scale(1)', offset: .22 }, { opacity: 1, transform: 'translate(-50%,-50%) rotate(-14deg) scale(1)', offset: .8 }, { opacity: 0, transform: 'translate(-50%,-50%) rotate(-14deg) scale(1.05)' }], { duration: 950 * k, easing: 'ease-out' }).onfinish = () => st.remove();
  });
}
function shakeEl(el, delay, k, strength = 6) {
  if (!el) return;
  el.animate([{ translate: '0 0' }, { translate: `${-strength}px 2px` }, { translate: `${strength}px -2px` }, { translate: `${-strength / 2}px 1px` }, { translate: '0 0' }], { duration: 360 * k, delay, easing: 'ease-out' });
}
function banner(root, { title, sub = '', img = '', cls = '' }, delay, k, hold = 900) {
  at(root, delay, () => {
    const b = document.createElement('div'); b.className = `fx-banner ${cls}`;
    b.innerHTML = `${img ? `<img src="${escapeHtml(img)}" alt="">` : ''}<div><strong>${escapeHtml(title)}</strong>${sub ? `<span>${escapeHtml(sub)}</span>` : ''}</div>`;
    const c = tableCenter(root); b.style.left = `${c.x}px`; b.style.top = `${c.y}px`; layer(root).append(b);
    b.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.85)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .15 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .85 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.96)' }], { duration: (hold + 300) * k, easing: EASE }).onfinish = () => b.remove();
  });
}

// A card-shaped ghost that travels across the table (for cards leaving the table, or the computer's hidden plays).
function ghost(root, { html, img, rect, w, h, tf = '' }, path, { delay = 0, k = 1, toBack = false, fromBack = false, holdAt = -1 } = {}) {
  at(root, delay, () => {
    let g;
    if (html) { const t = document.createElement('div'); t.innerHTML = html; g = t.firstElementChild; g.classList.remove('can', 'sel', 'hinted', 'target', 'attacker'); }
    else { g = document.createElement('div'); g.className = 'gc'; g.innerHTML = `<img src="${escapeHtml(img)}" alt="">`; }
    g.classList.add('fx-ghost'); g.removeAttribute('data-uid');
    const c0 = center(rect); const W = w || rect.width, H = h || W * 1.397;
    Object.assign(g.style, { left: `${c0.x - W / 2}px`, top: `${c0.y - H / 2}px`, width: `${W}px`, height: `${H}px` });
    const back = document.createElement('span'); back.className = 'fx-back'; g.append(back);
    layer(root).append(g);
    const frames = path.map(p => ({ transform: `translate(${p.x - c0.x}px, ${p.y - c0.y}px) ${p.tf ?? ''} scale(${p.s ?? 1})`, offset: p.o }));
    frames[0].transform += ` ${tf}`;
    const dur = path.dur * k;
    g.animate(frames, { duration: dur, easing: EASE, fill: 'forwards' }).onfinish = () => g.remove();
    const bf = toBack ? [{ opacity: 0 }, { opacity: 0, offset: .45 }, { opacity: 1, offset: .55 }, { opacity: 1 }]
      : fromBack ? [{ opacity: 1 }, { opacity: 1, offset: .45 }, { opacity: 0, offset: .55 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0 }];
    back.animate(bf, { duration: dur, fill: 'forwards' });
    if (holdAt >= 0) g.style.zIndex = 70;
  });
}
const pathOf = (pts, dur) => Object.assign(pts, { dur });

// ---------- the attack arrow (stays while a battle is on) ----------
let lastArrow = '';
export function drawArrow(root, s) {
  const g = root.querySelector('.game'); if (!g) return;
  let svg = g.querySelector('.fx-arrow');
  const b = s.battle;
  const a = b && root.querySelector(`.gc[data-uid="${b.attacker}"]`), t = b && root.querySelector(`.gc[data-uid="${b.target}"]`);
  if (!a || !t) { svg?.remove(); lastArrow = ''; return; }
  const gr = rectOf(g), ar = center(rectOf(a)), tr = rectOf(t), tc = center(tr);
  const x1 = ar.x - gr.left, y1 = ar.y - gr.top, x2 = tc.x - gr.left, y2 = tc.y - gr.top;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const stop = Math.min(tr.height, tr.width) * .45; // end at the card's edge
  const ex = x2 - (dx / len) * stop, ey = y2 - (dy / len) * stop;
  const mx = (x1 + ex) / 2 - (dy / len) * len * .18, my = (y1 + ey) / 2 + (dx / len) * len * .18;
  const key = `${b.attacker}>${b.target}`;
  if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('fx-arrow'); svg.setAttribute('aria-hidden', 'true'); g.append(svg); }
  svg.setAttribute('viewBox', `0 0 ${gr.width} ${gr.height}`);
  svg.innerHTML = `<defs><marker id="fxhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#ff3b45"/></marker></defs>
    <path class="fx-arrow-glow" d="M${x1} ${y1} Q${mx} ${my} ${ex} ${ey}"/>
    <path class="fx-arrow-line ${key !== lastArrow ? 'enter' : ''} ${b.blocked ? 'blocked' : ''}" d="M${x1} ${y1} Q${mx} ${my} ${ex} ${ey}" marker-end="url(#fxhead)"/>
    <circle class="fx-target-ring" cx="${x2}" cy="${y2}" r="${Math.max(tr.width, tr.height) * .62}"/>`;
  lastArrow = key;
}

// ---------- animate the change from prev to next ----------
// Returns how long (ms) the animations run, so the computer can wait before its next move.
export function animate(root, before, prev, next, { fast = false } = {}) {
  if (reduced() || !before) return 0;
  const k = fast ? .4 : 1;
  const C = tableCenter(root);
  let t = 0; // timeline for battle events
  const koDelay = new Map();
  const n = Math.min((next.logN || 0) - (prev.logN || 0), next.log.length);
  const events = n > 0 ? next.log.slice(-n) : [];
  const elOf = uid => root.querySelector(`.gc[data-uid="${uid}"]`);
  const oldRect = uid => before.cards.get(uid)?.rect;
  const rectNow = uid => rectOf(elOf(uid)) || oldRect(uid);

  for (const e of events) {
    switch (e.e) {
      case 'attack': {
        t += 120 * k;
        const r = rectNow(e.target); if (r) floatText(root, { x: center(r).x, y: r.top }, 'ATTACK!', 'atk', t, k);
        t += 380 * k; break;
      }
      case 'block': {
        const r = rectNow(e.uid); if (!r) break;
        burst(root, center(r), 'shield', t, k); stamp(root, r, 'BLOCK!', 'block', t, k); t += 650 * k; break;
      }
      case 'counter': {
        if (prev.battle) { const r = rectNow(prev.battle.target); if (r) burst(root, center(r), 'guard', t, k); }
        if (e.id && prev.battle && prev.active === 0) { // the computer countered: show the card it used
          ghost(root, { img: thumb(def(e.id).img), rect: pileRect(root, 1, 'hand') }, pathOf([{ x: center(pileRect(root, 1, 'hand')).x, y: center(pileRect(root, 1, 'hand')).y, s: .5 }, { x: C.x, y: C.y, s: 1.5, o: .35 }, { x: C.x, y: C.y, s: 1.5, o: .7 }, { ...center(pileRect(root, 1, 'trash')), s: .6 }], 1100), { delay: t, k, fromBack: true });
        }
        t += 450 * k; break;
      }
      case 'event': {
        if (e.p === 1) {
          const hr = pileRect(root, 1, 'hand');
          ghost(root, { img: thumb(def(e.id).img), rect: hr }, pathOf([{ ...center(hr), s: .5 }, { x: C.x, y: C.y, s: 1.6, o: .3 }, { x: C.x, y: C.y, s: 1.6, o: .72 }, { ...center(pileRect(root, 1, 'trash')), s: .6 }], 1300), { delay: t, k, fromBack: true });
          t += 700 * k;
        }
        break;
      }
      case 'clash': {
        const ar = rectNow(e.attacker), tr = rectNow(e.target);
        const ael = elOf(e.attacker);
        if (ar && tr) {
          const a = center(ar), b = center(tr);
          const dx = (b.x - a.x) * .55, dy = (b.y - a.y) * .55;
          ael?.animate([{ translate: '0 0' }, { translate: `${-dx * .08}px ${-dy * .08}px`, offset: .25 }, { translate: `${dx}px ${dy}px`, offset: .55 }, { translate: '0 0' }], { duration: 520 * k, delay: t, easing: 'cubic-bezier(.5,0,.2,1)', composite: 'add' });
          const hit = e.a >= e.t;
          burst(root, b, hit ? 'hit' : 'parry', t + 280 * k, k);
          floatText(root, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, `${e.a.toLocaleString('en-US')} vs ${e.t.toLocaleString('en-US')}`, hit ? 'vs hit' : 'vs miss', t + 120 * k, k);
          if (hit) shakeEl(elOf(e.target), t + 300 * k, k, 7);
          else stamp(root, tr, 'HELD!', 'held', t + 320 * k, k);
        }
        t += 620 * k; break;
      }
      case 'damage': {
        const lr = rectOf(root.querySelector(`${sideSel(e.p)} .g-lead .gc`));
        if (lr) { burst(root, center(lr), 'hit big', t, k); floatText(root, { x: center(lr).x, y: lr.top }, '−1 LIFE', 'dmg', t, k); }
        shakeEl(root.querySelector('.g-zone.' + (e.p === 0 ? 'me' : 'opp')), t, k, 9);
        t += 420 * k; break;
      }
      case 'ko': {
        const r = oldRect(e.uid) || rectNow(e.uid);
        if (r) { stamp(root, r, 'K.O.!', 'ko', t, k); burst(root, center(r), 'hit', t, k); }
        koDelay.set(e.uid, t + 420 * k);
        t += 700 * k; break;
      }
      case 'trigger': {
        banner(root, { title: 'TRIGGER!', sub: def(e.id).name, img: thumb(def(e.id).img), cls: 'trigger' }, t, k, 1000);
        t += 1100 * k; break;
      }
      case 'activate': {
        const el = elOf(e.uid);
        el?.animate([{ filter: 'brightness(1) drop-shadow(0 0 0 #f3b400)' }, { filter: 'brightness(1.35) drop-shadow(0 0 14px #f3b400)', offset: .4 }, { filter: 'brightness(1) drop-shadow(0 0 0 #f3b400)' }], { duration: 800 * k, delay: t });
        const r = rectNow(e.uid); if (r) floatText(root, { x: center(r).x, y: r.top }, def(e.id).name, 'ability', t, k);
        t += 450 * k; break;
      }
      case 'reveal': {
        const rocks = def(e.id).traits.some(x => x.includes('Rocks Pirates'));
        banner(root, { title: rocks ? 'Rocks Pirate! Draw 2' : 'Not a Rocks Pirate', sub: def(e.id).name, img: thumb(def(e.id).img), cls: rocks ? 'good' : '' }, t, k, 800);
        t += 900 * k; break;
      }
      case 'replaced': t += 200 * k; break;
      case 'win': banner(root, { title: e.p === 0 ? 'VICTORY!' : 'DEFEAT', cls: e.p === 0 ? 'good' : 'bad' }, t + 200 * k, k, 1400); break;
      default: break;
    }
  }

  // ----- card movement (FLIP), new cards arriving, cards leaving -----
  const now = new Map([...root.querySelectorAll('.g-zone .gc[data-uid], .g-hand .gc[data-uid]')].map(el => [el.dataset.uid, el]));
  let newIdx = 0;
  for (const [uid, el] of now) {
    const b = before.cards.get(uid);
    const r = rectOf(el), c1 = center(r), tf1 = tfOf(el);
    if (b) {
      const c0 = center(b.rect), dx = c0.x - c1.x, dy = c0.y - c1.y, dist = Math.hypot(dx, dy);
      if (dist < 2 && b.tf === tf1) continue;
      const lift = Math.min(28, dist * .12);
      el.animate(dist < 2
        ? [{ transform: `${b.tf} ` || 'none' }, { transform: `${b.tf} translateY(-6px) scale(1.05)`, offset: .35 }, { transform: tf1 || 'none' }]
        : [{ transform: `translate(${dx}px, ${dy}px) ${b.tf}` }, { transform: `translate(${dx * .5}px, ${dy * .5 - lift}px) ${tf1} scale(1.08)`, offset: .45 }, { transform: tf1 || 'none' }],
      { duration: (dist < 2 ? 380 : 480) * k, easing: EASE });
      continue;
    }
    // A card that wasn't on the table before: where did it come from?
    const f = find(prev, uid);
    const owner = f ? f.owner : (next.players[0].hand.some(c => c.uid === uid) ? 0 : 1);
    const zone = f?.zone || 'deck';
    const from = zone === 'hand' && owner === 1 ? pileRect(root, 1, 'hand')
      : ['deck', 'life', 'trash'].includes(zone) ? pileRect(root, owner, zone)
        : zone === 'limbo' ? { left: C.x - 40, top: C.y - 56, width: 80, height: 112 } : null;
    const delay = newIdx++ * 90 * k;
    if (!from) { el.animate([{ opacity: 0, transform: `${tf1} scale(.85)` }, { opacity: 1, transform: tf1 || 'none' }], { duration: 320 * k, delay, easing: EASE, fill: 'backwards' }); continue; }
    const c0 = center(from), dx = c0.x - c1.x, dy = c0.y - c1.y, s0 = Math.max(.35, Math.min(1, from.width / r.width));
    const faceDown = zone === 'deck' || zone === 'life' || (zone === 'hand' && owner === 1);
    el.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${s0})` },
      { transform: `translate(${dx * .45}px, ${dy * .45 - 26}px) scale(${(s0 + 1.1) / 2}) ${faceDown ? 'scaleX(.04)' : ''}`, offset: .5 },
      { transform: tf1 || 'none' },
    ], { duration: 560 * k, delay, easing: EASE, fill: 'backwards' });
    if (faceDown) {
      const bk = document.createElement('span'); bk.className = 'fx-back'; el.append(bk);
      bk.animate([{ opacity: 1 }, { opacity: 1, offset: .5 }, { opacity: 0, offset: .51 }, { opacity: 0 }], { duration: 560 * k, delay, fill: 'both' }).onfinish = () => bk.remove();
    }
  }
  for (const [uid, b] of before.cards) {
    if (now.has(uid)) continue;
    const f = find(next, uid);
    const owner = f ? f.owner : 0;
    const dest = !f ? null : f.zone === 'hand' ? pileRect(root, owner, 'hand') : ['trash', 'deck', 'life'].includes(f.zone) ? pileRect(root, owner, f.zone) : null;
    const c0 = center(b.rect);
    const wasInHand = b.html.includes('in-hand');
    const toBack = f && (f.zone === 'deck' || f.zone === 'life' || (f.zone === 'hand' && owner === 1));
    const d = dest ? center(dest) : c0;
    const sEnd = dest ? Math.max(.35, Math.min(1, dest.width / b.w)) : .6;
    const path = wasInHand && f?.zone === 'trash'
      ? pathOf([{ ...c0 }, { x: C.x, y: C.y, s: 1.5, o: .3 }, { x: C.x, y: C.y, s: 1.5, o: .7 }, { ...d, s: sEnd }], 1150)
      : pathOf([{ ...c0, tf: b.tf }, { x: (c0.x + d.x) / 2, y: (c0.y + d.y) / 2 - 24, s: 1.05, o: .45 }, { ...d, s: sEnd }], 600);
    ghost(root, { html: b.html, rect: b.rect, w: b.w, h: b.h, tf: '' }, path, { delay: koDelay.get(uid) || 0, k, toBack });
  }

  // ----- DON!! -----
  for (const p of [0, 1]) {
    const P0 = prev.players[p], P1 = next.players[p];
    const chips = [...root.querySelectorAll(`${sideSel(p)} .dn`)];
    const act = chips.filter(x => x.classList.contains('a')), rst = chips.filter(x => x.classList.contains('r'));
    const tot0 = P0.donActive + P0.donRested, tot1 = P1.donActive + P1.donRested;
    const deck = pileRect(root, p, 'dondeck');
    if (tot1 > tot0 && deck) { // new DON!! from the DON!! deck
      const added = act.slice(Math.max(0, act.length - (tot1 - tot0)));
      added.forEach((el, i) => { const c = center(rectOf(el)), o = center(deck); el.animate([{ transform: `translate(${o.x - c.x}px, ${o.y - c.y}px) scale(1.15)` }, { transform: `translate(${(o.x - c.x) / 2}px, ${(o.y - c.y) / 2 - 14}px) scale(1.1)`, offset: .5 }, { transform: 'none' }], { duration: 480 * k, delay: (200 + i * 110) * k, easing: EASE, fill: 'backwards' }); });
    }
    if (P1.donRested > P0.donRested && tot1 <= tot0 + 0) rst.slice(0, P1.donRested - P0.donRested).forEach(el => el.animate([{ transform: 'none', filter: 'none' }, { transform: tfOf(el) }], { duration: 380 * k, easing: EASE }));
    if (P0.donRested > 0 && P1.donRested === 0 && P1.donActive > P0.donActive) act.slice(0, P0.donRested).forEach((el, i) => el.animate([{ transform: 'rotate(90deg) scale(.92)', filter: 'brightness(.62)' }, { transform: 'none', filter: 'none' }], { duration: 420 * k, delay: i * 40 * k, easing: EASE }));
    // DON!! given to a card: slides from the cost area and tucks under it
    const cost = pileRect(root, p, 'cost');
    for (const c of [P1.leader, ...P1.chars]) {
      const old = find(prev, c.uid)?.inst.don || 0;
      if (c.don > old && cost) {
        const tuck = root.querySelector(`.gc[data-uid="${c.uid}"] .gc-dons i:last-child`); if (!tuck) continue;
        const tc = center(rectOf(tuck)), o = center(cost);
        tuck.animate([{ transform: `translate(${o.x - tc.x}px, ${o.y - tc.y}px) ${tfOf(tuck)} scale(.6)` }, { transform: tfOf(tuck) || 'none' }], { duration: 480 * k, easing: EASE, composite: 'replace' });
        burst(root, center(rectOf(elOf(c.uid))), 'don', 380 * k, k);
      }
    }
    // Life cards added (setup, or effects that add Life)
    if (P1.life.length > P0.life.length) {
      const lives = [...root.querySelectorAll(`${sideSel(p)} .cb.life`)].slice(P0.life.length);
      const src = pileRect(root, p, 'deck');
      if (src) lives.forEach((el, i) => { const c = center(rectOf(el)), o = center(src); el.animate([{ transform: `translate(${o.x - c.x}px, ${o.y - c.y}px)` }, { transform: 'none' }], { duration: 420 * k, delay: i * 90 * k, easing: EASE, fill: 'backwards' }); });
    }
  }

  // ----- power changes (not when a battle or turn just ended: those bonuses simply wear off) -----
  if (!(prev.battle && !next.battle) && prev.turn === next.turn) {
    for (const P of next.players) for (const c of [P.leader, ...P.chars]) {
      const was = before.pw.get(c.uid); if (was == null) continue;
      const nowP = power(next, c.uid); if (nowP === was) continue;
      const r = rectNow(c.uid); if (!r) continue;
      const d = nowP - was;
      floatText(root, { x: center(r).x, y: r.top + r.height * .3 }, `${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('en-US')}`, d > 0 ? 'up' : 'down', Math.max(0, t - 300 * k), k);
    }
  }
  return Math.round(Math.max(t, 600 * k));
}
