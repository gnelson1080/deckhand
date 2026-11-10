// The practice game table. You are player 0; the computer is player 1.
import { createGame, dispatch, legalActions, actor, power, keywords, find, def, costOf } from '../game/engine.js';
import { DECKS, POOL } from '../game/pool-data.js';
import { chooseAction } from '../game/ai.js';
import { phaseTip, judge, hint, describeAction } from '../game/coach.js';
import { saveGame, loadGame } from '../game/save.js';
import { mulberry32 } from '../game/rng.js';
import { store } from '../store.js';
import { thumb } from '../lib/search.js';
import { escapeHtml, richText } from '../ui/rich-text.js';
import { termIndex } from '../ui/define.js';
import { openSheet } from '../ui/sheet.js';
import { confetti, buzz, shake } from '../ui/fx.js';
import { go } from '../router.js';
import { icon } from '../icons.js';
import { isDesktop } from '../lib/layout.js';

const ME = 0, AI = 1;
const n = x => Number(x || 0).toLocaleString('en-US');
const nm = (s, uid) => escapeHtml(def(find(s, uid)?.inst.id)?.name || '');

// The one live game loop. A new render (including Rematch) always stops the previous one first.
let unmount = null;

export async function render(root) {
  unmount?.();
  unmount = null;
  const st = store();
  const idx = await termIndex();
  let s, meta;
  const fresh = st.get('newGame', null);
  if (fresh) {
    st.set('newGame', null);
    const first = fresh.first === 'me' ? ME : fresh.first === 'them' ? AI : (fresh.seed % 2);
    s = createGame({ seed: fresh.seed, decks: [DECKS[fresh.mine], DECKS[fresh.theirs]], first });
    meta = { level: fresh.level, coach: fresh.coach, mine: fresh.mine, theirs: fresh.theirs, seed: fresh.seed };
  } else {
    const r = loadGame(st.get('game', null), POOL);
    if (!r.ok) { root.innerHTML = `<h1 class="page-title">No game in progress</h1><p class="page-lede">${escapeHtml(r.error)}</p><a class="btn btn-primary" href="#/play">Set up a game</a>`; return; }
    s = r.state; meta = r.meta;
  }
  const rand = mulberry32((meta.seed || 1) + s.turn * 7919);
  let selected = null, picks = [], coachMsg = null, hintFor = null, aiTimer = null, alive = true, fast = st.get('gameFast', false);

  document.body.classList.add('in-game');
  root.innerHTML = `<div class="game" aria-live="polite">
    <div class="g-hud opp"></div><div class="g-zone opp"></div>
    <div class="g-mid"></div>
    <div class="g-zone me"></div><div class="g-hud me"></div>
    <div class="g-hand" aria-label="Your hand"></div>
    <div class="g-panel"></div>
  </div>`;
  const $ = sel => root.querySelector(sel);

  const save = () => { const str = saveGame(s, meta); if (str) st.set('game', s.phase === 'over' ? null : str); };

  // ---------- rendering ----------
  const card = (c, owner, extra = '') => {
    const d = def(c.id);
    const pw = ['Leader', 'Character'].includes(d.type) ? power(s, c.uid) : null;
    const kw = keywords(s, c.uid);
    const base = d.power ?? 0;
    return `<button type="button" class="gc ${c.rested ? 'rested' : ''} ${selected === c.uid ? 'sel' : ''} ${hintFor === c.uid ? 'hinted' : ''} ${extra}" data-uid="${c.uid}" aria-label="${escapeHtml(d.name)}${pw != null ? `, ${pw} power` : ''}${c.rested ? ', rested' : ''}">
      <img src="${escapeHtml(thumb(d.img))}" alt="" draggable="false" loading="lazy">
      ${pw != null ? `<span class="gc-pow ${pw > base ? 'up' : pw < base ? 'down' : ''}">${n(pw)}</span>` : ''}
      ${c.don ? `<span class="gc-don">+${c.don}</span>` : ''}
      ${kw.has('Blocker') ? '<span class="gc-kw">B</span>' : ''}
    </button>`;
  };
  const lifeStack = (P, label) => `<span class="g-life" aria-label="${label} Life ${P.life.length}">${P.life.slice(0, 5).map(() => '<i></i>').join('')}<b>${P.life.length}</b></span>`;
  const donRow = P => `<span class="g-don" aria-label="${P.donActive} active DON!!, ${P.donRested} rested">${'<i class="a"></i>'.repeat(P.donActive)}${'<i class="r"></i>'.repeat(P.donRested)}</span>`;

  function draw() {
    const P = s.players[ME], Q = s.players[AI];
    $('.g-hud.opp').innerHTML = `<a class="g-exit" href="#/play" aria-label="Leave the game (it is saved)">${icon('back', { size: 18 })}</a><span class="g-who">Computer <small>${escapeHtml(meta.level)}</small></span>${lifeStack(Q, 'Opponent')}<span class="g-count">${icon('scroll', { size: 16 })}${Q.hand.length}</span><span class="g-count">Deck ${Q.deck.length}</span>${donRow(Q)}`;
    $('.g-zone.opp').innerHTML = `<div class="g-row"><span class="g-lead">${card(Q.leader, AI, targetClass(Q.leader.uid))}${Q.stage ? card(Q.stage, AI, 'stage') : ''}</span>
      <span class="g-chars">${Q.chars.map(c => card(c, AI, targetClass(c.uid))).join('') || '<span class="g-empty">No Characters</span>'}</span></div>`;
    $('.g-zone.me').innerHTML = `<div class="g-row"><span class="g-lead">${card(P.leader, ME, `${canAct(P.leader.uid)} ${targetClass(P.leader.uid)}`)}${P.stage ? card(P.stage, ME, `stage ${canAct(P.stage.uid)}`) : ''}</span>
      <span class="g-chars">${P.chars.map(c => card(c, ME, `${canAct(c.uid)} ${targetClass(c.uid)}`)).join('') || '<span class="g-empty">No Characters</span>'}</span></div>`;
    $('.g-hud.me').innerHTML = `${lifeStack(P, 'Your')}${donRow(P)}<span class="g-count">Deck ${P.deck.length}</span><span class="g-count">Trash ${P.trash.length}</span>`;
    $('.g-hand').innerHTML = P.hand.map(c => card(c, ME, `in-hand ${canAct(c.uid)} ${counterable(c.uid)}`)).join('');
    drawMid(); drawPanel();
  }
  const acts = () => (actor(s) === ME ? legalActions(s) : []);
  const canAct = uid => (acts().some(a => a.uid === uid && a.type !== 'counter' && a.type !== 'block') ? 'can' : '');
  const counterable = uid => (s.battle?.step === 'counter' && acts().some(a => a.type === 'counter' && a.uid === uid) ? 'can' : '');
  const targetClass = uid => (s.battle?.target === uid ? 'target' : s.battle?.attacker === uid ? 'attacker' : '');

  function eventText(e) {
    const who = e.p === ME ? 'You' : 'Computer';
    switch (e.e) {
      case 'turn': return e.p === ME ? 'Your turn.' : "Computer's turn.";
      case 'play': return `${who} played ${escapeHtml(POOL[e.id]?.name || '')}.`;
      case 'event': return `${who} used ${escapeHtml(POOL[e.id]?.name || '')}.`;
      case 'attack': return `${nm(s, e.uid)} attacks ${nm(s, e.target)}!`;
      case 'block': return `${nm(s, e.uid)} blocks!`;
      case 'counter': return `Counter +${n(e.amount)}.`;
      case 'clash': return `${n(e.a)} vs ${n(e.t)}: ${e.a >= e.t ? 'the attack lands' : 'blocked by power'}.`;
      case 'ko': return `${escapeHtml(POOL[e.id]?.name || 'A Character')} was K.O.'d.`;
      case 'damage': return e.p === ME ? 'You took 1 damage.' : 'Computer took 1 damage.';
      case 'trigger': return `[Trigger]: ${escapeHtml(POOL[e.id]?.name || '')}!`;
      case 'activate': return `${escapeHtml(POOL[e.id]?.name || '')} used its ability.`;
      case 'win': return e.p === ME ? 'You win!' : 'Computer wins.';
      default: return '';
    }
  }

  function drawMid() {
    const b = s.battle;
    const lines = s.log.slice(isDesktop() ? -14 : -3).map(eventText).filter(Boolean);
    $('.g-mid').innerHTML = `${b ? `<div class="g-battle"><span>${nm(s, b.attacker)} <b>${n(power(s, b.attacker))}</b></span><span class="vs">vs</span><span>${nm(s, b.target)} <b>${n(power(s, b.target))}</b></span></div>` : ''}
      <div class="g-log">${lines.map(l => `<p>${l}</p>`).join('')}</div>
      ${meta.coach && s.phase !== 'over' ? `<div class="g-coach ${coachMsg?.tone || ''}">${icon('compass', { size: 18 })}<span>${coachMsg ? escapeHtml(coachMsg.text) : escapeHtml(phaseTip(s, ME))}</span></div>` : ''}`;
  }

  // ---------- bottom panel ----------
  function drawPanel() {
    const panel = $('.g-panel');
    if (s.phase === 'over') {
      panel.innerHTML = `<div class="g-over ${s.winner === ME ? 'win' : 'lose'}"><h2>${s.winner === ME ? 'You win!' : 'The computer wins'}</h2>
        <p>${s.winner === ME ? 'Great sailing. Try a harder level or another deck.' : 'Every game teaches something. Turn the coach on and try again.'}</p>
        <div class="list-links"><button type="button" class="btn btn-primary rematch">Rematch</button><a class="btn" href="#/play">New setup</a></div></div>`;
      return;
    }
    if (actor(s) !== ME) { panel.innerHTML = `<div class="g-wait"><span class="spinner" aria-hidden="true"></span>Computer is playing… <button type="button" class="chip fast-btn" aria-pressed="${fast}">Fast</button></div>`; return; }
    const pd = s.pending;
    if (pd) return drawChoice(panel, pd);
    if (s.phase === 'mulligan') {
      panel.innerHTML = `<p class="g-q">Keep this hand or redraw all 5 once?</p><div class="g-btns"><button type="button" class="btn btn-primary" data-act='{"type":"keep"}'>Keep</button><button type="button" class="btn" data-act='{"type":"mulligan"}'>Redraw</button></div>`;
      return;
    }
    const b = s.battle;
    if (b?.step === 'block') {
      const bl = acts().filter(a => a.type === 'block');
      panel.innerHTML = `<p class="g-q">Block with a [Blocker]?</p><div class="g-btns">${bl.map(a => `<button type="button" class="btn" data-act='${JSON.stringify(a)}'>Block with ${nm(s, a.uid)}</button>`).join('')}<button type="button" class="btn btn-primary" data-act='{"type":"noBlock"}'>Don't block</button></div>`;
      return;
    }
    if (b?.step === 'counter') {
      panel.innerHTML = `<p class="g-q">Tap glowing cards in your hand to Counter, or finish.</p><div class="g-btns"><button type="button" class="btn btn-primary" data-act='{"type":"endCounter"}'>Finish defending</button>${meta.coach ? '<button type="button" class="btn hint-btn">Hint</button>' : ''}</div>`;
      return;
    }
    if (selected) {
      const mine = acts().filter(a => a.uid === selected);
      panel.innerHTML = `<p class="g-q">${nm(s, selected)}</p><div class="g-btns">${mine.map(a => `<button type="button" class="btn ${a.type === 'attack' ? 'btn-primary' : ''}" data-act='${JSON.stringify(a)}'>${escapeHtml(label(a))}</button>`).join('') || '<span class="muted">Nothing to do with this card right now.</span>'}
        <button type="button" class="btn ghost info-btn" data-uid="${selected}">${icon('info', { size: 16 })}Card</button><button type="button" class="btn ghost" data-cancel>Back</button></div>`;
      return;
    }
    panel.innerHTML = `<div class="g-btns main">${meta.coach ? '<button type="button" class="btn hint-btn">Hint</button>' : ''}<button type="button" class="btn log-btn">Log</button><button type="button" class="btn btn-primary" data-act='{"type":"endTurn"}'>End turn</button></div>
      <p class="muted small g-help">${isDesktop() ? 'Click a glowing card to play it, give it DON!!, or attack. Keys: <kbd>E</kbd> end turn, <kbd>H</kbd> hint, <kbd>1</kbd>–<kbd>9</kbd> pick a button, <kbd>Esc</kbd> back.' : 'Tap a glowing card to play it, give it DON!!, or attack.'}</p>`;
  }
  const label = a => {
    if (a.type === 'attack') return `Attack ${def(find(s, a.target).inst.id).name}${find(s, a.target).zone === 'leader' ? ' (Leader)' : ''}: ${n(power(s, a.uid))} vs ${n(power(s, a.target))}`;
    if (a.type === 'play') return `Play (cost ${Math.max(0, costOf(s, a.uid))})`;
    if (a.type === 'giveDon') return `Give 1 DON!! (+1000)`;
    if (a.type === 'activate') return 'Use ability';
    return describeAction(s, a);
  };

  function drawChoice(panel, pd) {
    if (pd.kind === 'trigger') {
      const c = find(s, pd.uid).inst;
      panel.innerHTML = `<div class="g-choice"><img class="g-big" src="${escapeHtml(thumb(def(c.id).img))}" alt=""><div><p class="g-q">[Trigger] revealed: ${escapeHtml(def(c.id).name)}</p><p class="small">${richText((def(c.id).text.match(/\[Trigger\][^\n]*/) || [''])[0], idx)}</p>
        <div class="g-btns"><button type="button" class="btn btn-primary" data-act='{"type":"useTrigger"}'>Use Trigger</button><button type="button" class="btn" data-act='{"type":"skipTrigger"}'>Add to hand</button></div></div></div>`;
      return;
    }
    if (pd.kind === 'confirm') { panel.innerHTML = `<p class="g-q">${escapeHtml(pd.prompt)}</p><div class="g-btns"><button type="button" class="btn btn-primary" data-act='{"type":"choose","yes":true}'>Yes</button><button type="button" class="btn" data-act='{"type":"choose","yes":false}'>No</button></div>`; return; }
    if (pd.kind === 'mode') { panel.innerHTML = `<p class="g-q">${escapeHtml(pd.prompt)}</p><div class="g-btns col">${pd.labels.map((l, i) => `<button type="button" class="btn" data-act='{"type":"choose","option":${i}}'>${escapeHtml(l)}</button>`).join('')}</div>`; return; }
    // pick
    const opt = u => {
      if (u.includes('DON:')) return `<button type="button" class="opt don ${picks.includes(u) ? 'on' : ''}" data-pick="${u}">DON!!</button>`;
      const c = find(s, u)?.inst; if (!c) return '';
      const d = def(c.id);
      return `<button type="button" class="opt ${picks.includes(u) ? 'on' : ''}" data-pick="${u}" aria-pressed="${picks.includes(u)}"><img src="${escapeHtml(thumb(d.img))}" alt=""><span>${escapeHtml(d.name)}${find(s, u).owner === AI ? ' (opp.)' : ''}</span></button>`;
    };
    const ok = picks.length >= pd.min && picks.length <= pd.max;
    panel.innerHTML = `<p class="g-q">${escapeHtml(pd.prompt || 'Choose.')} <span class="muted small">${pd.min === pd.max ? `Pick ${pd.min}` : `Pick ${pd.min ? `${pd.min}–` : 'up to '}${pd.max}`}</span></p>
      ${pd.looked ? `<p class="muted small">You looked at: ${pd.looked.map(u => escapeHtml(def(find(s, u)?.inst.id)?.name || '?')).join(', ')}</p>` : ''}
      <div class="g-opts">${pd.options.map(opt).join('')}</div>
      <div class="g-btns"><button type="button" class="btn btn-primary pick-ok" ${ok ? '' : 'disabled'}>${picks.length ? 'Confirm' : pd.min === 0 ? 'Choose none' : 'Confirm'}</button></div>`;
  }

  // ---------- acting ----------
  function act(a) {
    const prev = s;
    const next = dispatch(s, a);
    if (next.error) { coachMsg = { tone: 'risky', text: next.error }; shake($('.g-panel')); buzz([25, 40, 25]); drawMid(); return; }
    coachMsg = meta.coach && actor(prev) === ME ? judge(prev, a, next, ME) : null;
    s = next; selected = null; picks = []; hintFor = null;
    flip(() => draw());
    save();
    if (s.phase === 'over') { if (s.winner === ME) confetti(); buzz(s.winner === ME ? [20, 60, 20] : 40); return; }
    scheduleAI();
  }

  function scheduleAI() {
    clearTimeout(aiTimer);
    if (!alive || s.phase === 'over' || actor(s) !== AI) return;
    aiTimer = setTimeout(() => {
      if (!alive) return;
      const a = chooseAction(s, AI, meta.level, rand);
      const next = dispatch(s, a);
      s = next.error ? dispatch(s, legalActions(s)[0]) : next;
      coachMsg = null;
      flip(() => draw());
      save();
      if (s.phase === 'over') { if (s.winner === ME) confetti(); return; }
      scheduleAI();
    }, fast ? 120 : actor(s) === AI && s.battle ? 650 : 520);
  }

  // FLIP: cards that moved slide from their old spot; new cards pop in.
  function flip(update) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const before = new Map([...root.querySelectorAll('.gc[data-uid]')].map(el => [el.dataset.uid, el.getBoundingClientRect()]));
    update();
    if (reduce) return;
    for (const el of root.querySelectorAll('.gc[data-uid]')) {
      const r0 = before.get(el.dataset.uid), r1 = el.getBoundingClientRect();
      if (!r0) { el.animate([{ opacity: 0, transform: 'translateY(14px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' }); continue; }
      const dx = r0.left - r1.left, dy = r0.top - r1.top;
      if (Math.abs(dx) + Math.abs(dy) > 2) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }

  const gameEl = $('.game');
  gameEl.addEventListener('click', e => {
    const actBtn = e.target.closest('[data-act]');
    if (actBtn) { act(JSON.parse(actBtn.dataset.act)); return; }
    if (e.target.closest('[data-cancel]')) { selected = null; drawPanel(); draw(); return; }
    if (e.target.closest('.rematch')) { alive = false; clearTimeout(aiTimer); st.set('newGame', { mine: meta.mine, theirs: meta.theirs, level: meta.level, coach: meta.coach, first: 'random', seed: (Date.now() >>> 0) }); render(root); return; }
    if (e.target.closest('.fast-btn')) { fast = !fast; st.set('gameFast', fast); drawPanel(); return; }
    if (e.target.closest('.log-btn')) { openSheet({ title: 'Game log', html: `<ol class="g-fulllog">${s.log.slice(-60).map(eventText).filter(Boolean).reverse().map(l => `<li>${l}</li>`).join('')}</ol>` }); return; }
    if (e.target.closest('.hint-btn')) { const h = hint(s, ME); if (h) { coachMsg = { tone: 'hint', text: h.text }; hintFor = h.action.uid || null; draw(); } return; }
    const info = e.target.closest('.info-btn');
    if (info) { showCard(info.dataset.uid); return; }
    const pk = e.target.closest('[data-pick]');
    if (pk && s.pending?.kind === 'pick') {
      const u = pk.dataset.pick, pd = s.pending;
      picks = picks.includes(u) ? picks.filter(x => x !== u) : pd.max === 1 ? [u] : picks.length < pd.max ? [...picks, u] : picks;
      drawPanel(); return;
    }
    if (e.target.closest('.pick-ok')) { act({ type: 'choose', picks }); return; }
    const c = e.target.closest('.gc[data-uid]');
    if (!c) return;
    const uid = c.dataset.uid;
    if (actor(s) === ME && s.battle?.step === 'counter') { const a = acts().find(x => x.type === 'counter' && x.uid === uid); if (a) act(a); else showCard(uid); return; }
    if (actor(s) === ME && !s.pending && !s.battle && s.phase === 'main' && acts().some(a => a.uid === uid)) { selected = selected === uid ? null : uid; draw(); return; }
    showCard(uid);
  });

  function showCard(uid) {
    const f = find(s, uid); if (!f) return;
    const d = def(f.inst.id);
    openSheet({ title: d.name, html: `<div class="g-cardinfo"><img src="${escapeHtml(d.img)}" alt="" width="600" height="838"><div><p class="muted small">${escapeHtml(d.type)}${d.cost != null ? `, cost ${costOf(s, uid)}` : ''}${d.power != null ? `, ${n(power(s, uid))} power now` : ''}${d.counter ? `, Counter +${n(d.counter)}` : ''}</p><p>${d.text ? richText(d.text, idx) : 'No effect.'}</p></div></div>` });
  }

  // Keyboard shortcuts (handy on a computer).
  const onKey = e => {
    if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.sheet.open')) return;
    const k = e.key.toLowerCase();
    const panel = $('.g-panel');
    if (!panel) return;
    if (k === 'e') { const b = panel.querySelector('[data-act*="endTurn"]'); if (b) { e.preventDefault(); b.click(); } }
    else if (k === 'h') { const b = panel.querySelector('.hint-btn'); if (b) { e.preventDefault(); b.click(); } }
    else if (k === 'escape') { if (selected) { selected = null; draw(); } }
    else if (/^[1-9]$/.test(k)) { const bs = [...panel.querySelectorAll('[data-act], .opt, .pick-ok:not([disabled])')]; const b = bs[+k - 1]; if (b) { e.preventDefault(); b.click(); } }
    else if (k === 'enter' && e.target === document.body) { const b = panel.querySelector('.btn-primary:not([disabled])'); if (b) { e.preventDefault(); b.click(); } }
  };
  addEventListener('keydown', onKey);

  draw();
  save();
  scheduleAI();
  const stop = () => { alive = false; clearTimeout(aiTimer); removeEventListener('keydown', onKey); document.body.classList.remove('in-game'); if (unmount === stop) unmount = null; };
  unmount = stop;
  // The router keeps only the first cleanup; route it to whichever game is live now.
  return () => unmount?.();
}
