import { getCards, getGlossary, getMeta, getPriceShard, tcgplayerUrl } from '../data.js';
import { renderPriceChart } from '../ui/price-chart.js';
import { richText, termsIn, escapeHtml, safeUrl, safeColors } from '../ui/rich-text.js';
import { termIndex, displayName } from '../ui/define.js';
import { icon } from '../icons.js';

const stat = (label, v, fmt = x => x) => `<div class="stat"><span class="stat-v">${v == null ? '—' : escapeHtml(fmt(v))}</span><span class="stat-l">${label}</span></div>`;

const TYPE_HELP = {
  Leader: 'This is a Leader. A deck is built around 1 Leader, which sets your colors and Life.',
  Character: 'This is a Character. Pay its cost in DON!! to put it on the table, where it can attack and defend.',
  Event: 'This is an Event. Pay its cost, use the effect once, then it goes to the trash.',
  Stage: 'This is a Stage. It stays on the table and gives an ongoing effect. Only 1 Stage at a time.',
};

export async function render(root, id) {
  root.innerHTML = `<p class="muted">Loading card…</p>`;
  let cards, glossary, idx;
  try { [cards, glossary, idx] = await Promise.all([getCards(), getGlossary(), termIndex()]); }
  catch { root.innerHTML = `<p class="empty">The card list didn't load. Connect to the internet once, and Deckhand will keep a copy for offline use.</p><a class="btn" href="#/cards" data-back>Back</a>`; return; }
  const c = cards.get(id);
  if (!c) {
    root.innerHTML = `<h1 class="page-title">Card not found</h1><p class="page-lede">There's no card numbered ${escapeHtml(id)}. It may be too new for our card list.</p><a class="btn" href="#/cards">Search cards</a>`;
    return;
  }
  const meta = await getMeta().catch(() => null);
  const usedIn = (meta?.decks || []).filter(d => d.leaderId === c.id || d.lists.some(l => l.cards.some(x => x.id === c.id)));
  const terms = termsIn(c.text, idx).map(t => glossary.find(g => g.term === t)).filter(Boolean);
  const name = displayName(c.name);
  const arts = [c.img, ...(c.altImgs || [])];

  root.innerHTML = `
    <a class="back-link" href="#/cards" data-back>${icon('back', { size: 20 })}Cards</a>
    <div class="card-hero">
      <div class="card-3d" tabindex="0" aria-label="${escapeHtml(name)} card image. Drag to tilt.">
        <div class="card-flip">
          <div class="card-face card-back" aria-hidden="true"></div>
          <img class="card-face card-front" src="${escapeHtml(c.img)}" alt="${escapeHtml(name)}, ${escapeHtml(c.id)}" width="600" height="838">
        </div>
      </div>
    </div>
    ${arts.length > 1 ? `<div class="arts" role="group" aria-label="Other artwork">${arts.map((a, i) => `<button type="button" class="art" data-art="${i}" aria-pressed="${i === 0}" aria-label="Art ${i + 1}"><img src="${escapeHtml(a.replace(/_in_1000x1000\.jpg$/, '_200w.jpg'))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
    <h1 class="card-title">${escapeHtml(name)}</h1>
    <p class="card-sub"><span>${escapeHtml(c.id)}</span><span>${escapeHtml(c.type || '')}</span>${c.rarity ? `<span>${escapeHtml(c.rarity)}</span>` : ''}</p>
    <div class="color-row">${safeColors(c.colors).map(col => `<span class="chip static"><span class="dot ${col}"></span>${col}</span>`).join('')}${c.attribute ? `<span class="chip static">&lt;${escapeHtml(c.attribute)}&gt;</span>` : ''}</div>
    <div class="stats">
      ${c.type === 'Leader' ? stat('Life', c.life) : stat('Cost', c.cost)}
      ${stat('Power', c.power, v => v.toLocaleString())}
      ${c.type === 'Character' ? stat('Counter', c.counter, v => '+' + v.toLocaleString()) : ''}
    </div>
    <p class="type-help">${escapeHtml(TYPE_HELP[c.type] || '')}</p>
    <section class="effect panel">
      <h2>Effect</h2>
      ${c.text ? `<p class="effect-text">${richText(c.text, idx)}</p>` : `<p class="muted">No effect. This card just brings its power${c.counter ? ' and its Counter' : ''}.</p>`}
      ${c.traits?.length ? `<p class="traits"><span class="muted">Type:</span> ${c.traits.map(t => `<span class="trait">${escapeHtml(t)}</span>`).join(' ')}</p>` : ''}
    </section>
    ${terms.length ? `<section class="explain"><h2>What this means</h2><dl>${terms.map(g => `<div><dt><button type="button" class="kw" data-term="${escapeHtml(g.term)}">${escapeHtml(g.term)}</button></dt><dd>${escapeHtml(g.short)}</dd></div>`).join('')}</dl></section>` : ''}
    ${usedIn.length ? `<section class="used-in"><h2>Seen in the meta</h2><p class="muted">Played in ${usedIn.length} of today's top ${meta.decks.length} tournament decks.</p>
      <div class="used-list">${usedIn.map(d => `<a class="chip" href="#/deck/${d.rank}"><span class="rank">#${d.rank}</span>${escapeHtml(d.name)}</a>`).join('')}</div></section>` : ''}
    <section class="buy panel">
      <div><span class="muted">TCGplayer market price</span><strong class="price">${c.price != null ? '$' + c.price.toFixed(2) : 'Not listed yet'}</strong></div>
      <a class="btn btn-primary" href="${escapeHtml(safeUrl(tcgplayerUrl(c)))}" target="_blank" rel="noopener">View on TCGplayer ${icon('link', { size: 18 })}</a>
    </section>
    <section class="panel price-host"></section>`;

  getPriceShard(c.id.split('-')[0]).then(shard => { const host = root.querySelector('.price-host'); if (host) renderPriceChart(host, shard, c.id); });

  // Flip in, then let the reader tilt the card.
  const box = root.querySelector('.card-3d');
  const flip = root.querySelector('.card-flip');
  const front = root.querySelector('.card-front');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal = () => flip.classList.add('shown');
  if (reduce) reveal(); else if (front.complete) requestAnimationFrame(() => requestAnimationFrame(reveal)); else { front.addEventListener('load', reveal, { once: true }); front.addEventListener('error', reveal, { once: true }); setTimeout(reveal, 1500); }

  if (!reduce) {
    let raf;
    const tilt = (x, y) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { box.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`); box.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`); box.style.setProperty('--gx', `${50 + x * 50}%`); box.style.setProperty('--gy', `${50 + y * 50}%`); }); };
    box.addEventListener('pointermove', e => { const r = box.getBoundingClientRect(); tilt((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5); });
    const reset = () => { box.classList.add('settle'); tilt(0, 0); setTimeout(() => box.classList.remove('settle'), 500); };
    box.addEventListener('pointerleave', reset); box.addEventListener('pointerup', reset); box.addEventListener('pointercancel', reset);
  }

  root.querySelector('.arts')?.addEventListener('click', e => {
    const b = e.target.closest('[data-art]'); if (!b) return;
    root.querySelectorAll('[data-art]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    front.animate([{ opacity: 1 }, { opacity: 0.2 }], { duration: 120 }).onfinish = () => {
      front.src = arts[+b.dataset.art];
      front.animate([{ opacity: 0.2, transform: 'scale(.97)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
    };
  });
}
