// Single-series bar charts drawn as HTML. One hue (sea), thin bars with rounded data ends,
// selective value labels, and a per-bar tooltip (title + aria-label) for hover/tap.
import { escapeHtml } from './rich-text.js';

export function costCurve(curve) {
  const max = Math.max(1, ...curve.map(c => c.count));
  return `<figure class="curve" aria-label="Cost curve: how many cards at each cost">
    <div class="curve-plot" role="list">
      ${curve.map((c, i) => `<div class="curve-col" role="listitem" tabindex="0" aria-label="Cost ${c.cost}${c.cost === 10 ? '+' : ''}: ${c.count} card${c.count === 1 ? '' : 's'}" title="Cost ${c.cost}${c.cost === 10 ? '+' : ''}: ${c.count} cards">
        <span class="curve-v">${c.count || ''}</span>
        <span class="curve-bar" style="--h:${(c.count / max) * 100}%;--i:${i}"></span>
        <span class="curve-k">${c.cost}${c.cost === 10 ? '+' : ''}</span>
      </div>`).join('')}
    </div>
    <figcaption class="muted">Cards at each cost. Most decks peak at low costs and keep a few big finishers.</figcaption>
  </figure>`;
}

export function shareBar(share, maxShare) {
  const w = maxShare ? Math.max(2, (share / maxShare) * 100) : 0;
  return `<span class="share" title="${share}% of top tournament decklists"><span class="share-bar" style="--w:${w}%"></span><span class="share-v">${share}%</span></span>`;
}

export const difficultyLabel = d => ['', 'Easy to learn', 'Medium', 'Advanced'][d] || '';
export const difficultyMarks = d => `<span class="anchors" aria-label="${escapeHtml(difficultyLabel(d))}">${[1, 2, 3].map(i => `<span class="anchor${i <= d ? ' on' : ''}" aria-hidden="true"></span>`).join('')}</span>`;
