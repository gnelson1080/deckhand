// Single-series price line (dataviz rules: one hue, 2px line, recessive grid, one y-axis,
// crosshair + tooltip on pointer/touch, change shown with a glyph and text, not color alone).
import { priceSeries, pctChange } from '../lib/price-series.js';
import { formatDate } from '../data.js';

const W = 320, H = 150, PAD = { l: 40, r: 8, t: 10, b: 22 };
const money = v => `$${v < 100 ? v.toFixed(2) : Math.round(v).toLocaleString()}`;

export function renderPriceChart(el, shard, id) {
  let range = '30d';
  el.classList.add('price-chart');

  const draw = () => {
    const s = priceSeries(shard, id, range);
    const chips = ['7d', '30d', 'all'].map(r => `<button type="button" class="chip" data-range="${r}" aria-pressed="${r === range}">${r === 'all' ? 'All' : r.replace('d', ' days')}</button>`).join('');
    if (s.length < 2) {
      el.innerHTML = `<div class="pc-head"><h2>Price history</h2></div><div class="pc-chips">${chips}</div>
        <p class="pc-empty">Not enough price history yet. Prices are recorded once a day, so this chart fills in over the next few days.</p>`;
      return;
    }
    const prices = s.map(x => x.price);
    let lo = Math.min(...prices), hi = Math.max(...prices);
    if (hi - lo < 0.01) { lo = Math.max(0, lo - 0.5); hi = hi + 0.5; }
    const span = hi - lo; lo = Math.max(0, lo - span * 0.1); hi = hi + span * 0.1;
    const x = i => PAD.l + (i / (s.length - 1)) * (W - PAD.l - PAD.r);
    const y = v => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const path = s.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join('');
    const ticks = [lo, (lo + hi) / 2, hi];
    const ch = pctChange(s);
    el.innerHTML = `
      <div class="pc-head"><h2>Price history</h2>
        <p class="pc-change"><strong>${money(s.at(-1).price)}</strong> ${ch == null ? '' : `<span>${ch > 0 ? '▲' : ch < 0 ? '▼' : '■'} ${ch > 0 ? '+' : ''}${ch}% over ${range === 'all' ? 'all recorded days' : range.replace('d', ' days')}</span>`}</p></div>
      <div class="pc-chips">${chips}</div>
      <div class="pc-plot">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Price from ${money(s[0].price)} on ${formatDate(s[0].date)} to ${money(s.at(-1).price)} on ${formatDate(s.at(-1).date)}">
          ${ticks.map(t => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}" class="pc-grid"/><text x="${PAD.l - 6}" y="${y(t) + 4}" class="pc-tick" text-anchor="end">${money(t)}</text>`).join('')}
          <text x="${PAD.l}" y="${H - 5}" class="pc-tick">${formatDate(s[0].date)}</text>
          <text x="${W - PAD.r}" y="${H - 5}" class="pc-tick" text-anchor="end">${formatDate(s.at(-1).date)}</text>
          <path d="${path}" class="pc-line" pathLength="1"/>
          <g class="pc-cross" visibility="hidden"><line class="pc-vline" y1="${PAD.t}" y2="${H - PAD.b}"/><circle r="4.5" class="pc-dot"/></g>
          <rect class="pc-hit" x="${PAD.l}" y="0" width="${W - PAD.l - PAD.r}" height="${H}" fill="transparent"/>
        </svg>
        <div class="pc-tip" hidden></div>
      </div>
      <details class="pc-table"><summary>Show as a table</summary><table><thead><tr><th>Date</th><th>Price</th></tr></thead><tbody>${s.slice().reverse().slice(0, 60).map(p => `<tr><td>${formatDate(p.date)}</td><td>${money(p.price)}</td></tr>`).join('')}</tbody></table></details>`;

    const svg = el.querySelector('svg'), cross = el.querySelector('.pc-cross'), tip = el.querySelector('.pc-tip');
    const show = ev => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(s.length - 1, Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (s.length - 1))));
      const cx = x(i), cy = y(s[i].price);
      cross.setAttribute('visibility', 'visible');
      cross.querySelector('line').setAttribute('x1', cx); cross.querySelector('line').setAttribute('x2', cx);
      cross.querySelector('circle').setAttribute('cx', cx); cross.querySelector('circle').setAttribute('cy', cy);
      tip.hidden = false;
      tip.textContent = `${formatDate(s[i].date)}: ${money(s[i].price)}`;
      tip.style.left = `${Math.min(Math.max((cx / W) * 100, 18), 82)}%`;
    };
    const hide = () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    const hit = el.querySelector('.pc-hit');
    hit.addEventListener('pointermove', show); hit.addEventListener('pointerdown', show); hit.addEventListener('pointerleave', hide);
  };
  el.addEventListener('click', e => { const b = e.target.closest('[data-range]'); if (b) { range = b.dataset.range; draw(); } });
  draw();
}
