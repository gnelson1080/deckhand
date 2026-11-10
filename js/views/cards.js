import { getCards, getMeta } from '../data.js';
import { searchCards, thumb, setsOf, popularFirst } from '../lib/search.js';
import { escapeHtml } from '../ui/rich-text.js';
import { displayName } from '../ui/define.js';
import { icon } from '../icons.js';

const COLORS = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'];
const TYPES = ['Leader', 'Character', 'Event', 'Stage'];
const COSTS = [['0–2', 0, 2], ['3–4', 3, 4], ['5–6', 5, 6], ['7+', 7, 99]];
const PAGE = 60;

// Remembered while the app is open, so coming back from a card keeps your search.
const state = { q: '', colors: [], types: [], cost: null, set: '', scroll: 0 };

export async function render(root) {
  root.innerHTML = `<h1 class="page-title">Cards</h1>
    <p class="page-lede">Every One Piece card, with pictures and plain-English effects. Tap a card to learn it.</p>
    <label class="search-field">${icon('search', { size: 20 })}<span class="visually-hidden">Search cards</span>
      <input type="search" placeholder="Name, number or crew, like Zoro" autocomplete="off" enterkeyhint="search" value="${escapeHtml(state.q)}"></label>
    <div class="filters">
      <div class="filter-row" role="group" aria-label="Color">${COLORS.map(c => `<button type="button" class="chip color-chip" data-color="${c}" aria-pressed="${state.colors.includes(c)}"><span class="dot ${c}"></span>${c}</button>`).join('')}</div>
      <div class="filter-row" role="group" aria-label="Card type">${TYPES.map(t => `<button type="button" class="chip" data-type="${t}" aria-pressed="${state.types.includes(t)}">${t}</button>`).join('')}</div>
      <div class="filter-row" role="group" aria-label="Cost">${COSTS.map(([l], i) => `<button type="button" class="chip" data-cost="${i}" aria-pressed="${state.cost === i}">Cost ${l}</button>`).join('')}
        <label class="chip select-chip"><span class="visually-hidden">Set</span><select data-set><option value="">All sets</option></select></label></div>
    </div>
    <p class="result-count muted" aria-live="polite">Loading cards…</p>
    <div class="card-grid"></div>
    <div class="grid-sentinel" aria-hidden="true"></div>`;

  const grid = root.querySelector('.card-grid');
  const count = root.querySelector('.result-count');
  const input = root.querySelector('input');
  const setSel = root.querySelector('select[data-set]');

  let all, meta = null;
  try { [all, meta] = await Promise.all([getCards().then(m => [...m.values()]), getMeta().catch(() => null)]); }
  catch { count.textContent = "Cards couldn't load. Check your connection, then pull down to refresh."; return; }

  setSel.insertAdjacentHTML('beforeend', setsOf(all).map(s => `<option value="${s}" ${state.set === s ? 'selected' : ''}>${s}</option>`).join(''));

  let results = [], shown = 0;
  const tile = (c, i) => `<a class="tile" href="#/card/${encodeURIComponent(c.id)}" style="--i:${i % PAGE}">
      <span class="tile-img"><img src="${escapeHtml(thumb(c.img))}" alt="" loading="lazy" decoding="async" width="200" height="279" onload="this.parentNode.classList.add('in')"></span>
      <span class="tile-name">${escapeHtml(displayName(c.name))}</span>
      <span class="tile-id">${escapeHtml(c.id)}</span></a>`;
  const more = () => {
    if (shown >= results.length) return;
    grid.insertAdjacentHTML('beforeend', results.slice(shown, shown + PAGE).map(tile).join(''));
    shown = Math.min(results.length, shown + PAGE);
  };
  const run = () => {
    const [, costMin, costMax] = state.cost != null ? COSTS[state.cost] : [null, null, null];
    results = searchCards(all, { q: state.q, colors: state.colors, types: state.types, costMin, costMax, set: state.set });
    const browsing = !state.q.trim();
    if (browsing) results = popularFirst(results, meta);
    shown = 0; grid.innerHTML = '';
    count.textContent = results.length ? `${results.length.toLocaleString()} card${results.length === 1 ? '' : 's'}${browsing && meta ? ', most played in tournaments first' : ''}` : '';
    if (!results.length) grid.innerHTML = `<p class="empty">No cards match. Try removing a filter or searching a shorter name.</p>`;
    more();
  };

  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = input.value; run(); }, 120); });
  root.querySelector('.filters').addEventListener('click', e => {
    const b = e.target.closest('button.chip'); if (!b) return;
    const toggle = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
    if (b.dataset.color) state.colors = toggle(state.colors, b.dataset.color);
    if (b.dataset.type) state.types = toggle(state.types, b.dataset.type);
    if (b.dataset.cost) { const i = +b.dataset.cost; state.cost = state.cost === i ? null : i; root.querySelectorAll('[data-cost]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.cost === state.cost))); }
    else b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true');
    run();
  });
  setSel.addEventListener('change', () => { state.set = setSel.value; run(); });

  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) more(); }, { rootMargin: '600px' });
  io.observe(root.querySelector('.grid-sentinel'));

  run();
  // Restore scroll when coming back from a card.
  if (state.scroll) { const y = state.scroll; while (shown < results.length && grid.scrollHeight < y + innerHeight) more(); requestAnimationFrame(() => scrollTo(0, y)); }
  const onScroll = () => { state.scroll = scrollY; };
  addEventListener('scroll', onScroll, { passive: true });
  return () => { io.disconnect(); removeEventListener('scroll', onScroll); };
}
