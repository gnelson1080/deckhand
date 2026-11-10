// Deck builder: pick a Leader, add cards with live rule checks, review the deck.
import { getCards, getMeta, tcgplayerUrl } from '../data.js';
import { store } from '../store.js';
import { createDecks } from '../lib/decks-store.js';
import { canAdd, validateDeck, deckTotal, formatDeckText, metaHints, DECK_SIZE } from '../lib/deck.js';
import { deckStats } from '../lib/deckstats.js';
import { searchCards, popularFirst, thumb } from '../lib/search.js';
import { escapeHtml, safeColors, safeUrl } from '../ui/rich-text.js';
import { displayName } from '../ui/define.js';
import { costCurve } from '../ui/charts.js';
import { shake, buzz } from '../ui/fx.js';
import { go } from '../router.js';
import { icon } from '../icons.js';
import { ring } from './decks.js';

const PAGE = 45;
const TYPE_ORDER = ['Character', 'Event', 'Stage'];

export async function render(root, param) {
  const decks = createDecks(store());
  root.innerHTML = '<p class="muted">Opening the deck…</p>';
  const [cards, meta] = await Promise.all([getCards(), getMeta().catch(() => null)]);
  const all = [...cards.values()];

  // Resolve which deck to edit.
  let deck;
  if (param === 'new') { deck = decks.save({ name: 'New deck', leaderId: null, entries: [] }); history.replaceState(null, '', `#/build/${deck.id}`); }
  else if (param?.startsWith('from/')) {
    const [, rank, li] = param.split('/');
    const md = meta?.decks.find(d => d.rank === +rank);
    const list = md?.lists[+li || 0];
    if (!md || !list) { root.innerHTML = `<p class="empty">That tournament list isn't available anymore.</p><a class="btn" href="#/decks">My decks</a>`; return; }
    deck = decks.save({ name: `${md.name} (${list.place || 'top'} place)`.slice(0, 40), leaderId: md.leaderId, entries: list.cards.map(c => ({ ...c })) });
    history.replaceState(null, '', `#/build/${deck.id}`);
  } else deck = decks.get(param);
  if (!deck) { root.innerHTML = `<h1 class="page-title">Deck not found</h1><p class="page-lede">It may have been deleted.</p><a class="btn" href="#/decks">My decks</a>`; return; }

  let tab = deck.leaderId ? 'add' : 'leader';
  const q = { text: '', types: [], cost: null };
  let results = [], shown = 0;
  const save = () => { deck = decks.save(deck); };
  const countIn = id => deck.entries.find(e => e.id === id)?.count || 0;

  root.innerHTML = `
    <a class="back-link" href="#/decks">${icon('back', { size: 20 })}My decks</a>
    <div class="build-head">
      <label class="visually-hidden" for="deck-name">Deck name</label>
      <input id="deck-name" class="deck-name" value="${escapeHtml(deck.name)}" maxlength="60" autocomplete="off">
      <div class="build-leader"></div>
    </div>
    <div class="seg" role="tablist" aria-label="Deck builder sections">
      <button type="button" role="tab" data-tab="add">Add cards</button>
      <button type="button" role="tab" data-tab="list">My deck</button>
      <button type="button" role="tab" data-tab="check">Check</button>
    </div>
    <div class="build-body"></div>
    <div class="build-bar" aria-live="polite"></div>
    <div class="toast" role="status" aria-live="assertive"></div>`;

  const body = root.querySelector('.build-body');
  const bar = root.querySelector('.build-bar');
  const toastEl = root.querySelector('.toast');
  let toastT;
  const toast = (msg, bad = false) => {
    toastEl.textContent = msg; toastEl.classList.toggle('bad', bad); toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), bad ? 3200 : 1400);
  };

  root.querySelector('#deck-name').addEventListener('change', e => { deck.name = e.target.value.trim() || 'Untitled deck'; save(); });

  function drawHead() {
    const L = cards.get(deck.leaderId);
    root.querySelector('.build-leader').innerHTML = L
      ? `<img src="${escapeHtml(thumb(L.img))}" alt="" width="200" height="279"><span><strong>${escapeHtml(displayName(L.name))}</strong>
          <span class="meta-sub">${safeColors(L.colors).map(c => `<span class="dot ${c}"></span>${c}`).join(' ')}</span>
          <button type="button" class="link-btn change-leader">Change Leader</button></span>`
      : '<span class="muted">Step 1: pick a Leader. It decides your colors.</span>';
    root.querySelector('.seg').hidden = !L;
    root.querySelectorAll('.seg [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    root.querySelector('.change-leader')?.addEventListener('click', () => { tab = 'leader'; draw(); });
  }

  function drawBar() {
    const n = deckTotal(deck);
    const v = validateDeck(deck, cards);
    const s = deckStats(deck.entries, cards);
    bar.hidden = !deck.leaderId;
    bar.innerHTML = `${ring(n, DECK_SIZE, 48)}<span class="bar-main"><strong>${n} / ${DECK_SIZE} cards</strong><span class="muted">${s.price ? `About $${Math.round(s.price)} on TCGplayer` : 'Add cards to see the price'}</span></span>
      <button type="button" class="chip bar-check ${v.ok ? 'ok' : ''}" data-tab="check">${v.ok ? `${icon('check', { size: 14, stroke: 3 })}Legal` : `${v.problems.length} to fix`}</button>`;
  }

  function add(card, from) {
    const r = canAdd(deck, card, cards);
    if (!r.ok) { toast(r.reason, true); shake(from); buzz([25, 40, 25]); return; }
    const e = deck.entries.find(x => x.id === card.id);
    if (e) e.count++; else deck.entries.push({ id: card.id, count: 1 });
    save(); buzz(10);
    const badge = from?.querySelector('.in-deck');
    if (badge) { badge.textContent = countIn(card.id); badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop'); }
    else from?.querySelector('.tile-img')?.insertAdjacentHTML('beforeend', `<span class="in-deck pop">${countIn(card.id)}</span>`);
    toast(`Added ${displayName(card.name)} (${countIn(card.id)}/4)`);
    drawBar();
  }
  function remove(id) {
    const e = deck.entries.find(x => x.id === id);
    if (!e) return;
    e.count--; if (e.count <= 0) deck.entries = deck.entries.filter(x => x !== e);
    save(); drawBar();
  }

  // ---- Leader picker
  function drawLeader() {
    const leaders = popularFirst(all.filter(c => c.type === 'Leader'), meta);
    body.innerHTML = `<label class="search-field">${icon('search', { size: 20 })}<span class="visually-hidden">Search Leaders</span><input type="search" placeholder="Search Leaders, like Luffy" autocomplete="off"></label>
      <p class="muted small">Most played in tournaments first.</p><div class="card-grid leader-grid"></div>`;
    const grid = body.querySelector('.leader-grid');
    const paint = text => {
      const r = text ? searchCards(leaders, { q: text }) : leaders;
      grid.innerHTML = r.slice(0, 60).map(c => `<button type="button" class="tile pick-leader" data-id="${escapeHtml(c.id)}"><span class="tile-img in"><img src="${escapeHtml(thumb(c.img))}" alt="" loading="lazy" width="200" height="279"></span><span class="tile-name">${escapeHtml(displayName(c.name))}</span><span class="tile-id">${safeColors(c.colors).join('/')}</span></button>`).join('') || '<p class="empty">No Leader matches.</p>';
    };
    paint('');
    let t; body.querySelector('input').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => paint(e.target.value), 120); });
    grid.addEventListener('click', e => {
      const b = e.target.closest('.pick-leader'); if (!b) return;
      const L = cards.get(b.dataset.id);
      const dropped = deck.entries.filter(x => (cards.get(x.id)?.colors || []).some(c => !L.colors.includes(c)));
      if (dropped.length && !confirm(`${dropped.length} card type(s) in this deck don't match ${displayName(L.name)}'s colors and will be removed. Continue?`)) return;
      deck.entries = deck.entries.filter(x => !dropped.includes(x));
      deck.leaderId = L.id;
      if (/^New deck$|^Untitled deck$/.test(deck.name)) { deck.name = `${displayName(L.name)} deck`; root.querySelector('#deck-name').value = deck.name; }
      save(); tab = 'add'; draw();
    });
  }

  // ---- Add cards
  function drawAdd() {
    const L = cards.get(deck.leaderId);
    const legal = all.filter(c => c.type !== 'Leader' && (c.colors || []).length && c.colors.every(col => L.colors.includes(col)));
    const COSTS = [['0–2', 0, 2], ['3–4', 3, 4], ['5–6', 5, 6], ['7+', 7, 99]];
    body.innerHTML = `<label class="search-field">${icon('search', { size: 20 })}<span class="visually-hidden">Search cards</span><input type="search" placeholder="Search ${escapeHtml(L.colors.join('/'))} cards" autocomplete="off" value="${escapeHtml(q.text)}"></label>
      <div class="filters"><div class="filter-row">${['Character', 'Event', 'Stage'].map(t => `<button type="button" class="chip" data-type="${t}" aria-pressed="${q.types.includes(t)}">${t}</button>`).join('')}
        ${COSTS.map(([l], i) => `<button type="button" class="chip" data-cost="${i}" aria-pressed="${q.cost === i}">Cost ${l}</button>`).join('')}</div></div>
      <p class="muted small add-help">Tap a card to add 1 copy. Only cards your Leader allows are shown. Long-press to see the card.</p>
      <div class="card-grid add-grid"></div><div class="grid-sentinel"></div>`;
    const grid = body.querySelector('.add-grid');
    const tile = c => `<button type="button" class="tile add-tile" data-id="${escapeHtml(c.id)}" aria-label="Add ${escapeHtml(displayName(c.name))}">
        <span class="tile-img in"><img src="${escapeHtml(thumb(c.img))}" alt="" loading="lazy" width="200" height="279">${countIn(c.id) ? `<span class="in-deck">${countIn(c.id)}</span>` : ''}<span class="plus" aria-hidden="true">+</span></span>
        <span class="tile-name">${escapeHtml(displayName(c.name))}</span><span class="tile-id">${c.cost ?? '–'} cost${c.counter ? `, +${c.counter / 1000}k counter` : ''}</span></button>`;
    const more = () => { if (shown >= results.length) return; grid.insertAdjacentHTML('beforeend', results.slice(shown, shown + PAGE).map(tile).join('')); shown += PAGE; };
    const run = () => {
      const [, a, b] = q.cost != null ? COSTS[q.cost] : [null, null, null];
      results = searchCards(legal, { q: q.text, types: q.types, costMin: a, costMax: b });
      if (!q.text.trim()) results = popularFirst(results, meta);
      shown = 0; grid.innerHTML = results.length ? '' : '<p class="empty">No cards match.</p>'; more();
    };
    let t; body.querySelector('input').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { q.text = e.target.value; run(); }, 120); });
    body.querySelector('.filters').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      if (b.dataset.type) { q.types = q.types.includes(b.dataset.type) ? q.types.filter(x => x !== b.dataset.type) : [...q.types, b.dataset.type]; b.setAttribute('aria-pressed', String(q.types.includes(b.dataset.type))); }
      if (b.dataset.cost) { const i = +b.dataset.cost; q.cost = q.cost === i ? null : i; body.querySelectorAll('[data-cost]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.cost === q.cost))); }
      run();
    });
    let press, longFired = false;
    grid.addEventListener('pointerdown', e => { const b = e.target.closest('.add-tile'); if (!b) return; longFired = false; press = setTimeout(() => { longFired = true; go('card', b.dataset.id); }, 550); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => grid.addEventListener(ev, () => clearTimeout(press)));
    grid.addEventListener('contextmenu', e => { if (e.target.closest('.add-tile')) e.preventDefault(); });
    grid.addEventListener('click', e => { const b = e.target.closest('.add-tile'); if (!b || longFired) return; add(cards.get(b.dataset.id), b); });
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) more(); }, { rootMargin: '500px' });
    io.observe(body.querySelector('.grid-sentinel'));
    run();
  }

  // ---- My deck
  function drawList() {
    if (!deck.entries.length) { body.innerHTML = `<p class="empty">No cards yet. Go to <button type="button" class="link-btn" data-tab="add">Add cards</button>.</p>`; return; }
    const groups = TYPE_ORDER.map(t => [t, deck.entries.filter(e => cards.get(e.id)?.type === t)]).filter(([, es]) => es.length);
    const unknown = deck.entries.filter(e => !cards.get(e.id));
    const row = e => {
      const c = cards.get(e.id);
      return `<li class="dl-row" data-id="${escapeHtml(e.id)}">
        ${c ? `<a href="#/card/${encodeURIComponent(e.id)}"><img src="${escapeHtml(thumb(c.img))}" alt="" loading="lazy" width="200" height="279"></a>` : '<span class="no-leader">?</span>'}
        <span class="dl-row-main"><strong>${escapeHtml(c ? displayName(c.name) : `Unknown card ${e.id}`)}</strong><span class="muted">${c ? `${c.cost ?? '–'} cost${c.counter ? `, +${c.counter} counter` : ''}${c.price != null ? `, $${c.price.toFixed(2)}` : ''}` : 'Not in the card list anymore'}</span></span>
        <span class="stepper"><button type="button" data-minus aria-label="Remove one">−</button><span class="stepper-n">${Number(e.count) || 0}</span><button type="button" data-plus aria-label="Add one" ${c ? '' : 'disabled'}>+</button></span></li>`;
    };
    body.innerHTML = groups.map(([t, es]) => `<h3 class="dl-h">${t}s <span class="muted">(${es.reduce((n, e) => n + e.count, 0)})</span></h3><ul class="dl-rows">${es.sort((a, b) => (cards.get(a.id)?.cost ?? 99) - (cards.get(b.id)?.cost ?? 99)).map(row).join('')}</ul>`).join('')
      + (unknown.length ? `<h3 class="dl-h">Unknown cards</h3><ul class="dl-rows">${unknown.map(row).join('')}</ul>` : '');
    body.querySelectorAll('.dl-rows').forEach(ul => ul.addEventListener('click', e => {
      const li = e.target.closest('.dl-row'); if (!li) return;
      if (e.target.closest('[data-minus]')) { remove(li.dataset.id); drawList(); }
      if (e.target.closest('[data-plus]')) { add(cards.get(li.dataset.id), li); drawList(); }
    }));
  }

  // ---- Check
  function drawCheck() {
    const v = validateDeck(deck, cards);
    const s = deckStats(deck.entries, cards);
    const hints = metaHints(deck, meta, cards);
    const text = formatDeckText(deck, cards);
    body.innerHTML = `
      <section class="check ${v.ok ? 'ok' : ''}">
        <h2>${v.ok ? 'Tournament legal' : 'Not legal yet'}</h2>
        ${v.ok ? '<p>1 Leader, 50 cards, every color matches, no more than 4 of any card.</p>' : `<ul class="problems">${v.problems.map(p => `<li>${escapeHtml(p.msg)}</li>`).join('')}</ul>`}
        <p class="muted small">Standard tournaments from April 2026 to March 2027 also ban Block 1 cards (the oldest sets) unless reprinted. Check the block number in each card's corner.</p>
      </section>
      <div class="deck-stats">
        <div class="stat"><span class="stat-v">${s.counters}</span><span class="stat-l">with Counter</span></div>
        <div class="stat"><span class="stat-v">${s.total ? (s.curve.reduce((n, c) => n + c.cost * c.count, 0) / Math.max(1, s.curve.reduce((n, c) => n + c.count, 0))).toFixed(1) : '—'}</span><span class="stat-l">average cost</span></div>
        <div class="stat"><span class="stat-v">${s.price ? '$' + Math.round(s.price) : '—'}</span><span class="stat-l">about, on TCGplayer</span></div>
      </div>
      ${costCurve(s.curve)}
      ${hints.length ? `<section class="hints"><h2>Tips from winning lists</h2><ul>${hints.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul></section>` : ''}
      <section class="export"><h2>Share this deck</h2>
        <textarea class="export-box" rows="6" readonly>${escapeHtml(text)}</textarea>
        <div class="list-links"><button type="button" class="btn copy-list">Copy list</button>${navigator.share ? '<button type="button" class="btn share-list">Share</button>' : ''}
        ${deck.leaderId ? `<a class="btn" href="${escapeHtml(safeUrl(tcgplayerUrl(cards.get(deck.leaderId))))}" target="_blank" rel="noopener">Buy the Leader ${icon('link', { size: 16 })}</a>` : ''}</div>
        <p class="muted small">This format works in TCGplayer's deck builder, Limitless and online simulators.</p></section>`;
    body.querySelector('.copy-list').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { body.querySelector('.export-box').select(); toast('Select and copy the text above'); }
    });
    body.querySelector('.share-list')?.addEventListener('click', () => navigator.share({ title: deck.name, text }).catch(() => {}));
  }

  function draw() {
    drawHead(); drawBar();
    if (tab === 'leader') drawLeader(); else if (tab === 'list') drawList(); else if (tab === 'check') drawCheck(); else drawAdd();
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    if (!deck.leaderId) return;
    tab = b.dataset.tab; draw();
    root.querySelector('.seg').scrollIntoView({ block: 'nearest' });
  });
  draw();
}
